package main

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode"
	"unicode/utf8"
)

var numericEntryIDPattern = regexp.MustCompile(`^[0-9]+$`)

func validEntryPart(kind, id string) bool {
	if id == "" || len(id) > 128 || !utf8.ValidString(id) {
		return false
	}
	if kind == "example" {
		return numericEntryIDPattern.MatchString(id)
	}
	if kind != "vocab" || (!numericEntryIDPattern.MatchString(id) && !strings.HasPrefix(id, "t-")) {
		return false
	}
	for _, value := range id {
		if unicode.IsControl(value) || strings.ContainsRune(`/\?#%`, value) {
			return false
		}
	}
	return true
}

type apiServer struct {
	service       *audioService
	appAPIKey     string
	defaultVoice  string
	defaultFormat string
	defaultSpeed  float64
	logger        *slog.Logger
	rateLimiter   *fixedWindowLimiter
}

func (a *apiServer) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", a.handleHealth)
	mux.HandleFunc("GET /api/v1/dictionary-audio/{kind}/{id}", a.handleDictionaryAudio)
	mux.HandleFunc("HEAD /api/v1/dictionary-audio/{kind}/{id}", a.handleDictionaryAudio)
	mux.HandleFunc("DELETE /api/v1/dictionary-audio/{kind}/{id}", a.handleDeleteDictionaryAudio)
	return a.logRequests(mux)
}

func (a *apiServer) handleDeleteDictionaryAudio(response http.ResponseWriter, request *http.Request) {
	if !a.authorized(request) {
		writeAPIError(response, http.StatusUnauthorized, "unauthorized", "Authentication is required.")
		return
	}
	if !a.rateLimiter.allow(clientIP(request)) {
		response.Header().Set("Retry-After", "60")
		writeAPIError(response, http.StatusTooManyRequests, "rate_limited", "Too many requests.")
		return
	}

	kind := request.PathValue("kind")
	id := request.PathValue("id")
	if !validEntryPart(kind, id) {
		writeAPIError(response, http.StatusBadRequest, "invalid_entry_id", "Audio entry must be vocab/<id> or example/<id>.")
		return
	}
	entryID := kind + ":" + id
	deleted, err := a.service.deleteAudio(request.Context(), entryID, a.defaultVoice, a.defaultFormat, a.defaultSpeed)
	if err != nil {
		a.logger.Error("delete audio asset", "entry_id", entryID, "error", err)
		writeAPIError(response, http.StatusServiceUnavailable, "audio_delete_failed", "Audio could not be deleted.")
		return
	}
	response.Header().Set("X-Audio-Deleted", strconv.FormatBool(deleted))
	response.WriteHeader(http.StatusNoContent)
}

func (a *apiServer) handleHealth(response http.ResponseWriter, request *http.Request) {
	ctx, cancel := context.WithTimeout(request.Context(), 2*time.Second)
	defer cancel()
	if err := a.service.store.ping(ctx); err != nil {
		a.logger.Error("audio database health check failed", "error", err)
		writeAPIError(response, http.StatusServiceUnavailable, "database_unavailable", "Audio database is unavailable.")
		return
	}
	if a.service.content == nil {
		a.logger.Error("content database health check failed", "error", "content resolver is not configured")
		writeAPIError(response, http.StatusServiceUnavailable, "content_database_unavailable", "Content database is unavailable.")
		return
	}
	if err := a.service.content.ping(ctx); err != nil {
		a.logger.Error("content database health check failed", "error", err)
		writeAPIError(response, http.StatusServiceUnavailable, "content_database_unavailable", "Content database is unavailable.")
		return
	}
	writeJSON(response, http.StatusOK, map[string]string{
		"status":        "ok",
		"audio_profile": a.service.profileID(),
	})
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

	kind := request.PathValue("kind")
	id := request.PathValue("id")
	if !validEntryPart(kind, id) {
		writeAPIError(response, http.StatusBadRequest, "invalid_entry_id", "Audio entry must be vocab/<id> or example/<id>.")
		return
	}
	entryID := kind + ":" + id
	asset, err := a.service.readyAsset(request.Context(), entryID, a.defaultVoice, a.defaultFormat, a.defaultSpeed)
	if errors.Is(err, errAudioNotFound) {
		a.handleMissingAudio(response, request, entryID)
		return
	}
	if err != nil {
		a.logger.Error("query audio asset", "entry_id", entryID, "error", err)
		writeAPIError(response, http.StatusServiceUnavailable, "audio_unavailable", "Audio is temporarily unavailable.")
		return
	}

	path, err := a.service.store.assetPath(asset.objectKey)
	if err != nil {
		a.logger.Error("invalid audio object key", "entry_id", entryID, "error", err)
		writeAPIError(response, http.StatusServiceUnavailable, "audio_unavailable", "Audio is temporarily unavailable.")
		return
	}
	file, err := os.Open(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			a.service.invalidateAsset(request.Context(), asset.identity, "indexed audio file disappeared before serving")
			a.handleMissingAudio(response, request, entryID)
			return
		}
		a.logger.Error("open indexed audio object", "entry_id", entryID, "path", path, "error", err)
		writeAPIError(response, http.StatusServiceUnavailable, "audio_file_missing", "Indexed audio file is unavailable.")
		return
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil || !info.Mode().IsRegular() || info.Size() != asset.sizeBytes {
		a.service.invalidateAsset(request.Context(), asset.identity, "indexed audio file became invalid before serving")
		a.handleMissingAudio(response, request, entryID)
		return
	}

	response.Header().Set("Content-Type", mediaType(asset.identity.format))
	response.Header().Set("Cache-Control", "private, max-age=31536000, immutable")
	response.Header().Set("ETag", `"`+asset.etag+`"`)
	response.Header().Set("X-Cache", "HIT")
	response.Header().Set("X-Audio-Profile", a.service.profileID())
	http.ServeContent(response, request, asset.objectKey, asset.updatedAt, file)
}

func (a *apiServer) handleMissingAudio(response http.ResponseWriter, request *http.Request, entryID string) {
	started, err := a.service.queueMissingAudio(request.Context(), entryID, a.defaultVoice, a.defaultFormat, a.defaultSpeed)
	if errors.Is(err, errContentNotFound) {
		writeAPIError(response, http.StatusNotFound, "entry_not_found", "Dictionary entry is not available.")
		return
	}
	if err != nil {
		a.logger.Error("queue audio generation", "entry_id", entryID, "error", err)
		writeAPIError(response, http.StatusServiceUnavailable, "audio_generation_unavailable", "Audio generation is temporarily unavailable.")
		return
	}
	if started {
		response.Header().Set("X-Audio-Generation", "started")
	} else {
		response.Header().Set("X-Audio-Generation", "in-progress")
	}
	writeAPIError(response, http.StatusNotFound, "audio_not_found", "Audio is being generated. Retry later.")
}

func mediaType(format string) string {
	if format == "opus" {
		return "audio/ogg"
	}
	if format == "m4a" {
		return "audio/mp4"
	}
	return "audio/aac"
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
