package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

var errAudioNotFound = errors.New("audio asset not found")

type audioIdentity struct {
	entryID        string
	voice          string
	format         string
	speedMilli     int
	voiceVersion   string
	modelRevision  string
	profileVersion string
}

type audioAsset struct {
	identity  audioIdentity
	text      string
	textHash  string
	objectKey string
	etag      string
	sizeBytes int64
	updatedAt time.Time
}

type readyAssetSummary struct {
	count      int64
	totalBytes int64
}

type assetStore struct {
	db       *sql.DB
	audioDir string
}

func newAssetStore(cfg config) (*assetStore, error) {
	if err := os.MkdirAll(filepath.Dir(cfg.databasePath), 0o755); err != nil {
		return nil, fmt.Errorf("create database directory: %w", err)
	}
	if err := os.MkdirAll(cfg.audioDir, 0o755); err != nil {
		return nil, fmt.Errorf("create audio directory: %w", err)
	}

	db, err := sql.Open("sqlite", cfg.databasePath)
	if err != nil {
		return nil, fmt.Errorf("open audio database: %w", err)
	}
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	store := &assetStore{db: db, audioDir: cfg.audioDir}
	if err := store.migrate(context.Background()); err != nil {
		db.Close()
		return nil, err
	}
	return store, nil
}

func (s *assetStore) migrate(ctx context.Context) error {
	statements := []string{
		`PRAGMA journal_mode = WAL`,
		`PRAGMA busy_timeout = 5000`,
		`CREATE TABLE IF NOT EXISTS audio_assets (
			entry_id TEXT NOT NULL,
			text TEXT NOT NULL,
			text_hash TEXT NOT NULL,
			voice_id TEXT NOT NULL,
			format TEXT NOT NULL,
			speed_milli INTEGER NOT NULL,
			voice_version TEXT NOT NULL,
			model_revision TEXT NOT NULL,
			profile_version TEXT NOT NULL,
			object_key TEXT,
			etag TEXT,
			size_bytes INTEGER,
			status TEXT NOT NULL CHECK (status IN ('generating', 'ready', 'failed')),
			error_message TEXT,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL,
			PRIMARY KEY (
				entry_id, voice_id, format, speed_milli,
				voice_version, model_revision, profile_version
			)
		)`,
		`CREATE INDEX IF NOT EXISTS audio_assets_status_idx ON audio_assets(status, updated_at)`,
	}
	for _, statement := range statements {
		if _, err := s.db.ExecContext(ctx, statement); err != nil {
			return fmt.Errorf("migrate audio database: %w", err)
		}
	}
	return nil
}

func (s *assetStore) close() error {
	return s.db.Close()
}

func (s *assetStore) ping(ctx context.Context) error {
	return s.db.PingContext(ctx)
}

func (s *assetStore) lookupReady(ctx context.Context, identity audioIdentity) (audioAsset, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT text, text_hash, object_key, etag, size_bytes, updated_at
		FROM audio_assets
		WHERE entry_id = ? AND voice_id = ? AND format = ? AND speed_milli = ?
		  AND voice_version = ? AND model_revision = ? AND profile_version = ?
		  AND status = 'ready'`,
		identity.entryID, identity.voice, identity.format, identity.speedMilli,
		identity.voiceVersion, identity.modelRevision, identity.profileVersion,
	)

	var asset audioAsset
	var updatedAt int64
	asset.identity = identity
	if err := row.Scan(&asset.text, &asset.textHash, &asset.objectKey, &asset.etag, &asset.sizeBytes, &updatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return audioAsset{}, errAudioNotFound
		}
		return audioAsset{}, fmt.Errorf("query audio asset: %w", err)
	}
	asset.updatedAt = time.Unix(updatedAt, 0)
	return asset, nil
}

func (s *assetStore) forEachReady(ctx context.Context, profile audioIdentity, visit func(audioAsset) error) error {
	rows, err := s.db.QueryContext(ctx, `
		SELECT entry_id, text, text_hash, object_key, etag, size_bytes, updated_at
		FROM audio_assets
		WHERE voice_id = ? AND format = ? AND speed_milli = ?
		  AND voice_version = ? AND model_revision = ? AND profile_version = ?
		  AND status = 'ready'
		ORDER BY entry_id`,
		profile.voice, profile.format, profile.speedMilli,
		profile.voiceVersion, profile.modelRevision, profile.profileVersion,
	)
	if err != nil {
		return fmt.Errorf("query ready audio assets: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		asset := audioAsset{identity: profile}
		var updatedAt int64
		if err := rows.Scan(
			&asset.identity.entryID, &asset.text, &asset.textHash,
			&asset.objectKey, &asset.etag, &asset.sizeBytes, &updatedAt,
		); err != nil {
			return fmt.Errorf("scan ready audio asset: %w", err)
		}
		asset.updatedAt = time.Unix(updatedAt, 0)
		if err := visit(asset); err != nil {
			return err
		}
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterate ready audio assets: %w", err)
	}
	return nil
}

func (s *assetStore) summarizeReady(ctx context.Context, profile audioIdentity) (readyAssetSummary, error) {
	var summary readyAssetSummary
	err := s.db.QueryRowContext(ctx, `
		SELECT COUNT(*), COALESCE(SUM(size_bytes), 0)
		FROM audio_assets
		WHERE voice_id = ? AND format = ? AND speed_milli = ?
		  AND voice_version = ? AND model_revision = ? AND profile_version = ?
		  AND status = 'ready'`,
		profile.voice, profile.format, profile.speedMilli,
		profile.voiceVersion, profile.modelRevision, profile.profileVersion,
	).Scan(&summary.count, &summary.totalBytes)
	if err != nil {
		return readyAssetSummary{}, fmt.Errorf("summarize ready audio assets: %w", err)
	}
	return summary, nil
}

func (s *assetStore) markGenerating(ctx context.Context, identity audioIdentity, text, textHash string) error {
	now := time.Now().Unix()
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO audio_assets (
			entry_id, text, text_hash, voice_id, format, speed_milli,
			voice_version, model_revision, profile_version,
			status, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'generating', ?, ?)
		ON CONFLICT (
			entry_id, voice_id, format, speed_milli,
			voice_version, model_revision, profile_version
		) DO UPDATE SET
			text = excluded.text,
			text_hash = excluded.text_hash,
			object_key = NULL,
			etag = NULL,
			size_bytes = NULL,
			status = 'generating',
			error_message = NULL,
			updated_at = excluded.updated_at`,
		identity.entryID, text, textHash, identity.voice, identity.format, identity.speedMilli,
		identity.voiceVersion, identity.modelRevision, identity.profileVersion, now, now,
	)
	if err != nil {
		return fmt.Errorf("mark audio generating: %w", err)
	}
	return nil
}

