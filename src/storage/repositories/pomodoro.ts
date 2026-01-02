import { getDatabase } from '../database.js';

// Pomodoro session states
export type PomodoroState = 'work' | 'break' | 'long_break' | 'paused' | 'completed';

export interface PomodoroSession {
  id: number;
  entry_id: number | null;
  category_id: number | null;
  work_duration: number;
  break_duration: number;
  long_break_duration: number;
  sessions_until_long_break: number;
  current_session: number;
  state: PomodoroState;
  started_at: string;
  paused_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface PomodoroSettings {
  work_duration: number;      // in minutes
  break_duration: number;     // in minutes
  long_break_duration: number; // in minutes
  sessions_until_long_break: number;
  auto_start_breaks: boolean;
  auto_start_work: boolean;
}

// Parse SQLite datetime string (stored as UTC) to timestamp
function parseSqliteDateTime(dateStr: string): number {
  // SQLite datetime('now') returns UTC without timezone indicator
  // Add 'Z' to make JavaScript parse it as UTC
  return new Date(dateStr + 'Z').getTime();
}

// Get pomodoro settings
export function getPomodoroSettings(): PomodoroSettings {
  const db = getDatabase();
  const rows = db.prepare('SELECT key, value FROM pomodoro_settings').all() as { key: string; value: string }[];

  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }

  return {
    work_duration: parseInt(settings.work_duration || '25', 10),
    break_duration: parseInt(settings.break_duration || '5', 10),
    long_break_duration: parseInt(settings.long_break_duration || '15', 10),
    sessions_until_long_break: parseInt(settings.sessions_until_long_break || '4', 10),
    auto_start_breaks: settings.auto_start_breaks === 'true',
    auto_start_work: settings.auto_start_work === 'true',
  };
}

// Update pomodoro setting
export function updatePomodoroSetting(key: string, value: string): void {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO pomodoro_settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `).run(key, value);
}

// Start a new pomodoro session
export function startPomodoroSession(options: {
  categoryId?: number;
  entryId?: number;
  notes?: string;
}): PomodoroSession {
  const db = getDatabase();
  const settings = getPomodoroSettings();

  const result = db.prepare(`
    INSERT INTO pomodoro_sessions (
      entry_id, category_id, work_duration, break_duration, long_break_duration,
      sessions_until_long_break, current_session, state, started_at, notes
    )
    VALUES (?, ?, ?, ?, ?, ?, 1, 'work', datetime('now'), ?)
  `).run(
    options.entryId ?? null,
    options.categoryId ?? null,
    settings.work_duration * 60,  // Convert to seconds
    settings.break_duration * 60,
    settings.long_break_duration * 60,
    settings.sessions_until_long_break,
    options.notes ?? null
  );

  return getPomodoroSessionById(result.lastInsertRowid as number)!;
}

// Get pomodoro session by ID
export function getPomodoroSessionById(id: number): PomodoroSession | null {
  const db = getDatabase();
  return db.prepare('SELECT * FROM pomodoro_sessions WHERE id = ?').get(id) as PomodoroSession | null;
}

// Get active pomodoro session
export function getActivePomodoroSession(): PomodoroSession | null {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM pomodoro_sessions
    WHERE state IN ('work', 'break', 'long_break', 'paused')
    ORDER BY started_at DESC
    LIMIT 1
  `).get() as PomodoroSession | null;
}

// Pause pomodoro session
export function pausePomodoroSession(id: number): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE pomodoro_sessions
    SET state = 'paused', paused_at = datetime('now')
    WHERE id = ? AND state IN ('work', 'break', 'long_break')
  `).run(id);
}


// Resume pomodoro session
export function resumePomodoroSession(id: number): void {
  const db = getDatabase();
  const session = getPomodoroSessionById(id);
  if (!session || session.state !== 'paused') return;

  // Calculate time spent paused and adjust started_at
  if (session.paused_at) {
    const pausedAt = parseSqliteDateTime(session.paused_at);
    const now = Date.now();
    const pausedDuration = now - pausedAt;
    const startedAt = parseSqliteDateTime(session.started_at);
    // Format as SQLite datetime (UTC without 'Z')
    const newStartedAt = new Date(startedAt + pausedDuration).toISOString().replace('Z', '').replace('T', ' ').slice(0, 19);

    db.prepare(`
      UPDATE pomodoro_sessions
      SET state = 'work', paused_at = NULL, started_at = ?
      WHERE id = ?
    `).run(newStartedAt, id);
  }
}

// Complete current phase and move to next
export function advancePomodoroPhase(id: number): { newState: PomodoroState; completed: boolean } {
  const db = getDatabase();
  const session = getPomodoroSessionById(id);
  if (!session) return { newState: 'completed', completed: true };

  let newState: PomodoroState;
  let newSession = session.current_session;
  let completed = false;

  if (session.state === 'work') {
    // After work, go to break
    if (session.current_session % session.sessions_until_long_break === 0) {
      newState = 'long_break';
    } else {
      newState = 'break';
    }
  } else if (session.state === 'break' || session.state === 'long_break') {
    // After break, go to work (next session)
    newState = 'work';
    newSession = session.current_session + 1;
  } else {
    return { newState: session.state, completed: false };
  }

  db.prepare(`
    UPDATE pomodoro_sessions
    SET state = ?, current_session = ?, started_at = datetime('now'), paused_at = NULL
    WHERE id = ?
  `).run(newState, newSession, id);

  return { newState, completed };
}

// Complete/stop pomodoro session
export function completePomodoroSession(id: number): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE pomodoro_sessions
    SET state = 'completed', completed_at = datetime('now')
    WHERE id = ?
  `).run(id);
}

// Get remaining time in current phase (in seconds)
export function getPomodoroRemainingTime(session: PomodoroSession): number {
  if (session.state === 'completed' || session.state === 'paused') {
    return 0;
  }

  let duration: number;
  switch (session.state) {
    case 'work':
      duration = session.work_duration;
      break;
    case 'break':
      duration = session.break_duration;
      break;
    case 'long_break':
      duration = session.long_break_duration;
      break;
    default:
      return 0;
  }

  const startedAt = parseSqliteDateTime(session.started_at);
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  return Math.max(0, duration - elapsed);
}

// Get elapsed time in current phase (in seconds)
export function getPomodoroElapsedTime(session: PomodoroSession): number {
  if (session.state === 'completed') {
    return 0;
  }

  const startedAt = parseSqliteDateTime(session.started_at);

  if (session.state === 'paused' && session.paused_at) {
    const pausedAt = parseSqliteDateTime(session.paused_at);
    return Math.floor((pausedAt - startedAt) / 1000);
  }

  return Math.floor((Date.now() - startedAt) / 1000);
}

// Get today's completed pomodoro count
export function getTodayPomodoroCount(): number {
  const db = getDatabase();
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM pomodoro_sessions
    WHERE date(created_at) = date('now')
    AND (state = 'completed' OR current_session > 1)
  `).get() as { count: number };
  return result.count;
}

// Get recent pomodoro sessions
export function getRecentPomodoroSessions(limit: number = 10): PomodoroSession[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM pomodoro_sessions
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as PomodoroSession[];
}
