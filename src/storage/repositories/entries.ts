import { getDatabase } from '../database.js';
import type { TimeEntry, ActiveSession, CategorySummary } from '../../types/index.js';

// Create new time entry (start timer)
export function createEntry(options: {
  categoryId?: number | null;
  projectId?: number | null;
  appName?: string | null;
  appBundleId?: string | null;
  windowTitle?: string | null;
  isManual?: boolean;
  notes?: string | null;
}): TimeEntry {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO time_entries (
      category_id, project_id, app_name, app_bundle_id, window_title,
      start_time, is_manual, notes
    )
    VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'), ?, ?)
  `);
  const result = stmt.run(
    options.categoryId ?? null,
    options.projectId ?? null,
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

// Filter options for queries
export interface FilterOptions {
  projectId?: number;
  tagIds?: number[];
}

// Get summary by category with filters
export function getCategorySummaryFiltered(
  startDate: string,
  endDate: string,
  filters?: FilterOptions
): CategorySummary[] {
  const db = getDatabase();

  let sql = `
    SELECT
      COALESCE(c.name, 'uncategorized') as category,
      c.color,
      COALESCE(SUM(e.duration_seconds), 0) as total_seconds,
      COUNT(DISTINCT e.id) as entry_count
    FROM time_entries e
    LEFT JOIN categories c ON e.category_id = c.id
  `;

  const params: (string | number)[] = [];
  const conditions: string[] = [
    "date(e.start_time) >= date(?)",
    "date(e.start_time) <= date(?)",
    "e.duration_seconds IS NOT NULL"
  ];
  params.push(startDate, endDate);

  // Add tag filter (join with entry_tags)
  if (filters?.tagIds && filters.tagIds.length > 0) {
    sql += ` JOIN entry_tags et ON e.id = et.entry_id`;
    conditions.push(`et.tag_id IN (${filters.tagIds.map(() => '?').join(',')})`);
    params.push(...filters.tagIds);
  }

  // Add project filter
  if (filters?.projectId) {
    conditions.push("e.project_id = ?");
    params.push(filters.projectId);
  }

  sql += ` WHERE ${conditions.join(' AND ')}`;
  sql += ` GROUP BY c.id ORDER BY total_seconds DESC`;

  return db.prepare(sql).all(...params) as CategorySummary[];
}

// Get total seconds with filters
export function getTotalSecondsFiltered(
  startDate: string,
  endDate: string,
  filters?: FilterOptions
): number {
  const db = getDatabase();

  let sql = `
    SELECT COALESCE(SUM(e.duration_seconds), 0) as total
    FROM time_entries e
  `;

  const params: (string | number)[] = [];
  const conditions: string[] = [
    "date(e.start_time) >= date(?)",
    "date(e.start_time) <= date(?)",
    "e.duration_seconds IS NOT NULL"
  ];
  params.push(startDate, endDate);

  // Add tag filter
  if (filters?.tagIds && filters.tagIds.length > 0) {
    sql += ` JOIN entry_tags et ON e.id = et.entry_id`;
    conditions.push(`et.tag_id IN (${filters.tagIds.map(() => '?').join(',')})`);
    params.push(...filters.tagIds);
  }

  // Add project filter
  if (filters?.projectId) {
    conditions.push("e.project_id = ?");
    params.push(filters.projectId);
  }

  sql += ` WHERE ${conditions.join(' AND ')}`;

  const result = db.prepare(sql).get(...params) as { total: number };
  return result.total;
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

// Update an existing entry
export function updateEntry(
  id: number,
  updates: {
    categoryId?: number | null;
    startTime?: string;
    endTime?: string;
    durationSeconds?: number;
    notes?: string | null;
  }
): TimeEntry | undefined {
  const db = getDatabase();
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (updates.categoryId !== undefined) {
    fields.push('category_id = ?');
    values.push(updates.categoryId);
  }
  if (updates.startTime !== undefined) {
    fields.push('start_time = ?');
    values.push(updates.startTime);
  }
  if (updates.endTime !== undefined) {
    fields.push('end_time = ?');
    values.push(updates.endTime);
  }
  if (updates.durationSeconds !== undefined) {
    fields.push('duration_seconds = ?');
    values.push(updates.durationSeconds);
  }
  if (updates.notes !== undefined) {
    fields.push('notes = ?');
    values.push(updates.notes);
  }

  if (fields.length === 0) return getEntryById(id);

  values.push(id);
  db.prepare(`UPDATE time_entries SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getEntryById(id);
}

