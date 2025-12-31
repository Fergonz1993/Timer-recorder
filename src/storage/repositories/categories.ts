import { getDatabase } from '../database.js';
import type { Category } from '../../types/index.js';

// Get all categories
export function getAllCategories(): Category[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM categories ORDER BY name').all() as Category[];
}

// Get category by name
export function getCategoryByName(name: string): Category | undefined {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM categories WHERE name = ?')
    .get(name) as Category | undefined;
}

// Get category by ID
export function getCategoryById(id: number): Category | undefined {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM categories WHERE id = ?')
    .get(id) as Category | undefined;
}

// Create new category
export function createCategory(
  name: string,
  color?: string,
  description?: string,
  isProductive = true
): Category {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO categories (name, color, description, is_productive)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(name, color || null, description || null, isProductive ? 1 : 0);
  return getCategoryById(result.lastInsertRowid as number)!;
}

// Delete category
export function deleteCategory(name: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM categories WHERE name = ?').run(name);
  return result.changes > 0;
}

// Update category
export function updateCategory(
  id: number,
  updates: Partial<Pick<Category, 'name' | 'color' | 'description' | 'is_productive'>>
): Category | undefined {
  const db = getDatabase();
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.color !== undefined) {
    fields.push('color = ?');
    values.push(updates.color);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description);
  }
  if (updates.is_productive !== undefined) {
    fields.push('is_productive = ?');
    values.push(updates.is_productive ? 1 : 0);
  }

  if (fields.length === 0) return getCategoryById(id);

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getCategoryById(id);
}
