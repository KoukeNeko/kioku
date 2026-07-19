package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"
)

func TestPrewarmIndexesAndServesReadyAudio(t *testing.T) {
	t.Parallel()

	var calls atomic.Int32
	var upstreamRequest irodoriRequest
	upstream := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		calls.Add(1)
		if request.URL.Path != "/v1/audio/speech" {
			t.Errorf("upstream path = %q", request.URL.Path)
			http.Error(response, "bad path", http.StatusBadRequest)
			return
		}
		if got := request.Header.Get("Authorization"); got != "Bearer upstream-secret" {
			t.Errorf("upstream authorization = %q", got)
		}
		if err := json.NewDecoder(request.Body).Decode(&upstreamRequest); err != nil {
			t.Errorf("decode upstream request: %v", err)
			http.Error(response, "bad body", http.StatusBadRequest)
			return
		}
		response.Header().Set("Content-Type", "audio/mp4")
		_, _ = response.Write([]byte("generated-audio"))
	}))
	defer upstream.Close()

	runtime := newTestRuntime(t, upstream.URL)
	result, err := runtime.service.prewarm(context.Background(), synthesisRequest{
		entryID: "vocab:2820690",
		text:    "  辞書\r\nアプリ  ",
		voice:   runtime.cfg.defaultVoice,
		format:  runtime.cfg.defaultFormat,
		speed:   runtime.cfg.defaultSpeed,
	}, false)
	if err != nil {
		t.Fatalf("prewarm: %v", err)
	}
	if result.skipped {
		t.Fatal("first prewarm unexpectedly skipped")
	}
	if calls.Load() != 1 {
		t.Fatalf("upstream calls = %d, want 1", calls.Load())
	}
	if upstreamRequest.Input != "辞書 アプリ" {
		t.Fatalf("normalized input = %q", upstreamRequest.Input)
	}
	if upstreamRequest.Irodori.NumSteps != 60 || upstreamRequest.Irodori.CFGScaleText != 3.0 || upstreamRequest.Irodori.TScheduleMode != "linear" {
		t.Fatalf("unexpected Irodori profile: %+v", upstreamRequest.Irodori)
	}
	if upstreamRequest.Irodori.Seed == 0 {
		t.Fatal("deterministic seed must be positive")
	}
	if upstreamRequest.Irodori.CFGScaleSpeaker == nil || *upstreamRequest.Irodori.CFGScaleSpeaker != 5.0 {
		t.Fatalf("speaker CFG = %v, want 5.0", upstreamRequest.Irodori.CFGScaleSpeaker)
	}

	response := performAudioGET(runtime.handler, "app-secret", "/api/v1/dictionary-audio/vocab/2820690")
	if response.Code != http.StatusOK {
		t.Fatalf("GET status = %d; body=%s", response.Code, response.Body.String())
	}
	if !bytes.Equal(response.Body.Bytes(), []byte("generated-audio")) {
		t.Fatalf("GET body = %q", response.Body.Bytes())
	}
	if got := response.Header().Get("Content-Type"); got != "audio/mp4" {
		t.Fatalf("Content-Type = %q", got)
	}
	if response.Header().Get("ETag") == "" || response.Header().Get("X-Audio-Profile") == "" {
		t.Fatal("asset metadata headers are missing")
	}
	if got := response.Header().Get("X-Cache"); got != "HIT" {
		t.Fatalf("X-Cache = %q", got)
	}

	second, err := runtime.service.prewarm(context.Background(), synthesisRequest{
		entryID: "vocab:2820690",
		text:    "辞書 アプリ",
		voice:   runtime.cfg.defaultVoice,
		format:  runtime.cfg.defaultFormat,
		speed:   runtime.cfg.defaultSpeed,
	}, false)
	if err != nil {
		t.Fatalf("second prewarm: %v", err)
	}
	if !second.skipped || calls.Load() != 1 {
		t.Fatalf("second prewarm skipped=%v calls=%d", second.skipped, calls.Load())
	}
}

