import Table from 'cli-table3';
import chalk from 'chalk';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import {
  getRecentEntriesWithCategories,
  getEntryById,
  updateEntry,
  deleteEntry,
} from '../../storage/repositories/entries.js';
import { getCategoryByName, getAllCategories } from '../../storage/repositories/categories.js';
import { success, error, warn, formatDuration, formatCategory } from '../utils/format.js';
import type { EntryWithCategory } from '../../storage/repositories/entries.js';

dayjs.extend(relativeTime);

/**
 * Parse duration string (e.g., "2h", "30m", "1h30m", "90")
 */
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

/**
 * Parse time string (e.g., "2pm", "14:30", "yesterday 2pm")
 */
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

/**
 * Format a date for display
 */
function formatEntryDate(isoString: string): string {
  const date = dayjs(isoString);
  const now = dayjs();

  if (date.isSame(now, 'day')) {
    return `Today ${date.format('h:mm A')}`;
  } else if (date.isSame(now.subtract(1, 'day'), 'day')) {
    return `Yesterday ${date.format('h:mm A')}`;
  } else if (date.isAfter(now.subtract(7, 'day'))) {
    return date.format('ddd h:mm A');
  }
  return date.format('MMM D h:mm A');
}

/**
 * List recent time entries
 */
export function listCommand(options: { limit?: string }): void {
  const limit = options.limit ? parseInt(options.limit, 10) : 20;

  if (isNaN(limit) || limit < 1 || limit > 100) {
    error('Limit must be a number between 1 and 100');
    process.exit(1);
  }

  const entries = getRecentEntriesWithCategories(limit);

  if (entries.length === 0) {
    console.log(chalk.dim('\nNo time entries found.\n'));
    return;
  }

  console.log(chalk.bold(`\nRecent Time Entries (${entries.length})\n`));

  const table = new Table({
    head: [
      chalk.cyan('ID'),
      chalk.cyan('Start'),
      chalk.cyan('Duration'),
      chalk.cyan('Category'),
      chalk.cyan('App'),
    ],
    colWidths: [8, 20, 12, 18, 25],
  });

  for (const entry of entries) {
    const duration = entry.duration_seconds
      ? formatDuration(entry.duration_seconds)
      : chalk.yellow('active');

    const category = entry.category_name
      ? formatCategory(entry.category_name, null)
      : chalk.dim('uncategorized');

    const app = entry.app_name
      ? entry.app_name.substring(0, 22) + (entry.app_name.length > 22 ? '...' : '')
      : chalk.dim('-');

    table.push([
      chalk.gray(entry.id.toString()),
      formatEntryDate(entry.start_time),
      duration,
      category,
      app,
    ]);
  }

  console.log(table.toString());
  console.log();
}

interface EditOptions {
  category?: string;
  duration?: string;
  start?: string;
  end?: string;
  notes?: string;
}

/**
 * Edit an existing time entry
 */
