package main

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestDictionaryAudioCachesIrodoriResponse(t *testing.T) {
	t.Parallel()

	var calls atomic.Int32
	var upstreamRequest irodoriRequest
	upstream := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		calls.Add(1)
		if request.URL.Path != "/v1/audio/speech" {
			t.Errorf("unexpected upstream path: %s", request.URL.Path)
			http.Error(response, "bad path", http.StatusBadRequest)
			return
		}
		if got := request.Header.Get("Authorization"); got != "Bearer upstream-secret" {
			t.Errorf("unexpected upstream authorization: %q", got)
			http.Error(response, "bad authorization", http.StatusUnauthorized)
			return
		}
		if err := json.NewDecoder(request.Body).Decode(&upstreamRequest); err != nil {
			t.Errorf("decode upstream request: %v", err)
			http.Error(response, "bad body", http.StatusBadRequest)
			return
		}
		response.Header().Set("Content-Type", "audio/aac")
		_, _ = response.Write([]byte("generated-audio"))
	}))
	defer upstream.Close()

	handler := newTestAPI(t, upstream.URL, 1)
	first := performAudioRequest(t, handler, "app-secret", dictionaryAudioRequest{
		EntryID: "vocab:n5-0001",
		Text:    "  辞書\r\nアプリ  ",
		Voice:   "dictionary-ja-01",
		Format:  "aac",
		Speed:   1.0,
	})
	second := performAudioRequest(t, handler, "app-secret", dictionaryAudioRequest{
		EntryID: "vocab:n5-0001",
		Text:    "辞書 アプリ",
		Voice:   "dictionary-ja-01",
		Format:  "aac",
		Speed:   1.0,
	})

	if first.Code != http.StatusOK || second.Code != http.StatusOK {
		t.Fatalf("unexpected statuses: first=%d second=%d", first.Code, second.Code)
	}
	if got := first.Header().Get("X-Cache"); got != "MISS" {
		t.Fatalf("first X-Cache = %q, want MISS", got)
	}
	if got := second.Header().Get("X-Cache"); got != "HIT" {
		t.Fatalf("second X-Cache = %q, want HIT", got)
	}
	if first.Header().Get("ETag") == "" || first.Header().Get("ETag") != second.Header().Get("ETag") {
		t.Fatalf("ETag missing or unstable: %q / %q", first.Header().Get("ETag"), second.Header().Get("ETag"))
	}
	if got := first.Header().Get("Content-Type"); got != "audio/aac" {
		t.Fatalf("Content-Type = %q, want audio/aac", got)
	}
	if calls.Load() != 1 {
		t.Fatalf("upstream calls = %d, want 1", calls.Load())
	}
	if upstreamRequest.Input != "辞書 アプリ" {
		t.Fatalf("normalized upstream text = %q", upstreamRequest.Input)
	}
	if upstreamRequest.Irodori.Seed == 0 {
		t.Fatal("deterministic seed must be positive")
	}
	if upstreamRequest.Irodori.CFGScaleSpeaker == nil || *upstreamRequest.Irodori.CFGScaleSpeaker != 5.0 {
		t.Fatalf("speaker CFG = %v, want 5.0", upstreamRequest.Irodori.CFGScaleSpeaker)
	}
	if !bytes.Equal(first.Body.Bytes(), []byte("generated-audio")) || !bytes.Equal(second.Body.Bytes(), []byte("generated-audio")) {
		t.Fatal("audio body was not preserved")
	}
}

func TestConcurrentCacheMissesAreCoalesced(t *testing.T) {
	t.Parallel()

	var calls atomic.Int32
	started := make(chan struct{})
	release := make(chan struct{})
	upstream := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
		if calls.Add(1) == 1 {
			close(started)
		}
		<-release
		_, _ = response.Write([]byte("one-result"))
	}))
	defer upstream.Close()

	handler := newTestAPI(t, upstream.URL, 1)
	input := dictionaryAudioRequest{EntryID: "example:42", Text: "自然な例文です。", Voice: "dictionary-ja-01", Format: "aac", Speed: 1}

	var first, second *httptest.ResponseRecorder
	var wait sync.WaitGroup
	wait.Add(2)
	go func() {
		defer wait.Done()
		first = performAudioRequest(t, handler, "app-secret", input)
	}()
	<-started
	go func() {
		defer wait.Done()
		second = performAudioRequest(t, handler, "app-secret", input)
	}()
	time.Sleep(50 * time.Millisecond)
	close(release)
	wait.Wait()

	if calls.Load() != 1 {
		t.Fatalf("upstream calls = %d, want 1", calls.Load())
	}
	if first.Code != http.StatusOK || second.Code != http.StatusOK {
		t.Fatalf("unexpected statuses: %d / %d", first.Code, second.Code)
	}
	cacheStates := map[string]bool{first.Header().Get("X-Cache"): true, second.Header().Get("X-Cache"): true}
	if !cacheStates["MISS"] || !cacheStates["HIT"] {
		t.Fatalf("expected one MISS and one HIT, got %q and %q", first.Header().Get("X-Cache"), second.Header().Get("X-Cache"))
	}
}