func TestMissingAudioReturns404ThenGeneratesInBackground(t *testing.T) {
	t.Parallel()

	var calls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		calls.Add(1)
		_, _ = response.Write([]byte("generated-on-miss"))
	}))
	defer upstream.Close()
	runtime := newTestRuntime(t, upstream.URL)

	response := performAudioGET(runtime.handler, "app-secret", "/api/v1/dictionary-audio/example/42")
	if response.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404; body=%s", response.Code, response.Body.String())
	}
	if code := readErrorCode(t, response.Body.Bytes()); code != "audio_not_found" {
		t.Fatalf("error code = %q", code)
	}
	if got := response.Header().Get("X-Audio-Generation"); got != "started" {
		t.Fatalf("X-Audio-Generation = %q, want started", got)
	}

	deadline := time.Now().Add(2 * time.Second)
	for {
		response = performAudioGET(runtime.handler, "app-secret", "/api/v1/dictionary-audio/example/42")
		if response.Code == http.StatusOK {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("background audio was not ready; status=%d body=%s", response.Code, response.Body.String())
		}
		time.Sleep(10 * time.Millisecond)
	}
	if response.Body.String() != "generated-on-miss" || calls.Load() != 1 {
		t.Fatalf("body=%q upstream calls=%d", response.Body.String(), calls.Load())
	}
	if got := response.Header().Get("X-Cache"); got != "HIT" {
		t.Fatalf("X-Cache = %q, want HIT", got)
	}
}

func TestDeleteAudioRemovesOnlyRequestedAssetAndAllowsRegeneration(t *testing.T) {
	t.Parallel()

	var calls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		call := calls.Add(1)
		_, _ = fmt.Fprintf(response, "generated-audio-%d", call)
	}))
	defer upstream.Close()
	runtime := newTestRuntime(t, upstream.URL)

	result, err := runtime.service.prewarm(context.Background(), synthesisRequest{
		entryID: "example:42", text: "自然な例文です。", voice: runtime.cfg.defaultVoice,
		format: runtime.cfg.defaultFormat, speed: runtime.cfg.defaultSpeed,
	}, false)
	if err != nil {
		t.Fatalf("prewarm: %v", err)
	}
	objectPath, err := runtime.store.assetPath(result.asset.objectKey)
	if err != nil {
		t.Fatalf("asset path: %v", err)
	}

	unauthorized := performAudioRequest(runtime.handler, http.MethodDelete, "wrong", "/api/v1/dictionary-audio/example/42")
	if unauthorized.Code != http.StatusUnauthorized {
		t.Fatalf("unauthorized DELETE status = %d", unauthorized.Code)
	}

	deleted := performAudioRequest(runtime.handler, http.MethodDelete, "app-secret", "/api/v1/dictionary-audio/example/42")
	if deleted.Code != http.StatusNoContent || deleted.Header().Get("X-Audio-Deleted") != "true" {
		t.Fatalf("DELETE status=%d headers=%v body=%s", deleted.Code, deleted.Header(), deleted.Body.String())
	}
	if _, err := os.Stat(objectPath); !os.IsNotExist(err) {
		t.Fatalf("deleted audio object still exists: %v", err)
	}
	if _, err := runtime.service.readyAsset(context.Background(), "example:42", runtime.cfg.defaultVoice, runtime.cfg.defaultFormat, runtime.cfg.defaultSpeed); err != errAudioNotFound {
		t.Fatalf("readyAsset after DELETE error = %v, want errAudioNotFound", err)
	}

	missing := performAudioRequest(runtime.handler, http.MethodDelete, "app-secret", "/api/v1/dictionary-audio/example/42")
	if missing.Code != http.StatusNoContent || missing.Header().Get("X-Audio-Deleted") != "false" {
		t.Fatalf("idempotent DELETE status=%d headers=%v", missing.Code, missing.Header())
	}

	response := performAudioGET(runtime.handler, "app-secret", "/api/v1/dictionary-audio/example/42")
	if response.Code != http.StatusNotFound || response.Header().Get("X-Audio-Generation") != "started" {
		t.Fatalf("regeneration GET status=%d headers=%v body=%s", response.Code, response.Header(), response.Body.String())
	}
	deadline := time.Now().Add(2 * time.Second)
	for {
		response = performAudioGET(runtime.handler, "app-secret", "/api/v1/dictionary-audio/example/42")
		if response.Code == http.StatusOK {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("regenerated audio was not ready; status=%d body=%s", response.Code, response.Body.String())
		}
		time.Sleep(10 * time.Millisecond)
	}
	if response.Body.String() != "generated-audio-2" || calls.Load() != 2 {
		t.Fatalf("regenerated body=%q upstream calls=%d", response.Body.String(), calls.Load())
	}
}

