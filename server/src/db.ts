/**
 * SQLite database module
 * Uses better-sqlite3 for synchronous, fast queries
 */

import Database, { Database as DatabaseType } from 'better-sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '../data/reis.db');

// Initialize database with WAL mode for better concurrency
const db: DatabaseType = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    association_id TEXT NOT NULL,
    last_notification_at TEXT,
    is_superadmin INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    association_id TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    link TEXT,
    priority TEXT DEFAULT 'normal',
    status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    approved_at TEXT,
    view_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
  CREATE INDEX IF NOT EXISTS idx_notifications_expires ON notifications(expires_at);
  CREATE INDEX IF NOT EXISTS idx_notifications_association ON notifications(association_id);
`);

console.log('[DB] Database initialized at', DB_PATH);

export default db;