func (s *assetStore) markReady(ctx context.Context, identity audioIdentity, objectKey, etag string, sizeBytes int64) error {
	result, err := s.db.ExecContext(ctx, `
		UPDATE audio_assets
		SET object_key = ?, etag = ?, size_bytes = ?, status = 'ready',
		    error_message = NULL, updated_at = ?
		WHERE entry_id = ? AND voice_id = ? AND format = ? AND speed_milli = ?
		  AND voice_version = ? AND model_revision = ? AND profile_version = ?`,
		objectKey, etag, sizeBytes, time.Now().Unix(),
		identity.entryID, identity.voice, identity.format, identity.speedMilli,
		identity.voiceVersion, identity.modelRevision, identity.profileVersion,
	)
	if err != nil {
		return fmt.Errorf("mark audio ready: %w", err)
	}
	if rows, _ := result.RowsAffected(); rows != 1 {
		return fmt.Errorf("mark audio ready: expected one row, updated %d", rows)
	}
	return nil
}

func (s *assetStore) markFailed(ctx context.Context, identity audioIdentity, message string) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE audio_assets
		SET status = 'failed', error_message = ?, updated_at = ?
		WHERE entry_id = ? AND voice_id = ? AND format = ? AND speed_milli = ?
		  AND voice_version = ? AND model_revision = ? AND profile_version = ?`,
		message, time.Now().Unix(),
		identity.entryID, identity.voice, identity.format, identity.speedMilli,
		identity.voiceVersion, identity.modelRevision, identity.profileVersion,
	)
	if err != nil {
		return fmt.Errorf("mark audio failed: %w", err)
	}
	return nil
}

// deleteAsset removes one indexed profile and its corresponding audio object.
// Missing rows and already-removed files are treated as a successful no-op.
func (s *assetStore) deleteAsset(ctx context.Context, identity audioIdentity) (bool, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT object_key
		FROM audio_assets
		WHERE entry_id = ? AND voice_id = ? AND format = ? AND speed_milli = ?
		  AND voice_version = ? AND model_revision = ? AND profile_version = ?`,
		identity.entryID, identity.voice, identity.format, identity.speedMilli,
		identity.voiceVersion, identity.modelRevision, identity.profileVersion,
	)

	var objectKey sql.NullString
	if err := row.Scan(&objectKey); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		return false, fmt.Errorf("query audio asset for deletion: %w", err)
	}

	if objectKey.Valid && objectKey.String != "" {
		objectPath, err := s.assetPath(objectKey.String)
		if err != nil {
			return false, fmt.Errorf("resolve audio object for deletion: %w", err)
		}
		if err := os.Remove(objectPath); err != nil && !errors.Is(err, os.ErrNotExist) {
			return false, fmt.Errorf("remove audio object: %w", err)
		}
	}

	result, err := s.db.ExecContext(ctx, `
		DELETE FROM audio_assets
		WHERE entry_id = ? AND voice_id = ? AND format = ? AND speed_milli = ?
		  AND voice_version = ? AND model_revision = ? AND profile_version = ?`,
		identity.entryID, identity.voice, identity.format, identity.speedMilli,
		identity.voiceVersion, identity.modelRevision, identity.profileVersion,
	)
	if err != nil {
		return false, fmt.Errorf("delete audio asset index: %w", err)
	}
	deleted, err := result.RowsAffected()
	if err != nil {
		return false, fmt.Errorf("read deleted audio asset count: %w", err)
	}
	return deleted > 0, nil
}

func (s *assetStore) assetPath(objectKey string) (string, error) {
	normalizedKey := strings.ReplaceAll(objectKey, `\`, "/")
	parts := strings.Split(normalizedKey, "/")
	if len(parts) != 2 || path.Clean(normalizedKey) != normalizedKey {
		return "", fmt.Errorf("invalid audio object key")
	}
	kind, filename := parts[0], parts[1]
	extension := path.Ext(filename)
	id := strings.TrimSuffix(filename, extension)
	format := strings.TrimPrefix(extension, ".")
	if !validEntryPart(kind, id) || (format != "m4a" && format != "aac" && format != "opus") {
		return "", fmt.Errorf("invalid audio object key")
	}
	return filepath.Join(s.audioDir, kind, filename), nil
}

func audioObjectKey(entryID, format string) (string, error) {
	kind, id, ok := strings.Cut(entryID, ":")
	if !ok || !validEntryPart(kind, id) || (format != "m4a" && format != "aac" && format != "opus") {
		return "", fmt.Errorf("invalid audio object identity")
	}
	return kind + "/" + id + "." + format, nil
}
