import {
  createEntry,
  getActiveEntry,
  stopActiveEntry,
} from '../storage/repositories/entries.js';
import { getCategoryByName } from '../storage/repositories/categories.js';
import type { TimeEntry, ActiveSession } from '../types/index.js';

export interface StartTimerOptions {
  category?: string;
  notes?: string;
}

// Start a new timer
export function startTimer(options: StartTimerOptions = {}): TimeEntry {
  // First stop any active timer
  const active = getActiveEntry();
  if (active) {
    stopActiveEntry();
  }

  // Get category ID if provided
  let categoryId: number | null = null;
  if (options.category) {
    const category = getCategoryByName(options.category);
    if (!category) {
      throw new Error(`Category not found: ${options.category}`);
    }
    categoryId = category.id;
  }

  // Create new entry
  return createEntry({
    categoryId,
    isManual: true,
    notes: options.notes,
  });
}

// Stop current timer
export function stopTimer(): TimeEntry | null {
  const entry = stopActiveEntry();
  return entry ?? null;
}

// Get current timer status
export function getTimerStatus(): ActiveSession | null {
  const active = getActiveEntry();
  return active ?? null;
}

// Calculate duration of active timer
export function getActiveDuration(): number {
  const active = getActiveEntry();
  if (!active) return 0;

  const startTime = new Date(active.start_time);
  const now = new Date();
  return Math.floor((now.getTime() - startTime.getTime()) / 1000);
}
