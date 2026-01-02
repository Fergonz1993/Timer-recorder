import { beforeAll, afterAll, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { join } from 'path';
import { tmpdir } from 'os';
import { unlinkSync, existsSync } from 'fs';

// Test database path
const TEST_DB_PATH = join(tmpdir(), `timer-record-test-${process.pid}.db`);

let testDb: Database.Database | null = null;

/**
 * Initialize test database with schema
 */
function initTestDatabase(): Database.Database {
  const db = new Database(TEST_DB_PATH);
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    -- Categories table
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      color TEXT,
      description TEXT,
      is_productive INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Time entries table
    CREATE TABLE IF NOT EXISTS time_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER REFERENCES categories(id),
      app_name TEXT,
      app_bundle_id TEXT,
      window_title TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT,
      duration_seconds INTEGER,
      is_manual INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_entries_start_time ON time_entries(start_time);
    CREATE INDEX IF NOT EXISTS idx_entries_category ON time_entries(category_id);
    CREATE INDEX IF NOT EXISTS idx_entries_date ON time_entries(date(start_time));

    -- Categorization rules table
    CREATE TABLE IF NOT EXISTS categorization_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_name_pattern TEXT,
      app_bundle_id TEXT,
      window_title_pattern TEXT,
      category_id INTEGER REFERENCES categories(id),
      priority INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Settings table
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Goals table
    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER REFERENCES categories(id),
      target_seconds INTEGER NOT NULL,
      period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly')),
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Migrations table
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    );

    -- Insert default categories
    INSERT OR IGNORE INTO categories (name, color, description, is_productive) VALUES
      ('programming', '#61AFEF', 'General coding', 1),
      ('debugging', '#E06C75', 'Bug fixing', 1),
      ('meetings', '#BE5046', 'Meetings', 0),
      ('uncategorized', '#5C6370', 'Uncategorized', 0);
  `);

  return db;
}

/**
 * Get test database instance
 */
export function getTestDatabase(): Database.Database {
  if (!testDb) {
    testDb = initTestDatabase();
  }
  return testDb;
}

/**
 * Clear all data from test database
 */
export function clearTestDatabase(): void {
  if (testDb) {
    testDb.exec(`
      DELETE FROM time_entries;
      DELETE FROM goals;
      DELETE FROM categorization_rules;
      DELETE FROM settings;
    `);
  }
}

/**
 * Close and cleanup test database
 */
export function closeTestDatabase(): void {
  if (testDb) {
    testDb.close();
    testDb = null;
  }
  if (existsSync(TEST_DB_PATH)) {
    try {
      unlinkSync(TEST_DB_PATH);
      unlinkSync(TEST_DB_PATH + '-wal');
      unlinkSync(TEST_DB_PATH + '-shm');
    } catch {
      // Ignore cleanup errors
    }
  }
}

// Global setup
beforeAll(() => {
  // Initialize test database
  getTestDatabase();
});

// Clear data between tests
afterEach(() => {
  clearTestDatabase();
});

// Global teardown
afterAll(() => {
  closeTestDatabase();
});
