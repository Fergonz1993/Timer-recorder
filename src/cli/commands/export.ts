import { writeFileSync } from 'fs';
import chalk from 'chalk';
import {
  getEntriesWithCategories,
  getWeekRange,
  type EntryWithCategory,
} from '../../storage/repositories/entries.js';
import { success, error, info } from '../utils/format.js';

interface ExportOptions {
  from?: string;
  to?: string;
  week?: boolean;
  today?: boolean;
  output?: string;
}

function getDateRange(options: ExportOptions): { start: string; end: string } {
  if (options.today) {
    const today = new Date().toISOString().split('T')[0];
    return { start: today, end: today };
  }

  if (options.week) {
    return getWeekRange();
  }

  if (options.from && options.to) {
    return { start: options.from, end: options.to };
  }

  // Default: last 30 days
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

// Export to CSV
export function exportCsv(options: ExportOptions): void {
  const { start, end } = getDateRange(options);
  const entries = getEntriesWithCategories(start, end);

  if (entries.length === 0) {
    info('No entries found for the specified date range.');
    return;
  }

  // CSV header
  const header = [
    'id',
    'start_time',
    'end_time',
    'duration_seconds',
    'duration_formatted',
    'category',
    'app_name',
    'window_title',
    'is_manual',
    'notes',
  ].join(',');

  // CSV rows
  const rows = entries.map((e) => {
    const duration = e.duration_seconds || 0;
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const formatted = `${hours}h ${minutes}m`;

    return [
      e.id,
      e.start_time,
      e.end_time || '',
      e.duration_seconds || 0,
      formatted,
      e.category_name || 'uncategorized',
      csvEscape(e.app_name || ''),
      csvEscape(e.window_title || ''),
      e.is_manual ? 'true' : 'false',
      csvEscape(e.notes || ''),
    ].join(',');
  });

  const csv = [header, ...rows].join('\n');

  // Output
  if (options.output) {
    writeFileSync(options.output, csv);
    success(`Exported ${entries.length} entries to ${options.output}`);
  } else {
    console.log(csv);
  }
}

// Export to JSON
export function exportJson(options: ExportOptions): void {
  const { start, end } = getDateRange(options);
  const entries = getEntriesWithCategories(start, end);

  if (entries.length === 0) {
    info('No entries found for the specified date range.');
    return;
  }

  // Transform entries
  const data = {
    exported_at: new Date().toISOString(),
    date_range: { start, end },
    entry_count: entries.length,
    total_seconds: entries.reduce((acc, e) => acc + (e.duration_seconds || 0), 0),
    entries: entries.map((e) => ({
      id: e.id,
      start_time: e.start_time,
      end_time: e.end_time,
      duration_seconds: e.duration_seconds,
      category: e.category_name || 'uncategorized',
      app_name: e.app_name,
      window_title: e.window_title,
      is_manual: Boolean(e.is_manual),
      notes: e.notes,
    })),
  };

  const json = JSON.stringify(data, null, 2);

  // Output
  if (options.output) {
    writeFileSync(options.output, json);
    success(`Exported ${entries.length} entries to ${options.output}`);
  } else {
    console.log(json);
  }
}

// Escape CSV field
function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
