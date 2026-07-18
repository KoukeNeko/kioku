package main

import (
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

const maxRequestBodyBytes = 32 * 1024

type dictionaryAudioRequest struct {
	EntryID string  `json:"entry_id"`
	Text    string  `json:"text"`
	Voice   string  `json:"voice"`
	Format  string  `json:"format"`
	Speed   float64 `json:"speed"`
}

type apiServer struct {
	service        *audioService
	appAPIKey      string
	defaultVoice   string
	approvedVoices map[string]struct{}
	textOverrides  map[string]string
	logger         *slog.Logger
	rateLimiter    *fixedWindowLimiter
}

func (a *apiServer) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", a.handleHealth)
	mux.HandleFunc("POST /api/v1/dictionary-audio", a.handleDictionaryAudio)
	return a.logRequests(mux)
}

func (a *apiServer) handleHealth(response http.ResponseWriter, _ *http.Request) {
	writeJSON(response, http.StatusOK, map[string]string{"status": "ok"})
}

func (a *apiServer) handleDictionaryAudio(response http.ResponseWriter, request *http.Request) {
	if !a.authorized(request) {
		writeAPIError(response, http.StatusUnauthorized, "unauthorized", "Authentication is required.")
		return
	}
	if !a.rateLimiter.allow(clientIP(request)) {
		response.Header().Set("Retry-After", "60")
		writeAPIError(response, http.StatusTooManyRequests, "rate_limited", "Too many requests.")
		return
	}

	var input dictionaryAudioRequest
	decoder := json.NewDecoder(http.MaxBytesReader(response, request.Body, maxRequestBodyBytes))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		writeAPIError(response, http.StatusBadRequest, "invalid_request", "Request body must be valid JSON.")
		return
	}
	if err := ensureJSONEOF(decoder); err != nil {
		writeAPIError(response, http.StatusBadRequest, "invalid_request", "Request body must contain exactly one JSON object.")
		return
	}

	input.EntryID = strings.TrimSpace(input.EntryID)
	input.Text = normalizeText(input.Text)
	input.Voice = strings.TrimSpace(input.Voice)
	input.Format = strings.ToLower(strings.TrimSpace(input.Format))
	if input.Voice == "" {
		input.Voice = a.defaultVoice
	}
	if input.Format == "" {
		input.Format = "aac"
	}
	if input.Speed == 0 {
		input.Speed = 1.0
	}
	if override, ok := a.textOverrides[input.EntryID]; ok {
		input.Text = normalizeText(override)
	}
	if code, message := a.validate(input); code != "" {
		writeAPIError(response, http.StatusBadRequest, code, message)
		return
	}

	result, err := a.service.getAudio(request.Context(), synthesisRequest{
		entryID: input.EntryID,
		text:    input.Text,
		voice:   input.Voice,
		format:  input.Format,
		speed:   input.Speed,
	})
	if err != nil {
		if errors.Is(err, errSynthesisQueueFull) {
			writeAPIError(response, http.StatusServiceUnavailable, "tts_busy", "Speech generation is busy. Please retry shortly.")
			return
		}
		if errors.Is(err, request.Context().Err()) {
			return
		}
		a.logger.Error("speech synthesis failed", "entry_id", input.EntryID, "error", err)
		writeAPIError(response, http.StatusServiceUnavailable, "tts_unavailable", "Speech generation is temporarily unavailable.")
		return
	}

	response.Header().Set("Content-Type", mediaType(result.format))
	response.Header().Set("Cache-Control", "private, max-age=31536000, immutable")
	response.Header().Set("ETag", `"`+result.cacheKey+`"`)
	if result.cacheHit {
		response.Header().Set("X-Cache", "HIT")
	} else {
		response.Header().Set("X-Cache", "MISS")
	}
	response.Header().Set("Content-Length", strconv.Itoa(len(result.data)))
	response.WriteHeader(http.StatusOK)
	_, _ = response.Write(result.data)
}

func (a *apiServer) validate(input dictionaryAudioRequest) (string, string) {
	if input.EntryID == "" || len(input.EntryID) > 256 {
		return "invalid_entry_id", "entry_id is required and must not exceed 256 bytes."
	}
	if input.Text == "" || len(input.Text) > 4000 {
		return "invalid_text", "text is required and must not exceed 4000 bytes."
	}
	if _, ok := a.approvedVoices[input.Voice]; !ok {
		return "invalid_voice", "voice is not approved."
	}
	if input.Format != "opus" && input.Format != "aac" {
		return "invalid_format", "format must be opus or aac."
	}
	if input.Speed < 0.8 || input.Speed > 1.2 {
		return "invalid_speed", "speed must be between 0.8 and 1.2."
	}
	return "", ""
}

func (a *apiServer) authorized(request *http.Request) bool {
	if a.appAPIKey == "" {
		return true
	}
	const prefix = "Bearer "
	header := request.Header.Get("Authorization")
	if !strings.HasPrefix(header, prefix) {
		return false
	}
	provided := strings.TrimSpace(strings.TrimPrefix(header, prefix))
	return subtle.ConstantTimeCompare([]byte(provided), []byte(a.appAPIKey)) == 1
}

func (a *apiServer) logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		started := time.Now()
		next.ServeHTTP(response, request)
		a.logger.Info("request", "method", request.Method, "path", request.URL.Path, "remote", clientIP(request), "duration", time.Since(started))
	})
}

func ensureJSONEOF(decoder *json.Decoder) error {
	var extra any
	if err := decoder.Decode(&extra); err != io.EOF {
		if err == nil {
			return fmt.Errorf("unexpected second JSON value")
		}
		return err
	}
	return nil
}

func mediaType(format string) string {
	if format == "opus" {
		return "audio/ogg"
	}
	return "audio/aac"
}

func writeAPIError(response http.ResponseWriter, status int, code, message string) {
	writeJSON(response, status, map[string]any{
		"error": map[string]string{
			"code":    code,
			"message": message,
		},
	})
}

func writeJSON(response http.ResponseWriter, status int, value any) {
	response.Header().Set("Content-Type", "application/json; charset=utf-8")
	response.WriteHeader(status)
	_ = json.NewEncoder(response).Encode(value)
}

func clientIP(request *http.Request) string {
	host, _, err := net.SplitHostPort(request.RemoteAddr)
	if err == nil {
		return host
	}
	return request.RemoteAddr
}

type rateWindow struct {
	started time.Time
	count   int
}

type fixedWindowLimiter struct {
	limit   int
	mu      sync.Mutex
	clients map[string]rateWindow
	now     func() time.Time
}

func newFixedWindowLimiter(limit int) *fixedWindowLimiter {
	return &fixedWindowLimiter{limit: limit, clients: make(map[string]rateWindow), now: time.Now}
}

func (l *fixedWindowLimiter) allow(client string) bool {
	if l.limit == 0 {
		return true
	}
	now := l.now()
	l.mu.Lock()
	defer l.mu.Unlock()
	window := l.clients[client]
	if window.started.IsZero() || now.Sub(window.started) >= time.Minute {
		l.clients[client] = rateWindow{started: now, count: 1}
		return true
	}
	if window.count >= l.limit {
		return false
	}
	window.count++
	l.clients[client] = window
	return true
}
