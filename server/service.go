package main

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
	"unicode"
)

var errSynthesisQueueFull = errors.New("synthesis queue is full")

type synthesisRequest struct {
	entryID string
	text    string
	voice   string
	format  string
	speed   float64
	seed    uint32
}

type audioResult struct {
	data     []byte
	cacheKey string
	cacheHit bool
	format   string
}

type inflightCall struct {
	done   chan struct{}
	result audioResult
	err    error
}

type audioService struct {
	client           *irodoriClient
	cacheDir         string
	modelRevision    string
	voiceVersion     string
	profileVersion   string
	requestTimeout   time.Duration
	synthesisSlots   chan struct{}
	mu               sync.Mutex
	inflightRequests map[string]*inflightCall
}

func newAudioService(cfg config, client *irodoriClient) (*audioService, error) {
	if err := os.MkdirAll(cfg.cacheDir, 0o755); err != nil {
		return nil, fmt.Errorf("create cache directory: %w", err)
	}
	return &audioService{
		client:           client,
		cacheDir:         cfg.cacheDir,
		modelRevision:    cfg.modelRevision,
		voiceVersion:     cfg.voiceVersion,
		profileVersion:   cfg.profileVersion,
		requestTimeout:   cfg.requestTimeout,
		synthesisSlots:   make(chan struct{}, cfg.maxConcurrentSynthesis),
		inflightRequests: make(map[string]*inflightCall),
	}, nil
}

func (s *audioService) getAudio(ctx context.Context, request synthesisRequest) (audioResult, error) {
	request.text = normalizeText(request.text)
	request.seed = deterministicSeed(request.entryID, s.voiceVersion, s.profileVersion)
	cacheKey, err := s.cacheKey(request)
	if err != nil {
		return audioResult{}, err
	}

	if audio, err := os.ReadFile(s.cachePath(cacheKey, request.format)); err == nil {
		return audioResult{data: audio, cacheKey: cacheKey, cacheHit: true, format: request.format}, nil
	} else if !errors.Is(err, os.ErrNotExist) {
		return audioResult{}, fmt.Errorf("read audio cache: %w", err)
	}

	call, leader := s.joinInflight(cacheKey)
	if !leader {
		select {
		case <-ctx.Done():
			return audioResult{}, ctx.Err()
		case <-call.done:
			result := call.result
			result.cacheHit = true
			return result, call.err
		}
	}

	result, err := s.generateAndCache(request, cacheKey)
	s.finishInflight(cacheKey, call, result, err)
	return result, err
}

func (s *audioService) generateAndCache(request synthesisRequest, cacheKey string) (audioResult, error) {
	select {
	case s.synthesisSlots <- struct{}{}:
		defer func() { <-s.synthesisSlots }()
	default:
		return audioResult{}, errSynthesisQueueFull
	}

	generationContext, cancel := context.WithTimeout(context.Background(), s.requestTimeout)
	defer cancel()
	audio, err := s.client.synthesize(generationContext, request)
	if err != nil {
		return audioResult{}, err
	}
	if err := writeFileAtomic(s.cachePath(cacheKey, request.format), audio); err != nil {
		return audioResult{}, fmt.Errorf("write audio cache: %w", err)
	}
	return audioResult{data: audio, cacheKey: cacheKey, cacheHit: false, format: request.format}, nil
}

func (s *audioService) joinInflight(cacheKey string) (*inflightCall, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if call, ok := s.inflightRequests[cacheKey]; ok {
		return call, false
	}
	call := &inflightCall{done: make(chan struct{})}
	s.inflightRequests[cacheKey] = call
	return call, true
}

func (s *audioService) finishInflight(cacheKey string, call *inflightCall, result audioResult, err error) {
	s.mu.Lock()
	call.result = result
	call.err = err
	delete(s.inflightRequests, cacheKey)
	close(call.done)
	s.mu.Unlock()
}

func (s *audioService) cacheKey(request synthesisRequest) (string, error) {
	payload := struct {
		Text           string  `json:"text"`
		EntryID        string  `json:"entry_id"`
		Voice          string  `json:"voice"`
		VoiceVersion   string  `json:"voice_version"`
		ModelRevision  string  `json:"model_revision"`
		ProfileVersion string  `json:"profile_version"`
		Format         string  `json:"format"`
		Speed          float64 `json:"speed"`
		Seed           uint32  `json:"seed"`
	}{
		Text:           request.text,
		EntryID:        request.entryID,
		Voice:          request.voice,
		VoiceVersion:   s.voiceVersion,
		ModelRevision:  s.modelRevision,
		ProfileVersion: s.profileVersion,
		Format:         request.format,
		Speed:          request.speed,
		Seed:           request.seed,
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("encode cache key: %w", err)
	}
	digest := sha256.Sum256(encoded)
	return hex.EncodeToString(digest[:]), nil
}

func (s *audioService) cachePath(cacheKey, format string) string {
	return filepath.Join(s.cacheDir, cacheKey[:2], cacheKey+"."+format)
}

func normalizeText(value string) string {
	value = strings.ReplaceAll(value, "\r\n", "\n")
	value = strings.ReplaceAll(value, "\r", "\n")
	fields := strings.FieldsFunc(value, unicode.IsSpace)
	return strings.Join(fields, " ")
}

func deterministicSeed(entryID, voiceVersion, profileVersion string) uint32 {
	digest := sha256.Sum256([]byte(entryID + "\x00" + voiceVersion + "\x00" + profileVersion))
	seed := binary.BigEndian.Uint32(digest[:4]) & 0x7fffffff
	if seed == 0 {
		return 1
	}
	return seed
}

func writeFileAtomic(path string, data []byte) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	temporary, err := os.CreateTemp(filepath.Dir(path), ".audio-*")
	if err != nil {
		return err
	}
	temporaryPath := temporary.Name()
	defer os.Remove(temporaryPath)
	if err := temporary.Chmod(0o644); err != nil {
		temporary.Close()
		return err
	}
	if _, err := temporary.Write(data); err != nil {
		temporary.Close()
		return err
	}
	if err := temporary.Sync(); err != nil {
		temporary.Close()
		return err
	}
	if err := temporary.Close(); err != nil {
		return err
	}
	return os.Rename(temporaryPath, path)
}

func loadTextOverrides(path string) (map[string]string, error) {
	overrides := make(map[string]string)
	if path == "" {
		return overrides, nil
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(data, &overrides); err != nil {
		return nil, fmt.Errorf("decode %s: %w", path, err)
	}
	for entryID, text := range overrides {
		normalizedText := normalizeText(text)
		if entryID == "" || strings.TrimSpace(entryID) != entryID || normalizedText == "" {
			return nil, fmt.Errorf("override entry IDs and text must not be empty")
		}
		overrides[entryID] = normalizedText
	}
	return overrides, nil
}