export function editCommand(idStr: string, options: EditOptions): void {
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    error('Invalid entry ID');
    process.exit(1);
  }

  const entry = getEntryById(id);
  if (!entry) {
    error(`Entry not found: ${id}`);
    process.exit(1);
  }

  // Check if any options were provided
  if (!options.category && !options.duration && !options.start && !options.end && options.notes === undefined) {
    error('No changes specified');
    console.log('\nAvailable options:');
    console.log('  -c, --category <category>  Change category');
    console.log('  -d, --duration <duration>  Change duration (e.g., "2h", "30m")');
    console.log('  -s, --start <time>         Change start time');
    console.log('  -e, --end <time>           Change end time');
    console.log('  -n, --notes <notes>        Change notes');
    process.exit(1);
  }

  const updates: Parameters<typeof updateEntry>[1] = {};

  // Handle category change
  if (options.category) {
    const category = getCategoryByName(options.category);
    if (!category) {
      error(`Category not found: ${options.category}`);
      console.log('\nAvailable categories:');
      const categories = getAllCategories();
      for (const cat of categories) {
        console.log(`  ${formatCategory(cat.name, cat.color)}`);
      }
      process.exit(1);
    }
    updates.categoryId = category.id;
  }

  // Handle duration change
  if (options.duration) {
    const durationSeconds = parseDuration(options.duration);
    if (durationSeconds === null || durationSeconds <= 0) {
      error(`Invalid duration: ${options.duration}`);
      console.log('\nValid formats: "2h", "30m", "1h30m", "90" (minutes)');
      process.exit(1);
    }
    updates.durationSeconds = durationSeconds;

    // Recalculate end time based on new duration
    const startTime = dayjs(entry.start_time);
    updates.endTime = startTime.add(durationSeconds, 'second').format('YYYY-MM-DD HH:mm:ss');
  }

  // Handle start time change
  if (options.start) {
    const startTime = parseTime(options.start);
    if (!startTime) {
      error(`Invalid start time: ${options.start}`);
      console.log('\nValid formats: "2pm", "14:30", "yesterday 2pm"');
      process.exit(1);
    }
    updates.startTime = dayjs(startTime).format('YYYY-MM-DD HH:mm:ss');

    // Recalculate duration if end time exists and --end was not provided
    if (entry.end_time && !options.end && !options.duration) {
      const endTime = dayjs(entry.end_time);
      updates.durationSeconds = endTime.diff(dayjs(startTime), 'second');
    }
  }

  // Handle end time change
  if (options.end) {
    const endTime = parseTime(options.end);
    if (!endTime) {
      error(`Invalid end time: ${options.end}`);
      console.log('\nValid formats: "2pm", "14:30", "yesterday 2pm"');
      process.exit(1);
    }
    updates.endTime = dayjs(endTime).format('YYYY-MM-DD HH:mm:ss');

    // Recalculate duration
    const startTime = updates.startTime ? dayjs(updates.startTime) : dayjs(entry.start_time);
    updates.durationSeconds = dayjs(endTime).diff(startTime, 'second');
  }

  // Handle notes change
  if (options.notes !== undefined) {
    updates.notes = options.notes || null;
  }

  const updated = updateEntry(id, updates);
  if (!updated) {
    error('Failed to update entry');
    process.exit(1);
  }

  success(`Updated entry #${id}`);
  console.log();

  // Show updated entry
  console.log(chalk.dim('  Start:    ') + formatEntryDate(updated.start_time));
  if (updated.end_time) {
    console.log(chalk.dim('  End:      ') + formatEntryDate(updated.end_time));
  }
  if (updated.duration_seconds) {
    console.log(chalk.dim('  Duration: ') + formatDuration(updated.duration_seconds));
  }
  console.log();
}

interface DeleteOptions {
  force?: boolean;
}

/**
 * Delete a time entry
 */
export function deleteCommand(idStr: string, options: DeleteOptions): void {
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    error('Invalid entry ID');
    process.exit(1);
  }

  const entry = getEntryById(id);
  if (!entry) {
    error(`Entry not found: ${id}`);
    process.exit(1);
  }

  // Show entry info
  console.log();
  console.log(chalk.bold('Entry to delete:'));
  console.log(chalk.dim('  ID:       ') + entry.id);
  console.log(chalk.dim('  Start:    ') + formatEntryDate(entry.start_time));
  if (entry.duration_seconds) {
    console.log(chalk.dim('  Duration: ') + formatDuration(entry.duration_seconds));
  }
  if (entry.app_name) {
    console.log(chalk.dim('  App:      ') + entry.app_name);
  }
  console.log();

  // Confirm unless --force is used
  if (!options.force) {
    warn('Use --force (-f) to confirm deletion');
    console.log('\nExample: tt delete ' + id + ' --force');
    console.log();
    return;
  }

  const deleted = deleteEntry(id);
  if (!deleted) {
    error('Failed to delete entry');
    process.exit(1);
  }

  success(`Deleted entry #${id}`);
  console.log();
}
