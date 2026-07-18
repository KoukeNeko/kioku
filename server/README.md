# Nekogo Dictionary TTS API

Go proxy and disk cache in front of the separate Irodori-TTS-Server.

```text
Nekogo app -> this API/cache -> Irodori-TTS-Server
```

The API keeps the Irodori bearer token off client devices, coalesces concurrent cache misses for the same entry, and stores generated audio on disk.

## Run locally

Go 1.22 or newer is required.

```sh
cd server
cp .env.example .env
cp tts-overrides.example.json tts-overrides.json
set -a
. ./.env
set +a
go run .
```

The checked-in example points `IRODORI_BASE_URL` at `http://192.168.50.169:8088`. The Irodori service must be reachable from the machine running this API.

## API

Health check:

```sh
curl http://localhost:8090/healthz
```

Generate or retrieve cached dictionary audio:

```sh
curl http://localhost:8090/api/v1/dictionary-audio \
  -H "Authorization: Bearer $APP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "entry_id": "vocab:n5-0001",
    "text": "ああ",
    "voice": "dictionary-ja-01",
    "format": "aac",
    "speed": 1.0
  }' \
  --output speech.aac
```

Successful responses contain raw audio bytes, an `ETag`, long-lived private cache headers, and `X-Cache: HIT` or `MISS`. Errors use the handoff's JSON error envelope.

## Cache invalidation

Cache keys include normalized text, entry ID, voice, format, speed, deterministic seed, and these version variables:

- `VOICE_VERSION`: increment when the approved reference recording changes.
- `MODEL_REVISION`: change when the Irodori checkpoint changes.
- `PROFILE_VERSION`: increment when synthesis parameters change.

Old objects remain on disk and can be removed later without blocking a rollout.

## Pronunciation overrides

Set `TTS_OVERRIDES_FILE` to a JSON object whose keys are stable `entry_id` values and whose values are human-reviewed synthesis text. Overrides are loaded at startup and replace only the text sent to Irodori; the public request contract remains unchanged.

Do not globally convert Japanese sentences to hiragana. Add an override only after a listening review finds a repeatable misreading.

## Security and production notes

- Set both `APP_API_KEY` and `IRODORI_API_KEY` to different strong secrets.
- Keep Irodori private; expose only this API through TLS or a trusted reverse proxy.
- `APPROVED_VOICES` is an allowlist. The default is `dictionary-ja-01,none`.
- The built-in limiter keys by direct client IP. If deploying behind a proxy, rate-limit at that trusted proxy instead of trusting arbitrary forwarded headers.
- Persist `/app/data` when running the Docker image so generated audio survives restarts.

## Verify

```sh
go test ./...
go vet ./...
```
