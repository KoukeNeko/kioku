package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
)

var errContentNotFound = errors.New("dictionary content not found")

type contentResolver interface {
	lookupText(context.Context, string) (string, error)
	countEntries(context.Context) (int64, error)
	ping(context.Context) error
}

type contentStore struct {
	db *sql.DB
}

func newContentStore(path string) (*contentStore, error) {
	absolutePath, err := filepath.Abs(path)
	if err != nil {
		return nil, fmt.Errorf("resolve content database path: %w", err)
	}
	info, err := os.Stat(absolutePath)
	if err != nil {
		return nil, fmt.Errorf("open content database: %w", err)
	}
	if !info.Mode().IsRegular() {
		return nil, fmt.Errorf("content database is not a regular file: %s", absolutePath)
	}

	dsn := (&url.URL{Scheme: "file", Path: absolutePath, RawQuery: "mode=ro"}).String()
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open content database: %w", err)
	}
	db.SetMaxOpenConns(4)
	db.SetMaxIdleConns(4)
	store := &contentStore{db: db}
	if err := store.ping(context.Background()); err != nil {
		db.Close()
		return nil, fmt.Errorf("validate content database: %w", err)
	}
	return store, nil
}

func (s *contentStore) close() error {
	return s.db.Close()
}

func (s *contentStore) ping(ctx context.Context) error {
	var value int
	return s.db.QueryRowContext(ctx, "SELECT 1 FROM vocab LIMIT 1").Scan(&value)
}

func (s *contentStore) lookupText(ctx context.Context, entryID string) (string, error) {
	kind, id, ok := strings.Cut(entryID, ":")
	if !ok || !validEntryPart(kind, id) {
		return "", errContentNotFound
	}

	var query string
	switch kind {
	case "vocab":
		query = "SELECT expression FROM vocab WHERE id = ?"
	case "example":
		query = "SELECT jp FROM example WHERE id = ?"
	default:
		return "", errContentNotFound
	}

	var text string
	if err := s.db.QueryRowContext(ctx, query, id).Scan(&text); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", errContentNotFound
		}
		return "", fmt.Errorf("query content for %s: %w", entryID, err)
	}
	text = normalizeText(text)
	if text == "" {
		return "", errContentNotFound
	}
	return text, nil
}

func (s *contentStore) countEntries(ctx context.Context) (int64, error) {
	var count int64
	if err := s.db.QueryRowContext(ctx, `
		SELECT (SELECT COUNT(*) FROM vocab) + (SELECT COUNT(*) FROM example)`,
	).Scan(&count); err != nil {
		return 0, fmt.Errorf("count dictionary audio entries: %w", err)
	}
	return count, nil
}
