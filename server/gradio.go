package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type gradioClient struct {
	baseURL      string
	checkpoint   string
	numSteps     int
	ffmpegPath   string
	maxAudioSize int64
	httpClient   *http.Client
	transcode    func(context.Context, []byte, string) ([]byte, error)
}

type gradioQueuedResponse struct {
	EventID string `json:"event_id"`
}

type gradioFileOutput struct {
	Value struct {
		URL string `json:"url"`
	} `json:"value"`
}

func (c *gradioClient) synthesize(ctx context.Context, request synthesisRequest) ([]byte, error) {
	payload := map[string]any{"data": []any{
		c.checkpoint,
		"cuda", "fp32",
		"cuda", "fp32",
		request.text,
		nil, nil, "",
		c.numSteps,
		1,
		fmt.Sprintf("%d", request.seed),
		"",
		1,
		"linear",
		-1,
		"independent",
		3.0,
		5.0,
		"",
		0.5,
		1,
		true,
		"", "", "", "",
		0.9,
		"", "",
	}}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("encode Gradio request: %w", err)
	}

	queuedRequest, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/gradio_api/call/_run_generation", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create Gradio request: %w", err)
	}
	queuedRequest.Header.Set("Content-Type", "application/json")
	queuedResponse, err := c.httpClient.Do(queuedRequest)
	if err != nil {
		return nil, fmt.Errorf("queue Gradio generation: %w", err)
	}
	defer queuedResponse.Body.Close()
	if queuedResponse.StatusCode != http.StatusOK {
		message, _ := io.ReadAll(io.LimitReader(queuedResponse.Body, 4096))
		return nil, fmt.Errorf("Gradio queue returned %s: %s", queuedResponse.Status, string(message))
	}
	var queued gradioQueuedResponse
	if err := json.NewDecoder(queuedResponse.Body).Decode(&queued); err != nil {
		return nil, fmt.Errorf("decode Gradio event ID: %w", err)
	}
	if queued.EventID == "" {
		return nil, fmt.Errorf("decode Gradio event ID: response did not contain event_id")
	}

	resultRequest, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/gradio_api/call/_run_generation/"+url.PathEscape(queued.EventID), nil)
	if err != nil {
		return nil, fmt.Errorf("create Gradio result request: %w", err)
	}
	resultResponse, err := c.httpClient.Do(resultRequest)
	if err != nil {
		return nil, fmt.Errorf("read Gradio result: %w", err)
	}
	defer resultResponse.Body.Close()
	if resultResponse.StatusCode != http.StatusOK {
		message, _ := io.ReadAll(io.LimitReader(resultResponse.Body, 4096))
		return nil, fmt.Errorf("Gradio result returned %s: %s", resultResponse.Status, string(message))
	}

	audioURL, err := readGradioAudioURL(resultResponse.Body)
	if err != nil {
		return nil, err
	}
	wav, err := c.downloadAudio(ctx, audioURL)
	if err != nil {
		return nil, err
	}
	if c.transcode != nil {
		return c.transcode(ctx, wav, request.format)
	}
	return c.transcodeWAV(ctx, wav, request.format)
}

func readGradioAudioURL(reader io.Reader) (string, error) {
	scanner := bufio.NewScanner(reader)
	scanner.Buffer(make([]byte, 64*1024), 2*1024*1024)
	event := ""
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "event: ") {
			event = strings.TrimSpace(strings.TrimPrefix(line, "event: "))
			continue
		}
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data: "))
		if event == "error" {
			return "", fmt.Errorf("Gradio generation failed: %s", data)
		}
		if event != "complete" {
			continue
		}
		var outputs []json.RawMessage
		if err := json.Unmarshal([]byte(data), &outputs); err != nil {
			return "", fmt.Errorf("decode Gradio output: %w", err)
		}
		if len(outputs) == 0 {
			return "", fmt.Errorf("decode Gradio output: response contained no outputs")
		}
		var output gradioFileOutput
		if err := json.Unmarshal(outputs[0], &output); err != nil {
			return "", fmt.Errorf("decode Gradio audio URL: %w", err)
		}
		if output.Value.URL == "" {
			return "", fmt.Errorf("decode Gradio audio URL: response did not contain a URL")
		}
		return output.Value.URL, nil
	}
	if err := scanner.Err(); err != nil {
		return "", fmt.Errorf("read Gradio event stream: %w", err)
	}
	return "", fmt.Errorf("Gradio event stream ended without a completed audio file")
}

func (c *gradioClient) downloadAudio(ctx context.Context, rawURL string) ([]byte, error) {
	base, err := url.Parse(c.baseURL)
	if err != nil {
		return nil, fmt.Errorf("parse Gradio base URL: %w", err)
	}
	audioURL, err := url.Parse(rawURL)
	if err != nil || audioURL.Scheme != base.Scheme || audioURL.Host != base.Host {
		return nil, fmt.Errorf("Gradio returned an untrusted audio URL")
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, audioURL.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("create Gradio audio request: %w", err)
	}
	response, err := c.httpClient.Do(request)
	if err != nil {
		return nil, fmt.Errorf("download Gradio audio: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Gradio audio returned %s", response.Status)
	}
	wav, err := io.ReadAll(io.LimitReader(response.Body, c.maxAudioSize+1))
	if err != nil {
		return nil, fmt.Errorf("read Gradio audio: %w", err)
	}
	if len(wav) == 0 || int64(len(wav)) > c.maxAudioSize {
		return nil, fmt.Errorf("Gradio audio must contain 1 to %d bytes", c.maxAudioSize)
	}
	return wav, nil
}

func (c *gradioClient) transcodeWAV(ctx context.Context, wav []byte, format string) ([]byte, error) {
	directory, err := os.MkdirTemp("", "irodori-transcode-*")
	if err != nil {
		return nil, fmt.Errorf("create transcode directory: %w", err)
	}
	defer os.RemoveAll(directory)
	inputPath := filepath.Join(directory, "input.wav")
	outputPath := filepath.Join(directory, "output."+format)
	if err := os.WriteFile(inputPath, wav, 0o600); err != nil {
		return nil, fmt.Errorf("write transcode input: %w", err)
	}

	// Preserve the complete model output. Silence-based segment removal cannot
	// distinguish hallucinated speech from a legitimate short word followed by
	// a long pause (for example, 「ぜひ お願いします」).
	args := transcodeArguments(inputPath, outputPath, format)
	output, err := exec.CommandContext(ctx, c.ffmpegPath, args...).CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("transcode Gradio WAV: %w: %s", err, strings.TrimSpace(string(output)))
	}
	audio, err := os.ReadFile(outputPath)
	if err != nil {
		return nil, fmt.Errorf("read transcoded audio: %w", err)
	}
	if len(audio) == 0 || int64(len(audio)) > c.maxAudioSize {
		return nil, fmt.Errorf("transcoded audio must contain 1 to %d bytes", c.maxAudioSize)
	}
	return audio, nil
}

func transcodeArguments(inputPath, outputPath, format string) []string {
	args := []string{"-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", inputPath}
	if format == "opus" {
		args = append(args,
			"-ac", "1",
			"-c:a", "libopus",
			"-b:a", "32k",
			"-vbr", "on",
			"-application", "voip",
			"-compression_level", "10",
			"-frame_duration", "60",
			"-f", "ogg",
			outputPath,
		)
	} else if format == "m4a" {
		args = append(args, "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", "-f", "mp4", outputPath)
	} else {
		args = append(args, "-c:a", "aac", "-b:a", "96k", "-f", "adts", outputPath)
	}
	return args
}
