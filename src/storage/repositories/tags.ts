import { getDatabase } from '../database.js';
import type { Tag, TagWithCount, EntryTag } from '../../types/index.js';

// Create a new tag
export function createTag(options: {
  name: string;
  color?: string | null;
}): Tag {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO tags (name, color)
    VALUES (?, ?)
  `);
  const result = stmt.run(options.name, options.color ?? null);
  return getTagById(result.lastInsertRowid as number)!;
}

// Get tag by ID
export function getTagById(id: number): Tag | undefined {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM tags WHERE id = ?')
    .get(id) as Tag | undefined;
}

// Get tag by name
export function getTagByName(name: string): Tag | undefined {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM tags WHERE name = ? COLLATE NOCASE')
    .get(name) as Tag | undefined;
}

// Get all tags
export function getAllTags(): Tag[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM tags ORDER BY name').all() as Tag[];
}

// Get tags with usage count
export function getTagsWithCount(): TagWithCount[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT
      t.*,
      COUNT(et.entry_id) as usage_count
    FROM tags t
    LEFT JOIN entry_tags et ON t.id = et.tag_id
    GROUP BY t.id
    ORDER BY usage_count DESC, t.name
  `).all() as TagWithCount[];
}

// Update tag
export function updateTag(
  id: number,
  updates: { name?: string; color?: string | null }
): Tag | undefined {
  const db = getDatabase();
  const fields: string[] = [];
  const values: (string | null)[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.color !== undefined) {
    fields.push('color = ?');
    values.push(updates.color);
  }

  if (fields.length === 0) return getTagById(id);

  values.push(id.toString());
  db.prepare(`UPDATE tags SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getTagById(id);
}

// Delete tag
export function deleteTag(id: number): boolean {
  const db = getDatabase();
  // Entry associations are deleted automatically via CASCADE
  const result = db.prepare('DELETE FROM tags WHERE id = ?').run(id);
  return result.changes > 0;
}

// Attach tag to entry
export function attachTagToEntry(entryId: number, tagId: number): void {
  const db = getDatabase();
  db.prepare(`
    INSERT OR IGNORE INTO entry_tags (entry_id, tag_id)
    VALUES (?, ?)
  `).run(entryId, tagId);
}

// Attach multiple tags to entry
export function attachTagsToEntry(entryId: number, tagIds: number[]): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO entry_tags (entry_id, tag_id)
    VALUES (?, ?)
  `);
  for (const tagId of tagIds) {
    stmt.run(entryId, tagId);
  }
}

// Detach tag from entry
export function detachTagFromEntry(entryId: number, tagId: number): boolean {
  const db = getDatabase();
  const result = db.prepare(`
    DELETE FROM entry_tags WHERE entry_id = ? AND tag_id = ?
  `).run(entryId, tagId);
  return result.changes > 0;
}

// Detach all tags from entry
export function detachAllTagsFromEntry(entryId: number): void {
  const db = getDatabase();
  db.prepare('DELETE FROM entry_tags WHERE entry_id = ?').run(entryId);
}

// Get tags for entry
export function getTagsForEntry(entryId: number): Tag[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT t.*
    FROM tags t
    JOIN entry_tags et ON t.id = et.tag_id
    WHERE et.entry_id = ?
    ORDER BY t.name
  `).all(entryId) as Tag[];
}

// Get entries with a specific tag
export function getEntriesWithTag(
  tagId: number,
  startDate?: string,
  endDate?: string
): number[] {
  const db = getDatabase();
  let sql = `
    SELECT et.entry_id
    FROM entry_tags et
    JOIN time_entries e ON et.entry_id = e.id
    WHERE et.tag_id = ?
  `;

  const params: (number | string)[] = [tagId];
  if (startDate && endDate) {
    sql += ' AND date(e.start_time) >= date(?) AND date(e.start_time) <= date(?)';
    params.push(startDate, endDate);
  }

  sql += ' ORDER BY e.start_time DESC';

  const results = db.prepare(sql).all(...params) as { entry_id: number }[];
  return results.map(r => r.entry_id);
}

// Get or create tag by name
export function getOrCreateTag(name: string, color?: string | null): Tag {
  const existing = getTagByName(name);
  if (existing) return existing;
  return createTag({ name, color });
}

// Parse tag names from comma-separated string and get/create them
export function parseAndGetTags(tagString: string): Tag[] {
  const tagNames = tagString
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0);

  return tagNames.map(name => getOrCreateTag(name));
}

// Get tag summary (time per tag)
export interface TagSummary {
  tag: string;
  color: string | null;
  total_seconds: number;
  entry_count: number;
}

export function getTagSummary(
  startDate: string,
  endDate: string
): TagSummary[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT
      t.name as tag,
      t.color,
      COALESCE(SUM(e.duration_seconds), 0) as total_seconds,
      COUNT(DISTINCT e.id) as entry_count
    FROM tags t
    JOIN entry_tags et ON t.id = et.tag_id
    JOIN time_entries e ON et.entry_id = e.id
    WHERE date(e.start_time) >= date(?)
      AND date(e.start_time) <= date(?)
      AND e.duration_seconds IS NOT NULL
    GROUP BY t.id
    ORDER BY total_seconds DESC
  `).all(startDate, endDate) as TagSummary[];
}