func TestUnknownContentReturns404WithoutSynthesis(t *testing.T) {
	t.Parallel()

	var calls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		calls.Add(1)
		_, _ = response.Write([]byte("unexpected"))
	}))
	defer upstream.Close()
	runtime := newTestRuntime(t, upstream.URL)

	response := performAudioGET(runtime.handler, "app-secret", "/api/v1/dictionary-audio/example/404404")
	if response.Code != http.StatusNotFound || readErrorCode(t, response.Body.Bytes()) != "entry_not_found" {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
	time.Sleep(20 * time.Millisecond)
	if calls.Load() != 0 {
		t.Fatalf("unknown content triggered %d synthesis calls", calls.Load())
	}
}

func TestTanosUnicodeVocabIDGeneratesAndServesAudio(t *testing.T) {
	t.Parallel()

	upstream := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		_, _ = response.Write([]byte("tanos-audio"))
	}))
	defer upstream.Close()
	runtime := newTestRuntime(t, upstream.URL)
	path := "/api/v1/dictionary-audio/vocab/" + url.PathEscape("t-ありがとう-ありがとう")

	response := performAudioGET(runtime.handler, "app-secret", path)
	if response.Code != http.StatusNotFound || readErrorCode(t, response.Body.Bytes()) != "audio_not_found" {
		t.Fatalf("initial status=%d body=%s", response.Code, response.Body.String())
	}
	deadline := time.Now().Add(2 * time.Second)
	for {
		response = performAudioGET(runtime.handler, "app-secret", path)
		if response.Code == http.StatusOK {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("Tanos audio was not ready; status=%d body=%s", response.Code, response.Body.String())
		}
		time.Sleep(10 * time.Millisecond)
	}
	if response.Body.String() != "tanos-audio" {
		t.Fatalf("body=%q", response.Body.String())
	}
}

func TestValidEntryPart(t *testing.T) {
	t.Parallel()

	tests := []struct {
		kind string
		id   string
		want bool
	}{
		{kind: "vocab", id: "1318610", want: true},
		{kind: "vocab", id: "t-ありがとう-ありがとう", want: true},
		{kind: "vocab", id: "t-こうよう もみじ-こうよう もみじ", want: true},
		{kind: "example", id: "22203", want: true},
		{kind: "example", id: "t-ありがとう-ありがとう", want: false},
		{kind: "vocab", id: "t-bad/path", want: false},
		{kind: "vocab", id: "t-bad%2Fpath", want: false},
	}
	for _, test := range tests {
		if got := validEntryPart(test.kind, test.id); got != test.want {
			t.Errorf("validEntryPart(%q, %q)=%v want %v", test.kind, test.id, got, test.want)
		}
	}
}

func TestIndexedButMissingFileReturns404ThenRegenerates(t *testing.T) {
	t.Parallel()

	var calls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		calls.Add(1)
		_, _ = response.Write([]byte("regenerated-audio"))
	}))
	defer upstream.Close()
	runtime := newTestRuntime(t, upstream.URL)
	result, err := runtime.service.prewarm(context.Background(), synthesisRequest{
		entryID: "example:7", text: "例文です。", voice: runtime.cfg.defaultVoice,
		format: runtime.cfg.defaultFormat, speed: runtime.cfg.defaultSpeed,
	}, false)
	if err != nil {
		t.Fatalf("prewarm: %v", err)
	}
	path, _ := runtime.store.assetPath(result.asset.objectKey)
	if err := os.Remove(path); err != nil {
		t.Fatalf("remove fixture audio: %v", err)
	}

	response := performAudioGET(runtime.handler, "app-secret", "/api/v1/dictionary-audio/example/7")
	if response.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", response.Code)
	}
	if code := readErrorCode(t, response.Body.Bytes()); code != "audio_not_found" {
		t.Fatalf("error code = %q", code)
	}
	if got := response.Header().Get("X-Audio-Generation"); got != "started" {
		t.Fatalf("X-Audio-Generation = %q, want started", got)
	}

	deadline := time.Now().Add(2 * time.Second)
	for {
		response = performAudioGET(runtime.handler, "app-secret", "/api/v1/dictionary-audio/example/7")
		if response.Code == http.StatusOK {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("regenerated audio was not ready; status=%d body=%s", response.Code, response.Body.String())
		}
		time.Sleep(10 * time.Millisecond)
	}
	if response.Body.String() != "regenerated-audio" || calls.Load() != 2 {
		t.Fatalf("body=%q upstream calls=%d", response.Body.String(), calls.Load())
	}
	asset, err := runtime.service.readyAsset(context.Background(), "example:7", runtime.cfg.defaultVoice, runtime.cfg.defaultFormat, runtime.cfg.defaultSpeed)
	if err != nil || asset.sizeBytes != int64(len("regenerated-audio")) {
		t.Fatalf("updated asset=%+v error=%v", asset, err)
	}
}

