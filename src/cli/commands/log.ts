import chalk from 'chalk';
import dayjs from 'dayjs';
import { getDatabase } from '../../storage/database.js';
import { getCategoryByName, getAllCategories } from '../../storage/repositories/categories.js';
import { getProjectByName, getDefaultProject } from '../../storage/repositories/projects.js';
import { parseAndGetTags, attachTagsToEntry } from '../../storage/repositories/tags.js';
import { success, error, formatDuration, formatCategory } from '../utils/format.js';

interface LogOptions {
  category: string;
  duration?: string;
  at?: string;
  notes?: string;
  project?: string;
  tags?: string;
}

// Parse duration string (e.g., "2h", "30m", "1h30m", "90")
function parseDuration(durationStr: string): number | null {
  // Try "1h30m" format
  const hhmm = durationStr.match(/^(\d+)h\s*(\d+)m$/i);
  if (hhmm) {
    return parseInt(hhmm[1], 10) * 3600 + parseInt(hhmm[2], 10) * 60;
  }

  // Try "2h" format
  const hours = durationStr.match(/^(\d+(?:\.\d+)?)\s*h$/i);
  if (hours) {
    return Math.round(parseFloat(hours[1]) * 3600);
  }

  // Try "30m" format
  const minutes = durationStr.match(/^(\d+)\s*m$/i);
  if (minutes) {
    return parseInt(minutes[1], 10) * 60;
  }

  // Try plain number (minutes)
  const plainNum = parseInt(durationStr, 10);
  if (!isNaN(plainNum)) {
    return plainNum * 60;
  }

  return null;
}

// Parse time string (e.g., "2pm", "14:30", "yesterday 2pm")
function parseTime(timeStr: string): Date | null {
  const now = dayjs();

  // Handle relative dates
  let baseDate = now;
  let timeOnly = timeStr.toLowerCase();

  if (timeOnly.startsWith('yesterday')) {
    baseDate = now.subtract(1, 'day');
    timeOnly = timeOnly.replace('yesterday', '').trim();
  } else if (timeOnly.startsWith('today')) {
    timeOnly = timeOnly.replace('today', '').trim();
  }

  // Handle time formats
  // "2pm" or "2:30pm"
  const ampm = timeOnly.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (ampm) {
    let hours = parseInt(ampm[1], 10);
    const mins = ampm[2] ? parseInt(ampm[2], 10) : 0;
    const isPm = ampm[3].toLowerCase() === 'pm';

    if (isPm && hours !== 12) hours += 12;
    if (!isPm && hours === 12) hours = 0;

    return baseDate.hour(hours).minute(mins).second(0).toDate();
  }

  // "14:30" format
  const military = timeOnly.match(/^(\d{1,2}):(\d{2})$/);
  if (military) {
    const hours = parseInt(military[1], 10);
    const mins = parseInt(military[2], 10);
    return baseDate.hour(hours).minute(mins).second(0).toDate();
  }

  // Just hour "14"
  const hourOnly = timeOnly.match(/^(\d{1,2})$/);
  if (hourOnly) {
    const hours = parseInt(hourOnly[1], 10);
    if (hours >= 0 && hours <= 23) {
      return baseDate.hour(hours).minute(0).second(0).toDate();
    }
  }

  return null;
}

// Log a manual time entry
export function logCommand(options: LogOptions): void {
  // Validate category
  const category = getCategoryByName(options.category);
  if (!category) {
    error(`Category not found: ${options.category}`);
    console.log();
    console.log('Available categories:');
    const categories = getAllCategories();
    for (const cat of categories) {
      console.log(`  ${formatCategory(cat.name, cat.color)}`);
    }
    process.exit(1);
  }

  // Parse duration
  if (!options.duration) {
    error('Duration is required. Use --duration "1h30m" or --duration "90" (minutes)');
    process.exit(1);
  }

  const durationSeconds = parseDuration(options.duration);
  if (durationSeconds === null || durationSeconds <= 0) {
    error(`Invalid duration: ${options.duration}`);
    console.log();
    console.log('Valid formats:');
    console.log('  --duration "2h"      (2 hours)');
    console.log('  --duration "30m"     (30 minutes)');
    console.log('  --duration "1h30m"   (1 hour 30 minutes)');
    console.log('  --duration "90"      (90 minutes)');
    process.exit(1);
  }

  // Parse start time
  let startTime: Date;
  if (options.at) {
    const parsed = parseTime(options.at);
    if (!parsed) {
      error(`Invalid time: ${options.at}`);
      console.log();
      console.log('Valid formats:');
      console.log('  --at "2pm"');
      console.log('  --at "14:30"');
      console.log('  --at "yesterday 2pm"');
      process.exit(1);
    }
    startTime = parsed;
  } else {
    // Default: end now, calculate start from duration
    startTime = new Date(Date.now() - durationSeconds * 1000);
  }

  const endTime = new Date(startTime.getTime() + durationSeconds * 1000);

  // Get project ID if provided, or use default
  let projectId: number | null = null;
  let projectName: string | null = null;
  if (options.project) {
    const project = getProjectByName(options.project);
    if (!project) {
      error(`Project not found: ${options.project}`);
      process.exit(1);
    }
    if (!project.is_active) {
      error(`Project is archived: ${options.project}`);
      process.exit(1);
    }
    projectId = project.id;
    projectName = project.name;
  } else {
    // Check for default project
    const defaultProject = getDefaultProject();
    if (defaultProject) {
      projectId = defaultProject.id;
      projectName = defaultProject.name;
    }
  }

  // Insert entry
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO time_entries (
      category_id, project_id, start_time, end_time, duration_seconds, is_manual, notes
    )
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `);

  const formatDbTime = (d: Date) => {
    return dayjs(d).format('YYYY-MM-DD HH:mm:ss');
  };

  const result = stmt.run(
    category.id,
    projectId,
    formatDbTime(startTime),
    formatDbTime(endTime),
    durationSeconds,
    options.notes || null
  );

  const entryId = result.lastInsertRowid as number;

  // Attach tags if provided
  if (options.tags) {
    const tags = parseAndGetTags(options.tags);
    if (tags.length > 0) {
      attachTagsToEntry(entryId, tags.map(t => t.id));
    }
  }

  success(`Logged ${formatDuration(durationSeconds)} of ${formatCategory(category.name, category.color)}`);
  console.log();
  console.log(chalk.dim(`  From: ${dayjs(startTime).format('MMM D, h:mm A')}`));
  console.log(chalk.dim(`  To:   ${dayjs(endTime).format('MMM D, h:mm A')}`));
  if (projectName) {
    console.log(chalk.dim(`  Project: ${projectName}${!options.project ? ' (default)' : ''}`));
  }
  if (options.tags) {
    console.log(chalk.dim(`  Tags: ${options.tags}`));
  }
  if (options.notes) {
    console.log(chalk.dim(`  Note: ${options.notes}`));
  }
  console.log();
}
