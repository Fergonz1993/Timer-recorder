import chalk from 'chalk';
import Table from 'cli-table3';
import { getTodaySummary, getTodayTotalSeconds } from '../../storage/repositories/entries.js';
import { getTimerStatus, getActiveDuration } from '../../core/timer.js';
import { formatDuration, formatCategory, formatBar } from '../utils/format.js';

export function todayCommand(): void {
  const summary = getTodaySummary();
  const active = getTimerStatus();
  const activeDuration = active ? getActiveDuration() : 0;

  // Calculate total (including active timer)
  let totalSeconds = getTodayTotalSeconds();
  totalSeconds += activeDuration;

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  console.log();
  console.log(chalk.bold(`Today's Summary`));
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
