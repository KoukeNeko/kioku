FROM golang:1.24-alpine AS build

WORKDIR /src
COPY go.mod ./
COPY *.go ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/dictionary-tts-api .

FROM alpine:3.21
RUN apk add --no-cache ca-certificates && adduser -D -H -u 10001 app
USER app
WORKDIR /app
COPY --from=build /out/dictionary-tts-api /usr/local/bin/dictionary-tts-api
EXPOSE 8090
VOLUME ["/app/data"]
ENTRYPOINT ["dictionary-tts-api"]
