import chalk from 'chalk';
import { getTimerStatus, getActiveDuration } from '../../core/timer.js';
import { getCategoryById } from '../../storage/repositories/categories.js';
import { getTodayTotalSeconds } from '../../storage/repositories/entries.js';
import {
  formatDuration,
  formatDurationClock,
  formatCategory,
  formatTime,
  info,
} from '../utils/format.js';

export function statusCommand(): void {
  const active = getTimerStatus();
  const todayTotal = getTodayTotalSeconds();

  console.log();

  if (active) {
    const categoryName = active.category_name || 'uncategorized';
    const category = active.category_id ? getCategoryById(active.category_id) : null;
    const duration = getActiveDuration();

    console.log(chalk.bold.green('● Timer running'));
    console.log();
    console.log(`  Category:  ${formatCategory(categoryName, category?.color)}`);
    console.log(`  Started:   ${formatTime(active.start_time)}`);
    console.log(`  Duration:  ${chalk.bold(formatDurationClock(duration))}`);

    if (active.app_name) {
      console.log(`  App:       ${active.app_name}`);
    }
    if (active.window_title) {
      console.log(`  Window:    ${active.window_title.slice(0, 50)}`);
    }
  } else {
    console.log(chalk.dim('○ No active timer'));
    console.log();
    info('Use `tt start <category>` to start tracking');
  }

  console.log();
  console.log(chalk.dim(`Today's total: ${formatDuration(todayTotal + (active ? getActiveDuration() : 0))}`));
  console.log();
}
