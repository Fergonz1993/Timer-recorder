import {
  createEntry,
  getActiveEntry,
  stopActiveEntry,
} from '../storage/repositories/entries.js';
import { getCategoryByName, getCategoryById } from '../storage/repositories/categories.js';
import { getProjectByName, getProjectById, getDefaultProject } from '../storage/repositories/projects.js';
import { parseAndGetTags, attachTagsToEntry } from '../storage/repositories/tags.js';
import { getGoalsForCategory } from '../storage/repositories/goals.js';
import { pushUndoAction } from './undo.js';
import { triggerWebhooks } from '../storage/repositories/webhooks.js';
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

  // Get full category and project details for webhook
  const category = categoryId ? getCategoryById(categoryId) : null;
  const project = projectId ? getProjectById(projectId) : (options.project ? getProjectByName(options.project) : null);

  // Trigger webhooks asynchronously (non-blocking)
  triggerWebhooks('timer.start', {
    entry_id: entry.id,
    category: category?.name || null,
    category_id: categoryId,
    project: project?.name || null,
    project_id: projectId,
    start_time: entry.start_time,
    tags: options.tags || null,
  }).catch(() => {
    // Silently ignore webhook errors - they're logged internally
  });

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

    // Get full category and project details for webhook
    const category = entry.category_id ? getCategoryById(entry.category_id) : null;
    const project = entry.project_id ? getProjectById(entry.project_id) : null;

    // Trigger webhooks asynchronously (non-blocking)
    triggerWebhooks('timer.stop', {
      entry_id: entry.id,
      category: category?.name || null,
      category_id: entry.category_id,
      project: project?.name || null,
      project_id: entry.project_id,
      start_time: entry.start_time,
      end_time: entry.end_time,
      duration_seconds: entry.duration_seconds,
    }).catch(() => {
      // Silently ignore webhook errors - they're logged internally
    });

    // Check if any goals were reached for this category
    if (entry.category_id) {
      checkAndTriggerGoalReached(entry.category_id, entry.duration_seconds || 0);
    }
  }

  return entry ?? null;
}

// Check if any goals were just reached and trigger webhook
function checkAndTriggerGoalReached(categoryId: number, addedSeconds: number): void {
  try {
    const goals = getGoalsForCategory(categoryId);
    const category = getCategoryById(categoryId);

    for (const goal of goals) {
      // Check if goal was just reached (percentage is now >= 100% but wasn't before this entry)
      const previousSeconds = goal.current_seconds - addedSeconds;
      const wasReached = previousSeconds >= goal.target_seconds;
      const isNowReached = goal.current_seconds >= goal.target_seconds;

      if (isNowReached && !wasReached) {
        // Goal was just reached! Trigger webhook
        triggerWebhooks('goal.reached', {
          goal_id: goal.id,
          category_id: categoryId,
          category_name: category?.name || 'unknown',
          period: goal.period,
          target_seconds: goal.target_seconds,
          current_seconds: goal.current_seconds,
          percentage: goal.percentage,
        }).catch(() => {
          // Silently ignore webhook errors - they're logged internally
        });
      }
    }
  } catch (error) {
    // Log the error but don't crash - goal checking is non-critical
    // In production this would use a proper logger
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Error checking goals after timer stop:', error);
    }
  }
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
