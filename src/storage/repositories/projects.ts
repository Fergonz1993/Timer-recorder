import { getDatabase } from '../database.js';
import type { Project, ProjectWithStats } from '../../types/index.js';

// Create a new project
export function createProject(options: {
  name: string;
  client?: string | null;
  color?: string | null;
  description?: string | null;
  hourlyRate?: number | null;
  isBillable?: boolean;
}): Project {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO projects (name, client, color, description, hourly_rate, is_billable)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    options.name,
    options.client ?? null,
    options.color ?? null,
    options.description ?? null,
    options.hourlyRate ?? null,
    options.isBillable ? 1 : 0
  );
  return getProjectById(result.lastInsertRowid as number)!;
}

// Get project by ID
export function getProjectById(id: number): Project | undefined {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM projects WHERE id = ?')
    .get(id) as Project | undefined;
}

// Get project by name
export function getProjectByName(name: string): Project | undefined {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM projects WHERE name = ? COLLATE NOCASE')
    .get(name) as Project | undefined;
}

// Get all projects (optionally only active)
export function getAllProjects(activeOnly = true): Project[] {
  const db = getDatabase();
  const sql = activeOnly
    ? 'SELECT * FROM projects WHERE is_active = 1 ORDER BY name'
    : 'SELECT * FROM projects ORDER BY name';
  return db.prepare(sql).all() as Project[];
}

// Get default project
export function getDefaultProject(): Project | undefined {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM projects WHERE is_default = 1 AND is_active = 1')
    .get() as Project | undefined;
}

// Set default project
export function setDefaultProject(id: number): void {
  const db = getDatabase();
  // Clear existing default
  db.prepare('UPDATE projects SET is_default = 0').run();
  // Set new default
  db.prepare('UPDATE projects SET is_default = 1 WHERE id = ?').run(id);
}

// Clear default project
export function clearDefaultProject(): void {
  const db = getDatabase();
  db.prepare('UPDATE projects SET is_default = 0').run();
}

// Update project
export function updateProject(
  id: number,
  updates: {
    name?: string;
    client?: string | null;
    color?: string | null;
    description?: string | null;
    hourlyRate?: number | null;
    isBillable?: boolean;
    isActive?: boolean;
  }
): Project | undefined {
  const db = getDatabase();
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.client !== undefined) {
    fields.push('client = ?');
    values.push(updates.client);
  }
  if (updates.color !== undefined) {
    fields.push('color = ?');
    values.push(updates.color);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description);
  }
  if (updates.hourlyRate !== undefined) {
    fields.push('hourly_rate = ?');
    values.push(updates.hourlyRate);
  }
  if (updates.isBillable !== undefined) {
    fields.push('is_billable = ?');
    values.push(updates.isBillable ? 1 : 0);
  }
  if (updates.isActive !== undefined) {
    fields.push('is_active = ?');
    values.push(updates.isActive ? 1 : 0);
  }

  if (fields.length === 0) return getProjectById(id);

  fields.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getProjectById(id);
}

// Archive project (soft delete)
export function archiveProject(id: number): boolean {
  const db = getDatabase();
  const result = db.prepare(`
    UPDATE projects SET is_active = 0, is_default = 0, updated_at = datetime('now')
    WHERE id = ?
  `).run(id);
  return result.changes > 0;
}

// Delete project (hard delete)
export function deleteProject(id: number): boolean {
  const db = getDatabase();
  // Clear project from entries first
  db.prepare('UPDATE time_entries SET project_id = NULL WHERE project_id = ?').run(id);
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  return result.changes > 0;
}

// Get projects with statistics
export function getProjectsWithStats(
  startDate?: string,
  endDate?: string
): ProjectWithStats[] {
  const db = getDatabase();

  let sql = `
    SELECT
      p.*,
      COALESCE(SUM(e.duration_seconds), 0) as total_seconds,
      COUNT(e.id) as entry_count
    FROM projects p
    LEFT JOIN time_entries e ON p.id = e.project_id
  `;

  const params: string[] = [];
  if (startDate && endDate) {
    sql += ' AND date(e.start_time) >= date(?) AND date(e.start_time) <= date(?)';
    params.push(startDate, endDate);
  }

  sql += `
    WHERE p.is_active = 1
    GROUP BY p.id
    ORDER BY total_seconds DESC
  `;

  return db.prepare(sql).all(...params) as ProjectWithStats[];
}

// Get projects by client
export function getProjectsByClient(client: string): Project[] {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM projects WHERE client = ? COLLATE NOCASE AND is_active = 1 ORDER BY name')
    .all(client) as Project[];
}

// Get unique clients
export function getClients(): string[] {
  const db = getDatabase();
  const results = db
    .prepare('SELECT DISTINCT client FROM projects WHERE client IS NOT NULL ORDER BY client')
    .all() as { client: string }[];
  return results.map(r => r.client);
}
