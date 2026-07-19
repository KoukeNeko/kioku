package main

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
	"unicode"
)

type synthesisRequest struct {
	entryID string
	text    string
	voice   string
	format  string
	speed   float64
	seed    uint32
}

type prewarmResult struct {
	asset   audioAsset
	skipped bool
}

type synthesisClient interface {
	synthesize(context.Context, synthesisRequest) ([]byte, error)
}

type audioService struct {
	client         synthesisClient
	store          *assetStore
	content        contentResolver
	textOverrides  map[string]string
	logger         *slog.Logger
	voiceVersion   string
	modelRevision  string
	profileVersion string
	requestTimeout time.Duration
	maxAudioBytes  int64
	synthesisSlots chan struct{}
	flightMu       sync.Mutex
	flights        map[string]struct{}
}

func newAudioService(cfg config, store *assetStore, content contentResolver, client synthesisClient, textOverrides map[string]string, logger *slog.Logger) *audioService {
	return &audioService{
		client:         client,
		store:          store,
		content:        content,
		textOverrides:  textOverrides,
		logger:         logger,
		voiceVersion:   cfg.voiceVersion,
		modelRevision:  cfg.modelRevision,
		profileVersion: cfg.profileVersion,
		requestTimeout: cfg.requestTimeout,
		maxAudioBytes:  cfg.maxAudioBytes,
		synthesisSlots: make(chan struct{}, cfg.maxConcurrentSynthesis),
		flights:        make(map[string]struct{}),
	}
}

// queueMissingAudio resolves canonical text from the same content DB as the App,
// deduplicates concurrent misses, and generates in the background. The caller
// still returns 404 immediately; a later request will serve the ready asset.
func (s *audioService) queueMissingAudio(ctx context.Context, entryID, voice, format string, speed float64) (bool, error) {
	if s.content == nil {
		return false, errContentNotFound
	}
	text, err := s.content.lookupText(ctx, entryID)
	if err != nil {
		return false, err
	}
	if override, ok := s.textOverrides[entryID]; ok {
		text = override
	}
	identity := s.identity(entryID, voice, format, speed)
	flightKey := fmt.Sprintf("%s\x00%s\x00%s\x00%d\x00%s\x00%s\x00%s",
		identity.entryID, identity.voice, identity.format, identity.speedMilli,
		identity.voiceVersion, identity.modelRevision, identity.profileVersion)

	s.flightMu.Lock()
	if _, exists := s.flights[flightKey]; exists {
		s.flightMu.Unlock()
		return false, nil
	}
	s.flights[flightKey] = struct{}{}
	s.flightMu.Unlock()

	go func() {
		generationContext, cancel := context.WithTimeout(context.Background(), s.requestTimeout)
		defer cancel()
		defer func() {
			s.flightMu.Lock()
			delete(s.flights, flightKey)
			s.flightMu.Unlock()
		}()

		result, generationErr := s.prewarm(generationContext, synthesisRequest{
			entryID: entryID,
			text:    text,
			voice:   voice,
			format:  format,
			speed:   speed,
		}, false)
		if generationErr != nil {
			if s.logger != nil {
				s.logger.Error("background audio generation failed", "entry_id", entryID, "error", generationErr)
			}
			return
		}
		if s.logger != nil {
			s.logger.Info("background audio ready", "entry_id", entryID, "bytes", result.asset.sizeBytes, "skipped", result.skipped)
		}
	}()
	return true, nil
}

func (s *audioService) importAudio(ctx context.Context, request synthesisRequest, audio []byte, force bool) (prewarmResult, error) {
	if len(audio) == 0 || int64(len(audio)) > s.maxAudioBytes {
		return prewarmResult{}, fmt.Errorf("audio file must contain 1 to %d bytes", s.maxAudioBytes)
	}
	request.text = normalizeText(request.text)
	request.seed = deterministicSeed(request.entryID, s.voiceVersion, s.profileVersion)
	identity := s.identity(request.entryID, request.voice, request.format, request.speed)
	textHash := sha256Hex([]byte(request.text))

	if !force {
		if existing, err := s.store.lookupReady(ctx, identity); err == nil {
			path, pathErr := s.store.assetPath(existing.objectKey)
			if pathErr == nil && existing.textHash == textHash {
				if info, statErr := os.Stat(path); statErr == nil && info.Mode().IsRegular() && info.Size() == existing.sizeBytes {
					return prewarmResult{asset: existing, skipped: true}, nil
				}
			}
		} else if err != nil && err != errAudioNotFound {
			return prewarmResult{}, err
		}
	}

	objectKey, err := audioObjectKey(request.entryID, request.format)
	if err != nil {
		return prewarmResult{}, err
	}
	if err := s.store.markGenerating(ctx, identity, request.text, textHash); err != nil {
		return prewarmResult{}, err
	}
	path, err := s.store.assetPath(objectKey)
	if err != nil {
		s.recordFailure(identity, err)
		return prewarmResult{}, err
	}
	if err := writeFileAtomic(path, audio); err != nil {
		err = fmt.Errorf("write imported audio object: %w", err)
		s.recordFailure(identity, err)
		return prewarmResult{}, err
	}
	if err := s.store.markReady(ctx, identity, objectKey, sha256Hex(audio), int64(len(audio))); err != nil {
		return prewarmResult{}, err
	}
	asset, err := s.store.lookupReady(ctx, identity)
	if err != nil {
		return prewarmResult{}, err
	}
	return prewarmResult{asset: asset}, nil
}