// Get recent entries with category names (for list command)
export function getRecentEntriesWithCategories(limit = 20): EntryWithCategory[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT
      e.*,
      c.name as category_name
    FROM time_entries e
    LEFT JOIN categories c ON e.category_id = c.id
    ORDER BY e.start_time DESC
    LIMIT ?
  `).all(limit) as EntryWithCategory[];
}

// Get month date range
export function getMonthRange(monthsAgo = 0): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() - monthsAgo;

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  return {
    start: firstDay.toISOString().split('T')[0],
    end: lastDay.toISOString().split('T')[0],
  };
}

// Monthly totals for comparison
export interface MonthlyTotal {
  month: string;
  year: number;
  month_num: number;
  total_seconds: number;
}

export function getMonthlyTotals(months: number): MonthlyTotal[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT
      strftime('%Y-%m', start_time) as month,
      CAST(strftime('%Y', start_time) AS INTEGER) as year,
      CAST(strftime('%m', start_time) AS INTEGER) as month_num,
      COALESCE(SUM(duration_seconds), 0) as total_seconds
    FROM time_entries
    WHERE start_time >= date('now', '-' || ? || ' months')
      AND duration_seconds IS NOT NULL
    GROUP BY strftime('%Y-%m', start_time)
    ORDER BY month DESC
    LIMIT ?
  `).all(months, months) as MonthlyTotal[];
}

// Weekly totals for comparison
export interface WeeklyTotal {
  week_start: string;
  total_seconds: number;
}

export function getWeeklyTotals(weeks: number): WeeklyTotal[] {
  const db = getDatabase();
  
  // Compute full date range: earliest start and latest end
  const { start: earliestStart } = getWeekRange(weeks - 1);
  const { end: latestEnd } = getWeekRange(0);
  
  // Single query with grouping by week (Monday of each week)
  // Calculate Monday: (day_of_week + 6) % 7 gives days to subtract
  // strftime('%w') returns 0=Sunday, 1=Monday, ..., 6=Saturday
  const weekTotals = db.prepare(`
    SELECT
      date(start_time, '-' || ((strftime('%w', start_time) + 6) % 7) || ' days') as week_start,
      COALESCE(SUM(duration_seconds), 0) as total_seconds
    FROM time_entries
    WHERE date(start_time) >= date(?)
      AND date(start_time) <= date(?)
      AND duration_seconds IS NOT NULL
    GROUP BY week_start
    ORDER BY week_start DESC
  `).all(earliestStart, latestEnd) as { week_start: string; total_seconds: number }[];
  
  // Create a map of week_start -> total_seconds
  const weekMap = new Map(weekTotals.map(w => [w.week_start, w.total_seconds]));
  
  // Build results array with all weeks in the requested window (fill missing weeks with 0)
  const results: WeeklyTotal[] = [];
  for (let i = 0; i < weeks; i++) {
    const { start } = getWeekRange(i);
    results.push({
      week_start: start,
      total_seconds: weekMap.get(start) || 0,
    });
  }
  
  return results;
}

// Streak data
export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
}

