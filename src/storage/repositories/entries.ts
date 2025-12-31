import { getDatabase } from '../database.js';
import type { TimeEntry, ActiveSession, CategorySummary } from '../../types/index.js';

// Create new time entry (start timer)
export function createEntry(options: {
  categoryId?: number | null;
  appName?: string | null;
  appBundleId?: string | null;
  windowTitle?: string | null;
  isManual?: boolean;
  notes?: string | null;
}): TimeEntry {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO time_entries (
      category_id, app_name, app_bundle_id, window_title,
      start_time, is_manual, notes
    )
    VALUES (?, ?, ?, ?, datetime('now', 'localtime'), ?, ?)
  `);
  const result = stmt.run(
    options.categoryId ?? null,
    options.appName ?? null,
    options.appBundleId ?? null,
    options.windowTitle ?? null,
    options.isManual ? 1 : 0,
    options.notes ?? null
  );
  return getEntryById(result.lastInsertRowid as number)!;
}

// Get entry by ID
export function getEntryById(id: number): TimeEntry | undefined {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM time_entries WHERE id = ?')
    .get(id) as TimeEntry | undefined;
}

// Get active (unclosed) entry
export function getActiveEntry(): ActiveSession | undefined {
  const db = getDatabase();
  return db.prepare(`
    SELECT
      e.id,
      e.category_id,
      c.name as category_name,
      e.app_name,
      e.window_title,
      e.start_time,
      e.is_manual
    FROM time_entries e
    LEFT JOIN categories c ON e.category_id = c.id
    WHERE e.end_time IS NULL
    ORDER BY e.start_time DESC
    LIMIT 1
  `).get() as ActiveSession | undefined;
}

// Stop active entry (close timer)
export function stopActiveEntry(): TimeEntry | undefined {
  const db = getDatabase();
  const active = getActiveEntry();
  if (!active) return undefined;

  db.prepare(`
    UPDATE time_entries
    SET
      end_time = datetime('now', 'localtime'),
      duration_seconds = CAST((julianday(datetime('now', 'localtime')) - julianday(start_time)) * 86400 AS INTEGER)
    WHERE id = ?
  `).run(active.id);

  return getEntryById(active.id);
}

// Get entries by date range
export function getEntriesByDateRange(
  startDate: string,
  endDate: string
): TimeEntry[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM time_entries
    WHERE date(start_time) >= date(?) AND date(start_time) <= date(?)
    ORDER BY start_time DESC
  `).all(startDate, endDate) as TimeEntry[];
}

// Get today's entries
export function getTodaysEntries(): TimeEntry[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM time_entries
    WHERE date(start_time) = date('now', 'localtime')
    ORDER BY start_time DESC
  `).all() as TimeEntry[];
}

// Get summary by category for date range
export function getCategorySummary(
  startDate: string,
  endDate: string
): CategorySummary[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT
      COALESCE(c.name, 'uncategorized') as category,
      c.color,
      COALESCE(SUM(e.duration_seconds), 0) as total_seconds,
      COUNT(*) as entry_count
    FROM time_entries e
    LEFT JOIN categories c ON e.category_id = c.id
    WHERE date(e.start_time) >= date(?)
      AND date(e.start_time) <= date(?)
      AND e.duration_seconds IS NOT NULL
    GROUP BY c.id
    ORDER BY total_seconds DESC
  `).all(startDate, endDate) as CategorySummary[];
}

// Get today's summary
export function getTodaySummary(): CategorySummary[] {
  const today = new Date().toISOString().split('T')[0];
  return getCategorySummary(today, today);
}

// Get total time for today
export function getTodayTotalSeconds(): number {
  const db = getDatabase();
  const result = db.prepare(`
    SELECT COALESCE(SUM(duration_seconds), 0) as total
    FROM time_entries
    WHERE date(start_time) = date('now', 'localtime')
      AND duration_seconds IS NOT NULL
  `).get() as { total: number };
  return result.total;
}

// Delete entry
export function deleteEntry(id: number): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM time_entries WHERE id = ?').run(id);
  return result.changes > 0;
}

// Get daily totals for a date range (for weekly chart)
export interface DailyTotal {
  date: string;
  total_seconds: number;
  day_name: string;
}

export function getDailyTotals(startDate: string, endDate: string): DailyTotal[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT
      date(start_time) as date,
      COALESCE(SUM(duration_seconds), 0) as total_seconds,
      CASE strftime('%w', start_time)
        WHEN '0' THEN 'Sun'
        WHEN '1' THEN 'Mon'
        WHEN '2' THEN 'Tue'
        WHEN '3' THEN 'Wed'
        WHEN '4' THEN 'Thu'
        WHEN '5' THEN 'Fri'
        WHEN '6' THEN 'Sat'
      END as day_name
    FROM time_entries
    WHERE date(start_time) >= date(?)
      AND date(start_time) <= date(?)
      AND duration_seconds IS NOT NULL
    GROUP BY date(start_time)
    ORDER BY date(start_time)
  `).all(startDate, endDate) as DailyTotal[];
}

// Get hourly breakdown for heatmap
export interface HourlyBreakdown {
  hour: number;
  total_seconds: number;
}

export function getHourlyBreakdown(startDate: string, endDate: string): HourlyBreakdown[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT
      CAST(strftime('%H', start_time) AS INTEGER) as hour,
      COALESCE(SUM(duration_seconds), 0) as total_seconds
    FROM time_entries
    WHERE date(start_time) >= date(?)
      AND date(start_time) <= date(?)
      AND duration_seconds IS NOT NULL
    GROUP BY hour
    ORDER BY hour
  `).all(startDate, endDate) as HourlyBreakdown[];
}

// Get entries with category names for export
export interface EntryWithCategory extends TimeEntry {
  category_name: string | null;
}

export function getEntriesWithCategories(
  startDate: string,
  endDate: string
): EntryWithCategory[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT
      e.*,
      c.name as category_name
    FROM time_entries e
    LEFT JOIN categories c ON e.category_id = c.id
    WHERE date(e.start_time) >= date(?)
      AND date(e.start_time) <= date(?)
    ORDER BY e.start_time DESC
  `).all(startDate, endDate) as EntryWithCategory[];
}

// Get week date range (Monday to Sunday)
export function getWeekRange(weeksAgo = 0): { start: string; end: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday - (weeksAgo * 7));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  };
}
