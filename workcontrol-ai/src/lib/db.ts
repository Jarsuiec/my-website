import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

// Единственная точка доступа к базе. SQL написан максимально стандартно,
// чтобы позже перенести схему на PostgreSQL (см. README → «Миграция на PostgreSQL»).

export const SCHEMA_VERSION = 1;

export function dataDir(): string {
  const dir = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR || "./data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const MIGRATIONS: string[] = [
  /* v1 */ `
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS imports (
    id INTEGER PRIMARY KEY,
    created_at TEXT NOT NULL,
    filename TEXT,
    format TEXT,
    source TEXT,
    added INTEGER NOT NULL DEFAULT 0,
    duplicates INTEGER NOT NULL DEFAULT 0,
    tasks_created INTEGER NOT NULL DEFAULT 0,
    tasks_updated INTEGER NOT NULL DEFAULT 0,
    errors TEXT NOT NULL DEFAULT '[]',
    is_demo INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY,
    fingerprint TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL,
    mailbox TEXT,
    external_id TEXT,
    in_reply_to TEXT,
    references_ids TEXT,
    thread_key TEXT NOT NULL,
    direction TEXT NOT NULL DEFAULT 'unknown',
    direction_hint TEXT,
    counterparty TEXT,
    norm_subject TEXT,
    from_name TEXT,
    from_addr TEXT,
    to_addr TEXT,
    subject TEXT,
    sent_at TEXT,
    body TEXT NOT NULL DEFAULT '',
    order_numbers TEXT NOT NULL DEFAULT '[]',
    tracking_numbers TEXT NOT NULL DEFAULT '[]',
    categories TEXT NOT NULL DEFAULT '[]',
    import_id INTEGER,
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_key);
  CREATE INDEX IF NOT EXISTS idx_messages_ext ON messages(external_id);
  CREATE INDEX IF NOT EXISTS idx_messages_cp ON messages(counterparty, norm_subject);
  CREATE INDEX IF NOT EXISTS idx_messages_source ON messages(source);

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY,
    dedup_key TEXT UNIQUE,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    source TEXT,
    customer_name TEXT,
    customer_contact TEXT,
    order_number TEXT,
    summary TEXT,
    priority TEXT NOT NULL DEFAULT 'normal',
    priority_locked INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'open',
    status_changed_at TEXT,
    stage TEXT,
    next_action TEXT,
    deadline TEXT,
    snoozed_until TEXT,
    thread_key TEXT,
    last_message_at TEXT,
    last_inbound_at TEXT,
    last_outbound_at TEXT,
    last_reply_at TEXT,
    origin TEXT NOT NULL DEFAULT 'manual',
    edited_fields TEXT NOT NULL DEFAULT '[]',
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  CREATE INDEX IF NOT EXISTS idx_tasks_thread ON tasks(thread_key);

  CREATE TABLE IF NOT EXISTS task_messages (
    task_id INTEGER NOT NULL,
    message_id INTEGER NOT NULL,
    PRIMARY KEY (task_id, message_id)
  );

  CREATE TABLE IF NOT EXISTS thread_flags (
    thread_key TEXT PRIMARY KEY,
    dismissed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY,
    task_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_notes_task ON notes(task_id);

  CREATE TABLE IF NOT EXISTS activity (
    id INTEGER PRIMARY KEY,
    task_id INTEGER,
    action TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_activity_task ON activity(task_id);
  CREATE INDEX IF NOT EXISTS idx_activity_time ON activity(created_at);

  CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
    subject, body, from_name, from_addr, to_addr, order_numbers, tracking_numbers,
    content='messages', content_rowid='id', tokenize='unicode61 remove_diacritics 2'
  );
  CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
    INSERT INTO messages_fts(rowid, subject, body, from_name, from_addr, to_addr, order_numbers, tracking_numbers)
    VALUES (new.id, new.subject, new.body, new.from_name, new.from_addr, new.to_addr, new.order_numbers, new.tracking_numbers);
  END;
  CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, subject, body, from_name, from_addr, to_addr, order_numbers, tracking_numbers)
    VALUES ('delete', old.id, old.subject, old.body, old.from_name, old.from_addr, old.to_addr, old.order_numbers, old.tracking_numbers);
  END;
  CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, subject, body, from_name, from_addr, to_addr, order_numbers, tracking_numbers)
    VALUES ('delete', old.id, old.subject, old.body, old.from_name, old.from_addr, old.to_addr, old.order_numbers, old.tracking_numbers);
    INSERT INTO messages_fts(rowid, subject, body, from_name, from_addr, to_addr, order_numbers, tracking_numbers)
    VALUES (new.id, new.subject, new.body, new.from_name, new.from_addr, new.to_addr, new.order_numbers, new.tracking_numbers);
  END;

  CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
    title, summary, customer_name, customer_contact, order_number, next_action,
    content='tasks', content_rowid='id', tokenize='unicode61 remove_diacritics 2'
  );
  CREATE TRIGGER IF NOT EXISTS tasks_ai AFTER INSERT ON tasks BEGIN
    INSERT INTO tasks_fts(rowid, title, summary, customer_name, customer_contact, order_number, next_action)
    VALUES (new.id, new.title, new.summary, new.customer_name, new.customer_contact, new.order_number, new.next_action);
  END;
  CREATE TRIGGER IF NOT EXISTS tasks_ad AFTER DELETE ON tasks BEGIN
    INSERT INTO tasks_fts(tasks_fts, rowid, title, summary, customer_name, customer_contact, order_number, next_action)
    VALUES ('delete', old.id, old.title, old.summary, old.customer_name, old.customer_contact, old.order_number, old.next_action);
  END;
  CREATE TRIGGER IF NOT EXISTS tasks_au AFTER UPDATE ON tasks BEGIN
    INSERT INTO tasks_fts(tasks_fts, rowid, title, summary, customer_name, customer_contact, order_number, next_action)
    VALUES ('delete', old.id, old.title, old.summary, old.customer_name, old.customer_contact, old.order_number, old.next_action);
    INSERT INTO tasks_fts(rowid, title, summary, customer_name, customer_contact, order_number, next_action)
    VALUES (new.id, new.title, new.summary, new.customer_name, new.customer_contact, new.order_number, new.next_action);
  END;
  `,
];

function migrate(db: Database.Database) {
  const current = db.pragma("user_version", { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
}

const g = globalThis as unknown as { __wcDb?: Database.Database; __wcDbPath?: string };

export function dbPath(): string {
  return path.join(dataDir(), "workcontrol.db");
}

export function getDb(): Database.Database {
  const p = dbPath();
  if (g.__wcDb && g.__wcDbPath === p) return g.__wcDb;
  const db = new Database(p);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  migrate(db);
  g.__wcDb = db;
  g.__wcDbPath = p;
  return db;
}

/** Только для тестов: закрыть соединение (например, после смены DATA_DIR). */
export function closeDb() {
  g.__wcDb?.close();
  g.__wcDb = undefined;
  g.__wcDbPath = undefined;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function getSetting(key: string, fallback = ""): string {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? fallback;
}

export function setSetting(key: string, value: string) {
  getDb()
    .prepare("INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, value);
}

export function logActivity(taskId: number | null, action: string, details?: string) {
  getDb()
    .prepare("INSERT INTO activity(task_id, action, details, created_at) VALUES (?, ?, ?, ?)")
    .run(taskId, action, details ?? null, nowIso());
}
