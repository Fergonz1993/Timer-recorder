import chalk from 'chalk';
import Table from 'cli-table3';
import {
  getTodaySummary,
  getTodayTotalSeconds,
  getCategorySummaryFiltered,
  getTotalSecondsFiltered,
  type FilterOptions,
} from '../../storage/repositories/entries.js';
import { getTimerStatus, getActiveDuration } from '../../core/timer.js';
import { getProjectByName } from '../../storage/repositories/projects.js';
import { getTagByName } from '../../storage/repositories/tags.js';
import { formatDuration, formatCategory, formatBar } from '../utils/format.js';

interface TodayOptions {
  project?: string;
  tag?: string;
  tags?: string;
}

export function todayCommand(options?: TodayOptions): void {
  const today = new Date().toISOString().split('T')[0];

  // Build filters
  const filters: FilterOptions = {};
  let filterDescription = '';

  if (options?.project) {
    const project = getProjectByName(options.project);
    if (project) {
      filters.projectId = project.id;
      filterDescription += ` [project: ${project.name}]`;
    }
  }

  if (options?.tag || options?.tags) {
    const tagString = options.tag || options.tags || '';
    const tagNames = tagString.split(',').map(t => t.trim()).filter(t => t);
    const tagIds: number[] = [];
    for (const name of tagNames) {
      const tag = getTagByName(name);
      if (tag) tagIds.push(tag.id);
    }
    if (tagIds.length > 0) {
      filters.tagIds = tagIds;
      filterDescription += ` [tags: ${tagNames.join(', ')}]`;
    }
  }

  const hasFilters = filters.projectId || (filters.tagIds && filters.tagIds.length > 0);

  // Get summary (with or without filters)
  const summary = hasFilters
    ? getCategorySummaryFiltered(today, today, filters)
    : getTodaySummary();

  const active = getTimerStatus();
  const activeDuration = active ? getActiveDuration() : 0;

  // Calculate total (including active timer if no filters)
  let totalSeconds = hasFilters
    ? getTotalSecondsFiltered(today, today, filters)
    : getTodayTotalSeconds();

  // Only include active timer in total if no filters applied
  if (!hasFilters) {
    totalSeconds += activeDuration;
  }

  const todayDate = new Date();
  const dateStr = todayDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  console.log();
  console.log(chalk.bold(`Today's Summary`) + (filterDescription ? chalk.dim(filterDescription) : ''));
  console.log(chalk.dim(dateStr));
  console.log();

  if (summary.length === 0 && !active) {
    console.log(chalk.dim('  No time tracked today.'));
    console.log();
    console.log(chalk.dim('  Use `tt start <category>` to begin tracking.'));
    console.log();
    return;
  }

  console.log(`  Total: ${chalk.bold(formatDuration(totalSeconds))}`);

  if (active) {
    console.log(`  ${chalk.green('●')} Currently tracking: ${chalk.bold(active.category_name || 'uncategorized')}`);
  }

  console.log();

  // Build summary including active timer
  const summaryMap = new Map(
    summary.map((s) => [s.category, { ...s }])
  );

  // Add active timer to summary
  if (active && activeDuration > 0) {
    const categoryName = active.category_name || 'uncategorized';
    if (summaryMap.has(categoryName)) {
      const existing = summaryMap.get(categoryName)!;
      existing.total_seconds += activeDuration;
    } else {
      summaryMap.set(categoryName, {
        category: categoryName,
        color: null,
        total_seconds: activeDuration,
        entry_count: 1,
      });
    }
  }

  // Sort by total time
  const sortedSummary = Array.from(summaryMap.values()).sort(
    (a, b) => b.total_seconds - a.total_seconds
  );

  // Create table
  const table = new Table({
    head: [
      chalk.bold('Category'),
      chalk.bold('Time'),
      chalk.bold('%'),
      chalk.bold(''),
    ],
    colWidths: [22, 12, 8, 24],
    style: { head: [], border: [] },
    chars: {
      top: '─', 'top-mid': '─', 'top-left': '', 'top-right': '',
      bottom: '─', 'bottom-mid': '─', 'bottom-left': '', 'bottom-right': '',
      left: '', 'left-mid': '', mid: '─', 'mid-mid': '─',
      right: '', 'right-mid': '', middle: ' ',
    },
  });

  for (const item of sortedSummary) {
    const percentage = totalSeconds > 0 ? (item.total_seconds / totalSeconds) * 100 : 0;
    const isActive = active?.category_name === item.category;

    table.push([
      (isActive ? chalk.green('● ') : '  ') + formatCategory(item.category, item.color),
      formatDuration(item.total_seconds),
      `${percentage.toFixed(1)}%`,
      formatBar(percentage, 20),
    ]);
  }

  console.log(table.toString());
  console.log();
}
