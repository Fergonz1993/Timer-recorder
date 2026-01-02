import Database from 'better-sqlite3';
import { getDatabasePath } from '../config/paths.js';

let db: Database.Database | null = null;

// Get or create database connection
export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = getDatabasePath();
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    runMigrations(db);
  }
  return db;
}

// Close database connection
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// Run database migrations
function runMigrations(database: Database.Database): void {
  // Create migrations table
  database.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `);

  const migrations: { name: string; sql: string }[] = [
    {
      name: '001_initial',
      sql: `
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

        -- Indexes for queries
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
      `,
    },
    {
      name: '002_default_categories',
      sql: `
        -- Programming categories
        INSERT OR IGNORE INTO categories (name, color, description, is_productive) VALUES
          ('programming', '#61AFEF', 'General coding and development', 1),
          ('debugging', '#E06C75', 'Bug fixing and troubleshooting', 1),
          ('code-review', '#98C379', 'PR reviews and reading code', 1),
          ('business-logic', '#C678DD', 'Feature development, core logic', 1),
          ('testing', '#56B6C2', 'Writing and running tests', 1),
          ('research', '#ABB2BF', 'Documentation, Stack Overflow', 1);

        -- Finance categories
        INSERT OR IGNORE INTO categories (name, color, description, is_productive) VALUES
          ('excel-modeling', '#217346', 'Excel and financial models', 1),
          ('presentations', '#D24726', 'PowerPoint and Keynote', 1),
          ('financial-analysis', '#4472C4', 'Analysis work', 1),
          ('valuation', '#7030A0', 'DCF, comparables, valuations', 1);

        -- General categories
        INSERT OR IGNORE INTO categories (name, color, description, is_productive) VALUES
          ('communication', '#E5C07B', 'Slack, Teams, email', 0),
          ('meetings', '#BE5046', 'Zoom, calendar', 0),
          ('uncategorized', '#5C6370', 'Unmatched activities', 0);
      `,
    },
    {
      name: '003_goals',
      sql: `
        -- Goals table for time tracking targets
        CREATE TABLE IF NOT EXISTS goals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
          target_seconds INTEGER NOT NULL,
          period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly')),
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );

        -- Only one active goal per category/period combination
        CREATE UNIQUE INDEX IF NOT EXISTS idx_goals_category_period
        ON goals(category_id, period) WHERE is_active = 1;
      `,
    },
    {
      name: '004_projects',
      sql: `
        -- Projects table for organizing work
        CREATE TABLE IF NOT EXISTS projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          client TEXT,
          color TEXT,
          description TEXT,
          hourly_rate REAL,
          is_billable INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1,
          is_default INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );

        -- Add project_id to time_entries
        ALTER TABLE time_entries ADD COLUMN project_id INTEGER REFERENCES projects(id);

        -- Index for project queries
        CREATE INDEX IF NOT EXISTS idx_entries_project ON time_entries(project_id);
        CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client);
      `,
    },
    {
      name: '005_tags',
      sql: `
        -- Tags table for flexible labeling
        CREATE TABLE IF NOT EXISTS tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          color TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );

        -- Junction table for many-to-many relationship
        CREATE TABLE IF NOT EXISTS entry_tags (
          entry_id INTEGER NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
          tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
          created_at TEXT DEFAULT (datetime('now')),
          PRIMARY KEY (entry_id, tag_id)
        );

        -- Indexes for tag queries
        CREATE INDEX IF NOT EXISTS idx_entry_tags_entry ON entry_tags(entry_id);
        CREATE INDEX IF NOT EXISTS idx_entry_tags_tag ON entry_tags(tag_id);
      `,
    },
  ];

  // Check which migrations have been applied
  const appliedMigrations = database
    .prepare('SELECT name FROM migrations')
    .all() as { name: string }[];
  const appliedNames = new Set(appliedMigrations.map((m) => m.name));

  // Apply pending migrations
  for (const migration of migrations) {
    if (!appliedNames.has(migration.name)) {
      database.exec(migration.sql);
      database
        .prepare('INSERT INTO migrations (name) VALUES (?)')
        .run(migration.name);
      console.log(`Applied migration: ${migration.name}`);
    }
  }
}
