import type { DatabaseSync as DatabaseSyncT } from "node:sqlite";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

// Loaded via require so Vite/Vitest does not try to bundle the newer node:sqlite builtin.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

export type DB = DatabaseSyncT;

export function openDb(file: string): DB {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL DEFAULT '',
      headline TEXT, company TEXT, job_title TEXT, website TEXT, phone TEXT,
      linkedin_url TEXT, linkedin_verified INTEGER NOT NULL DEFAULT 0, instagram_handle TEXT,
      avatar_key TEXT, business_card_key TEXT, timezone TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL, starts_on TEXT, place_label TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS events_owner ON events(owner_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      contact_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
      met_at TEXT NOT NULL, lat REAL, lng REAL, place_label TEXT, note TEXT, photo_key TEXT,
      linkedin_clicked_at TEXT, instagram_clicked_at TEXT, reminder_sent_at TEXT, archived_at TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(owner_id, contact_id)
    );
    CREATE INDEX IF NOT EXISTS conn_owner_met ON connections(owner_id, met_at DESC);
    CREATE INDEX IF NOT EXISTS conn_owner_event ON connections(owner_id, event_id);
    CREATE TABLE IF NOT EXISTS magic_tokens (
      id TEXT PRIMARY KEY, email TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL
    );
  `);
  return db;
}

export const now = () => new Date().toISOString();
