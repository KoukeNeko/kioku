package main

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

type config struct {
	addr                   string
	irodoriAPIMode         string
	irodoriBaseURL         string
	irodoriAPIKey          string
	irodoriCheckpoint      string
	ffmpegPath             string
	appAPIKey              string
	databasePath           string
	contentDatabasePath    string
	audioDir               string
	overridesFile          string
	defaultVoice           string
	defaultFormat          string
	defaultSpeed           float64
	approvedVoices         map[string]struct{}
	modelName              string
	modelRevision          string
	voiceVersion           string
	profileVersion         string
	numSteps               int
	maxConcurrentSynthesis int
	rateLimitPerMinute     int
	requestTimeout         time.Duration
	maxAudioBytes          int64
}

func loadConfig() (config, error) {
	requestTimeout, err := envDuration("IRODORI_REQUEST_TIMEOUT", 5*time.Minute)
	if err != nil {
		return config{}, err
	}

	cfg := config{
		addr:                   envString("SERVER_ADDR", ":8090"),
		irodoriAPIMode:         strings.ToLower(envString("IRODORI_API_MODE", "gradio")),
		irodoriBaseURL:         strings.TrimRight(envString("IRODORI_BASE_URL", "http://192.168.50.169:7860"), "/"),
		irodoriAPIKey:          os.Getenv("IRODORI_API_KEY"),
		irodoriCheckpoint:      envString("IRODORI_GRADIO_CHECKPOINT", "Aratako/Irodori-TTS-500M-v3"),
		ffmpegPath:             envString("FFMPEG_PATH", "ffmpeg"),
		appAPIKey:              os.Getenv("APP_API_KEY"),
		databasePath:           envString("DATABASE_PATH", "./data/tts.db"),
		contentDatabasePath:    envString("CONTENT_DATABASE_PATH", "../assets/db/kioku-content.db"),
		audioDir:               envString("AUDIO_DIR", "./data/audio"),
		overridesFile:          strings.TrimSpace(os.Getenv("TTS_OVERRIDES_FILE")),
		defaultVoice:           envString("DEFAULT_VOICE", "dictionary-ja-01"),
		defaultFormat:          strings.ToLower(envString("DEFAULT_FORMAT", "opus")),
		defaultSpeed:           envFloat("DEFAULT_SPEED", 1.0),
		approvedVoices:         parseSet(envString("APPROVED_VOICES", "dictionary-ja-01,none")),
		modelName:              envString("IRODORI_MODEL_NAME", "irodori-tts"),
		modelRevision:          envString("MODEL_REVISION", "Irodori-TTS-500M-v3"),
		voiceVersion:           envString("VOICE_VERSION", "v1"),
		profileVersion:         envString("PROFILE_VERSION", "quality-v3-opus32-no-trim"),
		numSteps:               envInt("IRODORI_NUM_STEPS", 60),
		maxConcurrentSynthesis: envInt("MAX_CONCURRENT_SYNTHESIS", 1),
		rateLimitPerMinute:     envInt("RATE_LIMIT_PER_MINUTE", 60),
		requestTimeout:         requestTimeout,
		maxAudioBytes:          int64(envInt("MAX_AUDIO_MIB", 16)) * 1024 * 1024,
	}

	if _, err := url.ParseRequestURI(cfg.irodoriBaseURL); err != nil {
		return config{}, fmt.Errorf("IRODORI_BASE_URL is invalid: %w", err)
	}
	if cfg.irodoriAPIMode != "gradio" && cfg.irodoriAPIMode != "openai" {
		return config{}, fmt.Errorf("IRODORI_API_MODE must be gradio or openai")
	}
	if cfg.maxConcurrentSynthesis < 1 {
		return config{}, fmt.Errorf("MAX_CONCURRENT_SYNTHESIS must be at least 1")
	}
	if cfg.rateLimitPerMinute < 0 {
		return config{}, fmt.Errorf("RATE_LIMIT_PER_MINUTE cannot be negative")
	}
	if cfg.numSteps < 1 {
		return config{}, fmt.Errorf("IRODORI_NUM_STEPS must be at least 1")
	}
	if cfg.maxAudioBytes < 1024*1024 {
		return config{}, fmt.Errorf("MAX_AUDIO_MIB must be at least 1")
	}
	if _, ok := cfg.approvedVoices[cfg.defaultVoice]; !ok {
		return config{}, fmt.Errorf("DEFAULT_VOICE must be present in APPROVED_VOICES")
	}
	if cfg.defaultFormat != "m4a" && cfg.defaultFormat != "aac" && cfg.defaultFormat != "opus" {
		return config{}, fmt.Errorf("DEFAULT_FORMAT must be m4a, aac, or opus")
	}
	if cfg.defaultSpeed < 0.8 || cfg.defaultSpeed > 1.2 {
		return config{}, fmt.Errorf("DEFAULT_SPEED must be between 0.8 and 1.2")
	}
	return cfg, nil
}

func envString(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func envInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func envFloat(key string, fallback float64) float64 {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return fallback
	}
	return parsed
}

func envDuration(key string, fallback time.Duration) (time.Duration, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback, nil
	}
	parsed, err := time.ParseDuration(value)
	if err != nil {
		return 0, fmt.Errorf("%s is invalid: %w", key, err)
	}
	return parsed, nil
}

func parseSet(raw string) map[string]struct{} {
	result := make(map[string]struct{})
	for _, value := range strings.Split(raw, ",") {
		if value = strings.TrimSpace(value); value != "" {
			result[value] = struct{}{}
		}
	}
	return result
}
