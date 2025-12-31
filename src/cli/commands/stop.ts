import chalk from 'chalk';
import { stopTimer, getTimerStatus } from '../../core/timer.js';
import { getCategoryById } from '../../storage/repositories/categories.js';
import { success, warn, formatDuration, formatCategory } from '../utils/format.js';

export function stopCommand(): void {
  const active = getTimerStatus();

  if (!active) {
    warn('No active timer running');
    return;
  }

  const entry = stopTimer();

  if (entry) {
    const categoryName = active.category_name || 'uncategorized';
    const category = active.category_id ? getCategoryById(active.category_id) : null;
    const duration = formatDuration(entry.duration_seconds || 0);

    success(`Timer stopped`);
    console.log(`  Category: ${formatCategory(categoryName, category?.color)}`);
    console.log(`  Duration: ${chalk.bold(duration)}`);
  } else {
    warn('Failed to stop timer');
  }
}