func (s *audioService) profileID() string {
	return s.modelRevision + ":" + s.voiceVersion + ":" + s.profileVersion
}

func (s *audioService) identity(entryID, voice, format string, speed float64) audioIdentity {
	return audioIdentity{
		entryID:        entryID,
		voice:          voice,
		format:         format,
		speedMilli:     int(speed*1000 + 0.5),
		voiceVersion:   s.voiceVersion,
		modelRevision:  s.modelRevision,
		profileVersion: s.profileVersion,
	}
}

func (s *audioService) readyAsset(ctx context.Context, entryID, voice, format string, speed float64) (audioAsset, error) {
	identity := s.identity(entryID, voice, format, speed)
	asset, err := s.store.lookupReady(ctx, identity)
	if err != nil {
		return audioAsset{}, err
	}
	path, err := s.store.assetPath(asset.objectKey)
	if err != nil {
		s.invalidateAsset(ctx, identity, "invalid audio object key")
		return audioAsset{}, errAudioNotFound
	}
	info, err := os.Stat(path)
	if err != nil || !info.Mode().IsRegular() || info.Size() != asset.sizeBytes {
		reason := "indexed audio file is missing or invalid"
		if err != nil {
			reason += ": " + err.Error()
		}
		s.invalidateAsset(ctx, identity, reason)
		return audioAsset{}, errAudioNotFound
	}
	return asset, nil
}

func (s *audioService) deleteAudio(ctx context.Context, entryID, voice, format string, speed float64) (bool, error) {
	return s.store.deleteAsset(ctx, s.identity(entryID, voice, format, speed))
}

func (s *audioService) invalidateAsset(ctx context.Context, identity audioIdentity, reason string) {
	if err := s.store.markFailed(ctx, identity, reason); err != nil && s.logger != nil {
		s.logger.Error("invalidate audio asset", "entry_id", identity.entryID, "error", err)
	}
}

func (s *audioService) prewarm(ctx context.Context, request synthesisRequest, force bool) (prewarmResult, error) {
	request.text = normalizeText(request.text)
	request.seed = deterministicSeed(request.entryID, s.voiceVersion, s.profileVersion)
	identity := s.identity(request.entryID, request.voice, request.format, request.speed)
	textHash := sha256Hex([]byte(request.text))

	if !force {
		if existing, err := s.store.lookupReady(ctx, identity); err == nil {
			path, pathErr := s.store.assetPath(existing.objectKey)
			if pathErr == nil && existing.textHash == textHash {
				if info, statErr := os.Stat(path); statErr == nil && info.Mode().IsRegular() && info.Size() == existing.sizeBytes {
					return prewarmResult{asset: existing, skipped: true}, nil
				}
			}
		} else if err != nil && err != errAudioNotFound {
			return prewarmResult{}, err
		}
	}

	objectKey, err := audioObjectKey(request.entryID, request.format)
	if err != nil {
		return prewarmResult{}, err
	}
	if err := s.store.markGenerating(ctx, identity, request.text, textHash); err != nil {
		return prewarmResult{}, err
	}

	select {
	case s.synthesisSlots <- struct{}{}:
		defer func() { <-s.synthesisSlots }()
	case <-ctx.Done():
		return prewarmResult{}, ctx.Err()
	}

	generationContext, cancel := context.WithTimeout(ctx, s.requestTimeout)
	defer cancel()
	audio, err := s.client.synthesize(generationContext, request)
	if err != nil {
		s.recordFailure(identity, err)
		return prewarmResult{}, err
	}

	path, err := s.store.assetPath(objectKey)
	if err != nil {
		s.recordFailure(identity, err)
		return prewarmResult{}, err
	}
	if err := writeFileAtomic(path, audio); err != nil {
		err = fmt.Errorf("write audio object: %w", err)
		s.recordFailure(identity, err)
		return prewarmResult{}, err
	}

	etag := sha256Hex(audio)
	if err := s.store.markReady(ctx, identity, objectKey, etag, int64(len(audio))); err != nil {
		return prewarmResult{}, err
	}
	asset, err := s.store.lookupReady(ctx, identity)
	if err != nil {
		return prewarmResult{}, err
	}
	return prewarmResult{asset: asset}, nil
}

func (s *audioService) recordFailure(identity audioIdentity, generationErr error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = s.store.markFailed(ctx, identity, generationErr.Error())
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

func sha256Hex(data []byte) string {
	digest := sha256.Sum256(data)
	return hex.EncodeToString(digest[:])
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
