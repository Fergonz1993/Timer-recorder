import { getDatabase } from '../database.js';
import { getWeekRange, getMonthRange } from './entries.js';
import type { Goal, GoalPeriod, GoalWithProgress } from '../../types/index.js';

/**
 * Create a new goal
 */
export function createGoal(
  categoryId: number,
  targetSeconds: number,
  period: GoalPeriod
): Goal {
  const db = getDatabase();

  // Wrap deactivate and insert in a transaction to ensure atomicity
  db.exec('BEGIN');
  try {
    // Deactivate any existing goal for this category/period
    db.prepare(`
      UPDATE goals
      SET is_active = 0, updated_at = datetime('now')
      WHERE category_id = ? AND period = ? AND is_active = 1
    `).run(categoryId, period);

    // Create new goal
    const result = db.prepare(`
      INSERT INTO goals (category_id, target_seconds, period)
      VALUES (?, ?, ?)
    `).run(categoryId, targetSeconds, period);

    db.exec('COMMIT');
    return getGoalById(result.lastInsertRowid as number)!;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/**
 * Get goal by ID
 */
export function getGoalById(id: number): Goal | undefined {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM goals WHERE id = ?').get(id) as Goal | undefined;
  if (row) {
    row.is_active = Boolean(row.is_active);
  }
  return row;
}

/**
 * Get all active goals
 */
export function getActiveGoals(): Goal[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM goals
    WHERE is_active = 1
    ORDER BY category_id, period
  `).all() as Goal[];

  return rows.map(row => ({
    ...row,
    is_active: Boolean(row.is_active),
  }));
}

/**
 * Get goal by category and period
 */
export function getGoalByCategory(
  categoryId: number,
  period: GoalPeriod
): Goal | undefined {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT * FROM goals
    WHERE category_id = ? AND period = ? AND is_active = 1
  `).get(categoryId, period) as Goal | undefined;

  if (row) {
    row.is_active = Boolean(row.is_active);
  }
  return row;
}

/**
 * Update goal target
 */
export function updateGoal(id: number, targetSeconds: number): Goal | undefined {
  const db = getDatabase();
  db.prepare(`
    UPDATE goals
    SET target_seconds = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(targetSeconds, id);

  return getGoalById(id);
}

/**
 * Delete (deactivate) a goal
 */
export function deleteGoal(id: number): boolean {
  const db = getDatabase();
  const result = db.prepare(`
    UPDATE goals
    SET is_active = 0, updated_at = datetime('now')
    WHERE id = ?
  `).run(id);

  return result.changes > 0;
}

/**
 * Get date range for a period
 */
function getDateRangeForPeriod(period: GoalPeriod): { start: string; end: string } {
  const today = new Date().toISOString().split('T')[0];

  switch (period) {
    case 'daily':
      return { start: today, end: today };
    case 'weekly':
      return getWeekRange(0);
    case 'monthly':
      return getMonthRange(0);
  }
}

/**
 * Get all active goals with progress
 */
export function getGoalsWithProgress(): GoalWithProgress[] {
  const db = getDatabase();

  const goals = db.prepare(`
    SELECT
      g.*,
      c.name as category_name,
      c.color as category_color
    FROM goals g
    JOIN categories c ON g.category_id = c.id
    WHERE g.is_active = 1
    ORDER BY c.name, g.period
  `).all() as (Goal & { category_name: string; category_color: string | null })[];

  return goals.map(goal => {
    const { start, end } = getDateRangeForPeriod(goal.period);

    // Get current time for this category in the period
    const result = db.prepare(`
      SELECT COALESCE(SUM(duration_seconds), 0) as total
      FROM time_entries
      WHERE category_id = ?
        AND date(start_time) >= date(?)
        AND date(start_time) <= date(?)
        AND duration_seconds IS NOT NULL
    `).get(goal.category_id, start, end) as { total: number };

    const current_seconds = result.total;
    // Guard against division by zero - if target is 0 or negative, percentage is 0
    const percentage = goal.target_seconds > 0
      ? Math.min(100, (current_seconds / goal.target_seconds) * 100)
      : 0;

    return {
      ...goal,
      is_active: Boolean(goal.is_active),
      current_seconds,
      percentage: isFinite(percentage) ? percentage : 0,
    };
  });
}

/**
 * Get goals for a specific category
 */
export function getGoalsForCategory(categoryId: number): GoalWithProgress[] {
  const db = getDatabase();

  // Filter at database level for efficiency
  const goals = db.prepare(`
    SELECT
      g.*,
      c.name as category_name,
      c.color as category_color
    FROM goals g
    JOIN categories c ON g.category_id = c.id
    WHERE g.is_active = 1 AND g.category_id = ?
    ORDER BY g.period
  `).all(categoryId) as (Goal & { category_name: string; category_color: string | null })[];

  return goals.map(goal => {
    const { start, end } = getDateRangeForPeriod(goal.period);

    // Get current time for this category in the period
    const result = db.prepare(`
      SELECT COALESCE(SUM(duration_seconds), 0) as total
      FROM time_entries
      WHERE category_id = ?
        AND date(start_time) >= date(?)
        AND date(start_time) <= date(?)
        AND duration_seconds IS NOT NULL
    `).get(goal.category_id, start, end) as { total: number };

    const current_seconds = result.total;
    // Guard against division by zero - if target is 0 or negative, percentage is 0
    const percentage = goal.target_seconds > 0
      ? Math.min(100, (current_seconds / goal.target_seconds) * 100)
      : 0;

    return {
      ...goal,
      is_active: Boolean(goal.is_active),
      current_seconds,
      percentage: isFinite(percentage) ? percentage : 0,
    };
  });
}
