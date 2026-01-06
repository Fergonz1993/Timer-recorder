import { getIdleTime } from '../detection/idle.js';
import { getActiveEntry, getEntryById, updateEntry } from '../storage/repositories/entries.js';
import { pushUndoAction } from './undo.js';
import { triggerWebhooks } from '../storage/repositories/webhooks.js';
import { loadConfig } from '../config/settings.js';
import type { TimeEntry } from '../types/index.js';

export interface PauseResult {
  paused: boolean;
  entry: TimeEntry | null;
  action: 'paused' | 'resumed' | 'none';
}

/**
 * Get current timestamp in SQLite format (YYYY-MM-DD HH:MM:SS)
 */
function getSQLTimestamp(date = new Date()): string {
  const pad = (value: number): string => value.toString().padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * Parse a SQLite timestamp (YYYY-MM-DD HH:MM:SS) into a local Date.
 */
function parseSQLTimestamp(timestamp: string): Date | null {
  const [datePart, timePart] = timestamp.split(' ');
  if (!datePart || !timePart) {
    return null;
  }

  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second] = timePart.split(':').map(Number);
  if ([year, month, day, hour, minute, second].some((value) => Number.isNaN(value))) {
    return null;
  }

  return new Date(year, month - 1, day, hour, minute, second);
}

/**
 * Calculate seconds elapsed since a given timestamp
 */
function getSecondsSince(timestamp: string): number {
  const past = parseSQLTimestamp(timestamp) ?? new Date(timestamp);
  const now = new Date();
  return Math.floor((now.getTime() - past.getTime()) / 1000);
}

/**
 * Pause the currently active entry (auto-pause on idle detection)
 */
export function pauseActiveEntry(): TimeEntry | null {
  const active = getActiveEntry();
  if (!active) {
    return null;
  }

  // Already paused, nothing to do
  if (active.auto_paused) {
    return getEntryById(active.id) || null;
  }

  const previousEntry = getEntryById(active.id);
  if (!previousEntry) {
    return null;
  }

  // Update entry to paused state
  const entry = updateEntry(active.id, {
    pausedAt: getSQLTimestamp(),
    autoPaused: true,
  });

  if (!entry) {
    return null;
  }

  // Push to undo stack
  pushUndoAction({
    actionType: 'update_entry',
    entityType: 'time_entry',
    entityId: entry.id,
    oldData: previousEntry,
    newData: entry,
  });

  // Trigger webhook asynchronously
  triggerWebhooks('timer.pause', {
    entry_id: entry.id,
    category_id: entry.category_id,
    reason: 'auto_idle',
    paused_at: entry.paused_at,
  }).catch(() => {
    // Silently ignore webhook errors - they're logged internally
  });

  return entry;
}

/**
 * Resume from paused entry (calculate and accumulate pause duration)
 */
export function resumeFromPause(): TimeEntry | null {
  const active = getActiveEntry();
  if (!active || !active.auto_paused || !active.paused_at) {
    return null;
  }

  const previousEntry = getEntryById(active.id);
  if (!previousEntry) {
    return null;
  }

  // Calculate pause duration
  const pauseDurationSeconds = getSecondsSince(active.paused_at);

  // Update entry to resumed state
  const entry = updateEntry(active.id, {
    pausedAt: null,
    autoPaused: false,
    pausedDurationSeconds: (active.paused_duration_seconds || 0) + pauseDurationSeconds,
  });

  if (!entry) {
    return null;
  }

  // Push to undo stack
  pushUndoAction({
    actionType: 'update_entry',
    entityType: 'time_entry',
    entityId: entry.id,
    oldData: previousEntry,
    newData: entry,
  });

  // Trigger webhook asynchronously
  triggerWebhooks('timer.resume', {
    entry_id: entry.id,
    category_id: entry.category_id,
    pause_duration_seconds: pauseDurationSeconds,
    total_paused_seconds: entry.paused_duration_seconds,
  }).catch(() => {
    // Silently ignore webhook errors
  });

  return entry;
}

/**
 * Check idle state and automatically pause/resume as needed
 * @param idleTime Optional pre-calculated idle time to avoid redundant checks
 * @returns {PauseResult} Information about pause state change
 */
export function checkAndHandleIdle(idleTime?: number): PauseResult {
  const config = loadConfig();
  const autoPauseEnabled = config.autoPauseEnabled ?? true;

  if (!autoPauseEnabled) {
    return { paused: false, entry: null, action: 'none' };
  }

  // Use provided idle time or fetch it
  const currentIdleTime = idleTime !== undefined ? idleTime : getIdleTime();
  const idleThreshold = config.idleThreshold || 300;
  const active = getActiveEntry();

  if (!active) {
    return { paused: false, entry: null, action: 'none' };
  }

  // User is idle - pause if not already paused
  if (currentIdleTime > idleThreshold && !active.auto_paused) {
    const entry = pauseActiveEntry();
    return { paused: true, entry, action: 'paused' };
  }

  // User is active - resume if currently paused
  if (currentIdleTime <= idleThreshold && active.auto_paused) {
    const entry = resumeFromPause();
    return { paused: false, entry, action: 'resumed' };
  }

  return { paused: Boolean(active.auto_paused), entry: null, action: 'none' };
}

/**
 * Get current pause duration if entry is paused
 */
export function getCurrentPauseDuration(): number {
  const active = getActiveEntry();
  if (!active || !active.auto_paused || !active.paused_at) {
    return 0;
  }

  return getSecondsSince(active.paused_at);
}

/**
 * Get total paused time including current pause
 */
export function getTotalPausedTime(): number {
  const active = getActiveEntry();
  if (!active) {
    return 0;
  }

  const currentPause = active.auto_paused ? getCurrentPauseDuration() : 0;
  return (active.paused_duration_seconds || 0) + currentPause;
}

/**
 * Calculate effective working duration (total elapsed - paused time)
 */
export function getEffectiveDuration(): number {
  const active = getActiveEntry();
  if (!active) {
    return 0;
  }

  const startTime = parseSQLTimestamp(active.start_time) ?? new Date(active.start_time);
  const now = new Date();
  const totalElapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
  const totalPaused = getTotalPausedTime();

  return Math.max(0, totalElapsed - totalPaused);
}