func TestAuthenticationAndEntryValidation(t *testing.T) {
	t.Parallel()

	upstream := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		_, _ = response.Write([]byte("audio"))
	}))
	defer upstream.Close()
	runtime := newTestRuntime(t, upstream.URL)

	unauthorized := performAudioGET(runtime.handler, "wrong", "/api/v1/dictionary-audio/vocab/1")
	if unauthorized.Code != http.StatusUnauthorized {
		t.Fatalf("unauthorized status = %d", unauthorized.Code)
	}
	invalid := performAudioGET(runtime.handler, "app-secret", "/api/v1/dictionary-audio/kanji/%2E%2E")
	if invalid.Code != http.StatusBadRequest {
		t.Fatalf("invalid status = %d", invalid.Code)
	}
	if code := readErrorCode(t, invalid.Body.Bytes()); code != "invalid_entry_id" {
		t.Fatalf("error code = %q", code)
	}
}

func TestTextOnlyPrewarmOmitsSpeakerCFG(t *testing.T) {
	t.Parallel()

	requests := make(chan irodoriRequest, 1)
	upstream := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		var body irodoriRequest
		if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
			t.Errorf("decode request: %v", err)
		}
		requests <- body
		_, _ = response.Write([]byte("audio"))
	}))
	defer upstream.Close()
	runtime := newTestRuntime(t, upstream.URL)

	_, err := runtime.service.prewarm(context.Background(), synthesisRequest{
		entryID: "vocab:123", text: "辞書", voice: "none", format: "opus", speed: 0.9,
	}, false)
	if err != nil {
		t.Fatalf("prewarm: %v", err)
	}
	body := <-requests
	if body.Irodori.CFGScaleSpeaker != nil {
		t.Fatalf("text-only request sent speaker CFG: %v", *body.Irodori.CFGScaleSpeaker)
	}
}

func TestFailedPrewarmIsNotServed(t *testing.T) {
	t.Parallel()

	upstream := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		http.Error(response, "GPU unavailable", http.StatusServiceUnavailable)
	}))
	defer upstream.Close()
	runtime := newTestRuntime(t, upstream.URL)

	_, err := runtime.service.prewarm(context.Background(), synthesisRequest{
		entryID: "vocab:999", text: "失敗", voice: runtime.cfg.defaultVoice,
		format: runtime.cfg.defaultFormat, speed: runtime.cfg.defaultSpeed,
	}, false)
	if err == nil {
		t.Fatal("prewarm unexpectedly succeeded")
	}
	response := performAudioGET(runtime.handler, "app-secret", "/api/v1/dictionary-audio/vocab/999")
	if response.Code != http.StatusNotFound {
		t.Fatalf("failed asset status = %d, want 404", response.Code)
	}
}

func TestImportCommandIndexesExistingAudioFile(t *testing.T) {
	t.Parallel()

	upstream := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		http.Error(response, "import must not synthesize", http.StatusInternalServerError)
	}))
	defer upstream.Close()
	runtime := newTestRuntime(t, upstream.URL)
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "word.m4a"), []byte("imported-audio"), 0o600); err != nil {
		t.Fatalf("write imported audio: %v", err)
	}
	manifest := filepath.Join(root, "import.jsonl")
	if err := os.WriteFile(manifest, []byte(`{"entry_id":"vocab:99","text":"辞書","file":"word.m4a"}`+"\n"), 0o600); err != nil {
		t.Fatalf("write import manifest: %v", err)
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	if err := runImport(context.Background(), []string{"-manifest", manifest}, runtime.cfg, runtime.service, nil, logger); err != nil {
		t.Fatalf("runImport: %v", err)
	}

	response := performAudioGET(runtime.handler, "app-secret", "/api/v1/dictionary-audio/vocab/99")
	if response.Code != http.StatusOK || response.Body.String() != "imported-audio" {
		t.Fatalf("imported response status=%d body=%q", response.Code, response.Body.String())
	}
}

