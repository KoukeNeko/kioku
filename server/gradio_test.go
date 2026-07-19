package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
	"time"
)

func TestGradioClientGeneratesDownloadsAndTranscodes(t *testing.T) {
	t.Parallel()

	var server *httptest.Server
	server = httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		switch request.URL.Path {
		case "/gradio_api/call/_run_generation":
			var payload struct {
				Data []any `json:"data"`
			}
			if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
				t.Errorf("decode Gradio request: %v", err)
				http.Error(response, "bad body", http.StatusBadRequest)
				return
			}
			if len(payload.Data) != 30 || payload.Data[5] != "自分" || payload.Data[9] != float64(60) || payload.Data[14] != "linear" || payload.Data[17] != float64(3) {
				t.Errorf("unexpected Gradio payload: %#v", payload.Data)
			}
			_, _ = response.Write([]byte(`{"event_id":"event-1"}`))
		case "/gradio_api/call/_run_generation/event-1":
			response.Header().Set("Content-Type", "text/event-stream")
			_, _ = response.Write([]byte("event: complete\ndata: [{\"value\":{\"url\":\"" + server.URL + "/gradio_api/file=audio.wav\"}}]\n\n"))
		case "/gradio_api/file=audio.wav":
			_, _ = response.Write([]byte("wav-audio"))
		default:
			http.NotFound(response, request)
		}
	}))
	defer server.Close()

	client := &gradioClient{
		baseURL:      server.URL,
		checkpoint:   "Aratako/Irodori-TTS-500M-v3",
		numSteps:     60,
		ffmpegPath:   "ffmpeg",
		maxAudioSize: 1024,
		httpClient:   &http.Client{Timeout: 2 * time.Second},
		transcode: func(_ context.Context, wav []byte, format string) ([]byte, error) {
			if string(wav) != "wav-audio" || format != "m4a" {
				t.Fatalf("transcode input=%q format=%q", wav, format)
			}
			return []byte("m4a-audio"), nil
		},
	}
	audio, err := client.synthesize(context.Background(), synthesisRequest{
		entryID: "vocab:1318610",
		text:    "自分",
		voice:   "dictionary-ja-01",
		format:  "m4a",
		speed:   1,
		seed:    1318610,
	})
	if err != nil {
		t.Fatalf("synthesize: %v", err)
	}
	if string(audio) != "m4a-audio" {
		t.Fatalf("audio = %q", audio)
	}
}

func TestOpusTranscodeArgumentsUseCompactSpeechProfile(t *testing.T) {
	t.Parallel()

	got := transcodeArguments("input.wav", "output.opus", "opus")
	want := []string{
		"-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", "input.wav",
		"-ac", "1", "-c:a", "libopus", "-b:a", "32k", "-vbr", "on",
		"-application", "voip", "-compression_level", "10", "-frame_duration", "60",
		"-f", "ogg", "output.opus",
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("transcode arguments = %#v, want %#v", got, want)
	}
}
