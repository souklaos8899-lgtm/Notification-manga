import { DatabaseSync } from 'node:sqlite';

export function createSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      id TEXT PRIMARY KEY,
      app_mode TEXT NOT NULL DEFAULT 'personal',
      allow_public_registration INTEGER NOT NULL DEFAULT 0,
      check_interval_minutes INTEGER NOT NULL DEFAULT 60,
      last_global_check_at TEXT
    );

    CREATE TABLE IF NOT EXISTS manga (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      cover_url TEXT,
      status TEXT NOT NULL DEFAULT 'READING',
      last_read_chapter REAL,
      last_read_chapter_title TEXT,
      last_read_at TEXT,
      latest_chapter REAL,
      latest_chapter_title TEXT,
      latest_chapter_url TEXT,
      latest_source_domain TEXT,
      latest_updated_at TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS manga_sources (
      id TEXT PRIMARY KEY,
      manga_id TEXT NOT NULL REFERENCES manga(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      url TEXT NOT NULL,
      domain TEXT NOT NULL,
      is_primary INTEGER NOT NULL DEFAULT 0,
      extraction_mode TEXT NOT NULL,
      fetch_strategy TEXT NOT NULL DEFAULT 'http',
      check_state TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_channels (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      config TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      manga_id TEXT REFERENCES manga(id) ON DELETE SET NULL,
      manga_title TEXT NOT NULL,
      chapter_number REAL,
      chapter_title TEXT NOT NULL,
      chapter_url TEXT NOT NULL,
      channel_name TEXT NOT NULL,
      channel_kind TEXT NOT NULL,
      delivery_status TEXT NOT NULL,
      error_message TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_manga_user_id ON manga(user_id);
    CREATE INDEX IF NOT EXISTS idx_manga_sources_manga_id ON manga_sources(manga_id);
    CREATE INDEX IF NOT EXISTS idx_channels_user_id ON notification_channels(user_id);
    CREATE INDEX IF NOT EXISTS idx_logs_user_id ON notification_logs(user_id);
  `);
}
