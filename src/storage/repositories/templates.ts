import { getDatabase } from '../database.js';

export interface Template {
  id: number;
  name: string;
  category_id: number | null;
  category_name: string | null;
  project_id: number | null;
  project_name: string | null;
  tags: string | null;  // Comma-separated tag names
  notes: string | null;
  is_favorite: number;
  use_count: number;
  created_at: string;
  updated_at: string;
}

// Ensure templates table exists
function ensureTemplatesTable(): void {
  const db = getDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      category_id INTEGER REFERENCES categories(id),
      project_id INTEGER REFERENCES projects(id),
      tags TEXT,
      notes TEXT,
      is_favorite INTEGER DEFAULT 0,
      use_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

// Create a new template
export function createTemplate(options: {
  name: string;
  categoryId?: number;
  projectId?: number;
  tags?: string;
  notes?: string;
}): Template {
  ensureTemplatesTable();
  const db = getDatabase();

  const result = db.prepare(`
    INSERT INTO templates (name, category_id, project_id, tags, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    options.name,
    options.categoryId ?? null,
    options.projectId ?? null,
    options.tags ?? null,
    options.notes ?? null
  );

  return getTemplateById(result.lastInsertRowid as number)!;
}

// Get template by ID
export function getTemplateById(id: number): Template | null {
  ensureTemplatesTable();
  const db = getDatabase();
  return db.prepare(`
    SELECT
      t.*,
      c.name as category_name,
      p.name as project_name
    FROM templates t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.id = ?
  `).get(id) as Template | null;
}

// Get template by name
export function getTemplateByName(name: string): Template | null {
  ensureTemplatesTable();
  const db = getDatabase();
  return db.prepare(`
    SELECT
      t.*,
      c.name as category_name,
      p.name as project_name
    FROM templates t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.name = ?
  `).get(name) as Template | null;
}

// Get all templates
export function getAllTemplates(options?: { favoritesFirst?: boolean }): Template[] {
  ensureTemplatesTable();
  const db = getDatabase();

  const orderBy = options?.favoritesFirst
    ? 'ORDER BY is_favorite DESC, use_count DESC, name ASC'
    : 'ORDER BY name ASC';

  return db.prepare(`
    SELECT
      t.*,
      c.name as category_name,
      p.name as project_name
    FROM templates t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN projects p ON t.project_id = p.id
    ${orderBy}
  `).all() as Template[];
}

// Update template
export function updateTemplate(id: number, updates: {
  name?: string;
  categoryId?: number | null;
  projectId?: number | null;
  tags?: string | null;
  notes?: string | null;
}): void {
  ensureTemplatesTable();
  const db = getDatabase();

  const sets: string[] = ['updated_at = datetime(\'now\')'];
  const values: (string | number | null)[] = [];

  if (updates.name !== undefined) {
    sets.push('name = ?');
    values.push(updates.name);
  }
  if (updates.categoryId !== undefined) {
    sets.push('category_id = ?');
    values.push(updates.categoryId);
  }
  if (updates.projectId !== undefined) {
    sets.push('project_id = ?');
    values.push(updates.projectId);
  }
  if (updates.tags !== undefined) {
    sets.push('tags = ?');
    values.push(updates.tags);
  }
  if (updates.notes !== undefined) {
    sets.push('notes = ?');
    values.push(updates.notes);
  }

  values.push(id);
  db.prepare(`UPDATE templates SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

// Delete template
export function deleteTemplate(id: number): void {
  ensureTemplatesTable();
  const db = getDatabase();
  db.prepare('DELETE FROM templates WHERE id = ?').run(id);
}

// Toggle favorite
export function toggleTemplateFavorite(id: number): boolean {
  ensureTemplatesTable();
  const db = getDatabase();
  const template = getTemplateById(id);
  if (!template) return false;

  const newFavorite = template.is_favorite ? 0 : 1;
  db.prepare('UPDATE templates SET is_favorite = ? WHERE id = ?').run(newFavorite, id);
  return newFavorite === 1;
}

// Increment use count
export function incrementTemplateUseCount(id: number): void {
  ensureTemplatesTable();
  const db = getDatabase();
  db.prepare('UPDATE templates SET use_count = use_count + 1 WHERE id = ?').run(id);
}

// Get favorite templates
export function getFavoriteTemplates(): Template[] {
  ensureTemplatesTable();
  const db = getDatabase();
  return db.prepare(`
    SELECT
      t.*,
      c.name as category_name,
      p.name as project_name
    FROM templates t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.is_favorite = 1
    ORDER BY use_count DESC, name ASC
  `).all() as Template[];
}

// Get most used templates
export function getMostUsedTemplates(limit: number = 5): Template[] {
  ensureTemplatesTable();
  const db = getDatabase();
  return db.prepare(`
    SELECT
      t.*,
      c.name as category_name,
      p.name as project_name
    FROM templates t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE use_count > 0
    ORDER BY use_count DESC
    LIMIT ?
  `).all(limit) as Template[];
}