func TestBusySynthesisQueueReturns503(t *testing.T) {
	t.Parallel()

	started := make(chan struct{})
	release := make(chan struct{})
	var once sync.Once
	upstream := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
		once.Do(func() { close(started) })
		<-release
		_, _ = response.Write([]byte("audio"))
	}))
	defer upstream.Close()

	handler := newTestAPI(t, upstream.URL, 1)
	firstDone := make(chan *httptest.ResponseRecorder, 1)
	go func() {
		firstDone <- performAudioRequest(t, handler, "app-secret", dictionaryAudioRequest{
			EntryID: "vocab:1", Text: "一", Voice: "dictionary-ja-01", Format: "aac", Speed: 1,
		})
	}()
	<-started

	second := performAudioRequest(t, handler, "app-secret", dictionaryAudioRequest{
		EntryID: "vocab:2", Text: "二", Voice: "dictionary-ja-01", Format: "aac", Speed: 1,
	})
	if second.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503; body=%s", second.Code, second.Body.String())
	}
	if code := readErrorCode(t, second.Body.Bytes()); code != "tts_busy" {
		t.Fatalf("error code = %q, want tts_busy", code)
	}
	close(release)
	if first := <-firstDone; first.Code != http.StatusOK {
		t.Fatalf("first status = %d, want 200", first.Code)
	}
}

func TestAuthenticationValidationAndTextOnlyProfile(t *testing.T) {
	t.Parallel()

	upstreamRequests := make(chan irodoriRequest, 1)
	upstream := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		var body irodoriRequest
		if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
			t.Errorf("decode upstream body: %v", err)
			http.Error(response, "bad body", http.StatusBadRequest)
			return
		}
		upstreamRequests <- body
		_, _ = response.Write([]byte("audio"))
	}))
	defer upstream.Close()
	handler := newTestAPI(t, upstream.URL, 1)

	unauthorized := performAudioRequest(t, handler, "wrong", dictionaryAudioRequest{EntryID: "vocab:1", Text: "辞書"})
	if unauthorized.Code != http.StatusUnauthorized {
		t.Fatalf("unauthorized status = %d, want 401", unauthorized.Code)
	}

	invalid := performAudioRequest(t, handler, "app-secret", dictionaryAudioRequest{
		EntryID: "vocab:1", Text: "辞書", Voice: "unapproved", Format: "wav", Speed: 2,
	})
	if invalid.Code != http.StatusBadRequest {
		t.Fatalf("invalid status = %d, want 400", invalid.Code)
	}

	valid := performAudioRequest(t, handler, "app-secret", dictionaryAudioRequest{
		EntryID: "vocab:text-only", Text: "辞書", Voice: "none", Format: "opus", Speed: 0.9,
	})
	if valid.Code != http.StatusOK {
		t.Fatalf("valid status = %d, want 200; body=%s", valid.Code, valid.Body.String())
	}
	upstreamBody := <-upstreamRequests
	if upstreamBody.Irodori.CFGScaleSpeaker != nil {
		t.Fatalf("text-only request unexpectedly sent speaker CFG: %v", *upstreamBody.Irodori.CFGScaleSpeaker)
	}
	if valid.Header().Get("Content-Type") != "audio/ogg" {
		t.Fatalf("opus Content-Type = %q", valid.Header().Get("Content-Type"))
	}
}

func TestDeterministicSeedAndTextNormalization(t *testing.T) {
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
}

func TestLoadTextOverrides(t *testing.T) {
	t.Parallel()

	path := filepath.Join(t.TempDir(), "overrides.json")
	if err := writeFileAtomic(path, []byte(`{"vocab:1":"  人手\n不足  "}`)); err != nil {
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

func newTestAPI(t *testing.T, upstreamURL string, maxConcurrent int) http.Handler {
	t.Helper()
	cfg := config{
		cacheDir:               filepath.Join(t.TempDir(), "cache"),
		modelRevision:          "model-v1",
		voiceVersion:           "voice-v1",
		profileVersion:         "profile-v1",
		requestTimeout:         2 * time.Second,
		maxConcurrentSynthesis: maxConcurrent,
	}
	client := &irodoriClient{
		baseURL:      upstreamURL,
		apiKey:       "upstream-secret",
		modelName:    "irodori-tts",
		numSteps:     60,
		maxAudioSize: 1024 * 1024,
		httpClient:   &http.Client{Timeout: 2 * time.Second},
	}
	service, err := newAudioService(cfg, client)
	if err != nil {
		t.Fatalf("new audio service: %v", err)
	}
	api := &apiServer{
		service:        service,
		appAPIKey:      "app-secret",
		defaultVoice:   "dictionary-ja-01",
		approvedVoices: map[string]struct{}{"dictionary-ja-01": {}, "none": {}},
		textOverrides:  map[string]string{},
		logger:         slog.New(slog.NewTextHandler(io.Discard, nil)),
		rateLimiter:    newFixedWindowLimiter(1000),
	}
	return api.routes()
}

func performAudioRequest(t *testing.T, handler http.Handler, token string, input dictionaryAudioRequest) *httptest.ResponseRecorder {
	t.Helper()
	body, err := json.Marshal(input)
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}
	request := httptest.NewRequest(http.MethodPost, "/api/v1/dictionary-audio", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
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