func TestDeterministicSeedTextNormalizationAndOverrides(t *testing.T) {
	t.Parallel()

	first := deterministicSeed("entry", "voice-v1", "profile-v1")
	second := deterministicSeed("entry", "voice-v1", "profile-v1")
	changed := deterministicSeed("entry", "voice-v2", "profile-v1")
	if first == 0 || first != second || first == changed {
		t.Fatalf("unexpected seeds: first=%d second=%d changed=%d", first, second, changed)
	}
	if got := normalizeText("  辞書\r\n\tアプリ  "); got != "辞書 アプリ" {
		t.Fatalf("normalizeText = %q", got)
	}

	path := filepath.Join(t.TempDir(), "overrides.json")
	if err := os.WriteFile(path, []byte(`{"vocab:1":"  人手\n不足  "}`), 0o600); err != nil {
		t.Fatalf("write override fixture: %v", err)
	}
	overrides, err := loadTextOverrides(path)
	if err != nil {
		t.Fatalf("loadTextOverrides: %v", err)
	}
	if got := overrides["vocab:1"]; got != "人手 不足" {
		t.Fatalf("override text = %q", got)
	}
}

type testRuntime struct {
	cfg     config
	store   *assetStore
	service *audioService
	handler http.Handler
}

func newTestRuntime(t *testing.T, upstreamURL string) testRuntime {
	t.Helper()
	root := t.TempDir()
	cfg := config{
		databasePath:           filepath.Join(root, "tts.db"),
		audioDir:               filepath.Join(root, "audio"),
		defaultVoice:           "dictionary-ja-01",
		defaultFormat:          "m4a",
		defaultSpeed:           1,
		approvedVoices:         map[string]struct{}{"dictionary-ja-01": {}, "none": {}},
		modelRevision:          "model-v1",
		voiceVersion:           "voice-v1",
		profileVersion:         "profile-v1",
		requestTimeout:         2 * time.Second,
		maxConcurrentSynthesis: 1,
		maxAudioBytes:          1024 * 1024,
	}
	store, err := newAssetStore(cfg)
	if err != nil {
		t.Fatalf("new asset store: %v", err)
	}
	t.Cleanup(func() { _ = store.close() })
	client := &irodoriClient{
		baseURL:      upstreamURL,
		apiKey:       "upstream-secret",
		modelName:    "irodori-tts",
		numSteps:     60,
		maxAudioSize: 1024 * 1024,
		httpClient:   &http.Client{Timeout: 2 * time.Second},
	}
	content := &mapContentResolver{values: map[string]string{
		"example:42": "自然な例文です。",
		"example:7":  "例文です。",
		"vocab:t-ありがとう-ありがとう": "ありがとう",
	}}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	service := newAudioService(cfg, store, content, client, nil, logger)
	api := &apiServer{
		service:       service,
		appAPIKey:     "app-secret",
		defaultVoice:  cfg.defaultVoice,
		defaultFormat: cfg.defaultFormat,
		defaultSpeed:  cfg.defaultSpeed,
		logger:        logger,
		rateLimiter:   newFixedWindowLimiter(1000),
	}
	return testRuntime{cfg: cfg, store: store, service: service, handler: api.routes()}
}

type mapContentResolver struct {
	values map[string]string
}

func (r *mapContentResolver) lookupText(_ context.Context, entryID string) (string, error) {
	text, ok := r.values[entryID]
	if !ok {
		return "", errContentNotFound
	}
	return text, nil
}

func (r *mapContentResolver) ping(context.Context) error {
	return nil
}

func performAudioGET(handler http.Handler, token, path string) *httptest.ResponseRecorder {
	return performAudioRequest(handler, http.MethodGet, token, path)
}

func performAudioRequest(handler http.Handler, method, token, path string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, path, nil)
	request.Header.Set("Authorization", "Bearer "+token)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	return response
}

func readErrorCode(t *testing.T, data []byte) string {
	t.Helper()
	var body struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.Unmarshal(data, &body); err != nil {
		t.Fatalf("decode error response: %v", err)
	}
	return body.Error.Code
}
