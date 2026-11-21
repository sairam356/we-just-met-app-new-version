import type { DatabaseSync } from "node:sqlite";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import pg from "pg";

type Row = Record<string, any>;

// One small async interface over both databases. SQL is written with `?` placeholders.
export interface DB {
  get(sql: string, ...args: unknown[]): Promise<Row | undefined>;
  all(sql: string, ...args: unknown[]): Promise<Row[]>;
  /** Resolves to the number of rows changed. */
  run(sql: string, ...args: unknown[]): Promise<number>;
  tx<T>(fn: (db: DB) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

const SCHEMA = `
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
  CREATE TABLE IF NOT EXISTS exchange_tokens (
    token TEXT PRIMARY KEY, value TEXT NOT NULL, expires_at TEXT NOT NULL, connection_id TEXT
  );
  CREATE TABLE IF NOT EXISTS files (
    key TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data BLOB NOT NULL, created_at TEXT NOT NULL
  );
`;

function openSqlite(file: string): DB {
  // Loaded lazily via require: bundlers must not resolve node:sqlite, and Postgres deployments never need it.
  const { DatabaseSync: Sqlite } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const raw: DatabaseSync = new Sqlite(file);
  raw.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; ${SCHEMA}`);
  const db: DB = {
    get: async (sql, ...a) => raw.prepare(sql).get(...(a as any[])) as Row | undefined,
    all: async (sql, ...a) => raw.prepare(sql).all(...(a as any[])) as Row[],
    run: async (sql, ...a) => Number(raw.prepare(sql).run(...(a as any[])).changes),
    tx: async (fn) => {
      raw.exec("BEGIN");
      try { const r = await fn(db); raw.exec("COMMIT"); return r; } catch (e) { raw.exec("ROLLBACK"); throw e; }
    },
    close: async () => raw.close(),
  };
  return db;
}

const toPg = (sql: string) => { let i = 0; return sql.replace(/\?/g, () => `$${++i}`); };

async function openPostgres(url: string): Promise<DB> {
  const pool = new pg.Pool({ connectionString: url, max: 3 });
  const wrap = (q: { query: (sql: string, args: unknown[]) => Promise<pg.QueryResult> }, tx: DB["tx"]): DB => ({
    get: async (sql, ...a) => (await q.query(toPg(sql), a)).rows[0],
    all: async (sql, ...a) => (await q.query(toPg(sql), a)).rows,
    run: async (sql, ...a) => (await q.query(toPg(sql), a)).rowCount ?? 0,
    tx,
    close: () => pool.end(),
  });
  const db: DB = wrap(pool, async (fn) => {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      const inTx: DB = wrap(c, (inner) => inner(inTx));
      const r = await fn(inTx);
      await c.query("COMMIT");
      return r;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  });
  // The lock stops two cold starts from creating the tables at the same time.
  const c = await pool.connect();
  try {
    await c.query("SELECT pg_advisory_lock(746101)");
    await c.query(SCHEMA.replace(/\bREAL\b/g, "DOUBLE PRECISION").replace(/\bBLOB\b/g, "BYTEA"));
  } finally {
    await c.query("SELECT pg_advisory_unlock(746101)").catch(() => {});
    c.release();
  }
  return db;
}

/** `target` is a postgres:// URL or a SQLite file path. */
export const openDb = async (target: string): Promise<DB> => (/^postgres(ql)?:\/\//.test(target) ? openPostgres(target) : openSqlite(target));

export const now = () => new Date().toISOString();
