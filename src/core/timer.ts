import {
  createEntry,
  getActiveEntry,
  stopActiveEntry,
} from '../storage/repositories/entries.js';
import { getCategoryByName } from '../storage/repositories/categories.js';
import { getProjectByName, getDefaultProject } from '../storage/repositories/projects.js';
import { parseAndGetTags, attachTagsToEntry } from '../storage/repositories/tags.js';
import { pushUndoAction } from './undo.js';
import type { TimeEntry, ActiveSession } from '../types/index.js';

export interface StartTimerOptions {
  category?: string;
  project?: string;
  tags?: string;
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

  // Get project ID if provided, or use default
  let projectId: number | null = null;
  if (options.project) {
    const project = getProjectByName(options.project);
    if (!project) {
      throw new Error(`Project not found: ${options.project}`);
    }
    if (!project.is_active) {
      throw new Error(`Project is archived: ${options.project}`);
    }
    projectId = project.id;
  } else {
    // Check for default project
    const defaultProject = getDefaultProject();
    if (defaultProject) {
      projectId = defaultProject.id;
    }
  }

  // Create new entry
  const entry = createEntry({
    categoryId,
    projectId,
    isManual: true,
    notes: options.notes,
  });

  // Push to undo stack
  pushUndoAction({
    actionType: 'start_timer',
    entityType: 'time_entry',
    entityId: entry.id,
    newData: entry,
  });

  // Attach tags if provided
  if (options.tags) {
    const tags = parseAndGetTags(options.tags);
    if (tags.length > 0) {
      attachTagsToEntry(entry.id, tags.map(t => t.id));
    }
  }

  return entry;
}

// Stop current timer
export function stopTimer(): TimeEntry | null {
  const entry = stopActiveEntry();

  if (entry) {
    // Push to undo stack
    pushUndoAction({
      actionType: 'stop_timer',
      entityType: 'time_entry',
      entityId: entry.id,
      oldData: { ...entry, end_time: null, duration_seconds: null },
      newData: entry,
    });
  }

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
