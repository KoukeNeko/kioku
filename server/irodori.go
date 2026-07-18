package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

type irodoriClient struct {
	baseURL      string
	apiKey       string
	modelName    string
	numSteps     int
	maxAudioSize int64
	httpClient   *http.Client
}

type irodoriRequest struct {
	Model          string         `json:"model"`
	Input          string         `json:"input"`
	Voice          string         `json:"voice"`
	ResponseFormat string         `json:"response_format"`
	Speed          float64        `json:"speed"`
	Irodori        irodoriOptions `json:"irodori"`
}

type irodoriOptions struct {
	NumSteps        int      `json:"num_steps"`
	CFGScaleText    float64  `json:"cfg_scale_text"`
	CFGScaleSpeaker *float64 `json:"cfg_scale_speaker,omitempty"`
	TScheduleMode   string   `json:"t_schedule_mode"`
	Seed            uint32   `json:"seed"`
	ChunkingEnabled bool     `json:"chunking_enabled"`
}

func (c *irodoriClient) synthesize(ctx context.Context, request synthesisRequest) ([]byte, error) {
	options := irodoriOptions{
		NumSteps:        c.numSteps,
		CFGScaleText:    3.0,
		TScheduleMode:   "linear",
		Seed:            request.seed,
		ChunkingEnabled: false,
	}
	if request.voice != "none" {
		speakerScale := 5.0
		options.CFGScaleSpeaker = &speakerScale
	}

	body, err := json.Marshal(irodoriRequest{
		Model:          c.modelName,
		Input:          request.text,
		Voice:          request.voice,
		ResponseFormat: request.format,
		Speed:          request.speed,
		Irodori:        options,
	})
	if err != nil {
		return nil, fmt.Errorf("encode Irodori request: %w", err)
	}

	httpRequest, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/v1/audio/speech", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create Irodori request: %w", err)
	}
	httpRequest.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		httpRequest.Header.Set("Authorization", "Bearer "+c.apiKey)
	}

	response, err := c.httpClient.Do(httpRequest)
	if err != nil {
		return nil, fmt.Errorf("call Irodori: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		message, _ := io.ReadAll(io.LimitReader(response.Body, 4096))
		return nil, fmt.Errorf("Irodori returned %s: %s", response.Status, string(message))
	}

	audio, err := io.ReadAll(io.LimitReader(response.Body, c.maxAudioSize+1))
	if err != nil {
		return nil, fmt.Errorf("read Irodori response: %w", err)
	}
	if int64(len(audio)) > c.maxAudioSize {
		return nil, fmt.Errorf("Irodori response exceeds %d bytes", c.maxAudioSize)
	}
	if len(audio) == 0 {
		return nil, fmt.Errorf("Irodori returned an empty response")
	}
	return audio, nil
}