export function getStreakData(): StreakData {
  const db = getDatabase();

  // Get all distinct dates with entries
  const dates = db.prepare(`
    SELECT DISTINCT date(start_time) as active_date
    FROM time_entries
    WHERE duration_seconds IS NOT NULL
      AND duration_seconds > 0
    ORDER BY active_date DESC
  `).all() as { active_date: string }[];

  if (dates.length === 0) {
    return { currentStreak: 0, longestStreak: 0, lastActiveDate: null };
  }

  const lastActiveDate = dates[0].active_date;
  
  // Normalize dates to UTC midnight for accurate day difference calculation
  // Parse date string and create UTC date at midnight
  const normalizeToUTCMidnight = (dateStr: string): number => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  
  // Get today and yesterday in UTC midnight for comparison
  const todayUTC = new Date();
  const todayStr = todayUTC.toISOString().split('T')[0];
  const todayUTCMidnight = normalizeToUTCMidnight(todayStr);
  
  const yesterdayDate = new Date(todayUTC);
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().split('T')[0];
  const yesterdayUTCMidnight = normalizeToUTCMidnight(yesterdayStr);
  
  const lastActiveUTCMidnight = normalizeToUTCMidnight(lastActiveDate);
  const isCurrentStreak = lastActiveUTCMidnight === todayUTCMidnight || lastActiveUTCMidnight === yesterdayUTCMidnight;
  
  let longestStreak = 0;
  let runningStreak = 1;
  let currentStreak = 0;
  
  // Single-pass algorithm: calculate streaks in one loop
  for (let i = 0; i < dates.length; i++) {
    if (i === 0) {
      runningStreak = 1;
    } else {
      const currentUTCMidnight = normalizeToUTCMidnight(dates[i].active_date);
      const prevUTCMidnight = normalizeToUTCMidnight(dates[i - 1].active_date);
      // Calculate day difference using UTC (86400000 ms per day)
      const diffDays = (prevUTCMidnight - currentUTCMidnight) / 86400000;
      
      if (diffDays === 1) {
        runningStreak++;
      } else {
        // Streak broken, update longest and reset
        longestStreak = Math.max(longestStreak, runningStreak);
        runningStreak = 1;
      }
    }
    
    // Update longest streak at the end of loop
    if (i === dates.length - 1) {
      longestStreak = Math.max(longestStreak, runningStreak);
    }
  }
  
  // Determine currentStreak during the same pass
  if (isCurrentStreak) {
    currentStreak = runningStreak;
  } else {
    currentStreak = 0;
  }

  return { currentStreak, longestStreak, lastActiveDate };
}

// Productivity score (productive vs unproductive time)
export function getProductivityScore(startDate: string, endDate: string): {
  productiveSeconds: number;
  unproductiveSeconds: number;
  score: number;
} {
  const db = getDatabase();

  const result = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN c.is_productive = 1 THEN e.duration_seconds ELSE 0 END), 0) as productive,
      COALESCE(SUM(CASE WHEN c.is_productive = 0 THEN e.duration_seconds ELSE 0 END), 0) as unproductive
    FROM time_entries e
    LEFT JOIN categories c ON e.category_id = c.id
    WHERE date(e.start_time) >= date(?)
      AND date(e.start_time) <= date(?)
      AND e.duration_seconds IS NOT NULL
  `).get(startDate, endDate) as { productive: number; unproductive: number };

  const total = result.productive + result.unproductive;
  const score = total > 0 ? (result.productive / total) * 100 : 0;

  return {
    productiveSeconds: result.productive,
    unproductiveSeconds: result.unproductive,
    score,
  };
}

// Average statistics
export interface AverageStats {
  avgDailySeconds: number;
  avgWeeklySeconds: number;
  totalDays: number;
  totalEntries: number;
  totalSeconds: number;
}

export function getAverageStats(): AverageStats {
  const db = getDatabase();

  // Get total days with entries
  const daysResult = db.prepare(`
    SELECT
      COUNT(DISTINCT date(start_time)) as total_days,
      COUNT(*) as total_entries,
      COALESCE(SUM(duration_seconds), 0) as total_seconds
    FROM time_entries
    WHERE duration_seconds IS NOT NULL
  `).get() as { total_days: number; total_entries: number; total_seconds: number };

  const avgDailySeconds = daysResult.total_days > 0
    ? daysResult.total_seconds / daysResult.total_days
    : 0;

  // Calculate weeks
  const weeks = Math.max(1, Math.ceil(daysResult.total_days / 7));
  const avgWeeklySeconds = daysResult.total_seconds / weeks;

  return {
    avgDailySeconds,
    avgWeeklySeconds,
    totalDays: daysResult.total_days,
    totalEntries: daysResult.total_entries,
    totalSeconds: daysResult.total_seconds,
  };
}
