package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	cfg, err := loadConfig()
	if err != nil {
		logger.Error("invalid configuration", "error", err)
		os.Exit(1)
	}
	if cfg.appAPIKey == "" {
		logger.Warn("APP_API_KEY is empty; app-facing authentication is disabled")
	}
	if cfg.irodoriAPIKey == "" {
		logger.Warn("IRODORI_API_KEY is empty; upstream authentication is disabled")
	}
	textOverrides, err := loadTextOverrides(cfg.overridesFile)
	if err != nil {
		logger.Error("load TTS text overrides", "error", err)
		os.Exit(1)
	}

	client := &irodoriClient{
		baseURL:      cfg.irodoriBaseURL,
		apiKey:       cfg.irodoriAPIKey,
		modelName:    cfg.modelName,
		numSteps:     cfg.numSteps,
		maxAudioSize: cfg.maxAudioBytes,
		httpClient:   &http.Client{Timeout: cfg.requestTimeout},
	}
	service, err := newAudioService(cfg, client)
	if err != nil {
		logger.Error("initialize audio service", "error", err)
		os.Exit(1)
	}
	api := &apiServer{
		service:        service,
		appAPIKey:      cfg.appAPIKey,
		defaultVoice:   cfg.defaultVoice,
		approvedVoices: cfg.approvedVoices,
		textOverrides:  textOverrides,
		logger:         logger,
		rateLimiter:    newFixedWindowLimiter(cfg.rateLimitPerMinute),
	}

	server := &http.Server{
		Addr:              cfg.addr,
		Handler:           api.routes(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      cfg.requestTimeout + 10*time.Second,
		IdleTimeout:       60 * time.Second,
	}

	shutdownContext, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		<-shutdownContext.Done()
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(ctx); err != nil {
			logger.Error("graceful shutdown failed", "error", err)
		}
	}()

	logger.Info("dictionary TTS API listening", "addr", cfg.addr, "irodori", cfg.irodoriBaseURL, "cache_dir", cfg.cacheDir, "text_overrides", len(textOverrides))
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		logger.Error("server stopped unexpectedly", "error", err)
		os.Exit(1)
	}
}
