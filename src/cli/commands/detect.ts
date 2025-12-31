import chalk from 'chalk';
import {
  getActiveWindow,
  checkAccessibilityPermission,
  getPermissionInstructions,
} from '../../detection/macos.js';
import { getIdleTime } from '../../detection/idle.js';
import { categorize } from '../../categorization/rules.js';
import { formatCategory } from '../utils/format.js';
import { getCategoryByName } from '../../storage/repositories/categories.js';

// Show current detected window and category
export function detectCommand(): void {
  // Check permissions
  if (!checkAccessibilityPermission()) {
    console.log(chalk.yellow(getPermissionInstructions()));
    return;
  }

  const windowInfo = getActiveWindow();
  const idleTime = getIdleTime();
  const categoryName = categorize(windowInfo);
  const category = categoryName ? getCategoryByName(categoryName) : null;

  console.log();
  console.log(chalk.bold('Current Detection'));
  console.log(chalk.dim('─'.repeat(40)));
  console.log();
  console.log(`  App:       ${chalk.bold(windowInfo.appName)}`);
  console.log(`  Bundle:    ${chalk.dim(windowInfo.appBundleId || '(none)')}`);
  console.log(`  Window:    ${chalk.dim(windowInfo.windowTitle.slice(0, 50) || '(none)')}`);
  console.log();
  console.log(
    `  Category:  ${categoryName ? formatCategory(categoryName, category?.color) : chalk.dim('uncategorized')}`
  );
  console.log(`  Idle:      ${idleTime}s`);
  console.log();
}

// Continuously monitor detection (for debugging)
export function detectWatch(): void {
  console.log(chalk.bold('Watching for window changes...'));
  console.log(chalk.dim('Press Ctrl+C to stop\n'));

  let lastApp = '';

  const tick = () => {
    const windowInfo = getActiveWindow();
    const categoryName = categorize(windowInfo);

    const current = `${windowInfo.appName}|${windowInfo.windowTitle}`;
    if (current !== lastApp) {
      lastApp = current;
      const time = new Date().toLocaleTimeString();
      console.log(
        `[${chalk.dim(time)}] ${chalk.bold(windowInfo.appName)} → ${categoryName || chalk.dim('uncategorized')}`
      );
      if (windowInfo.windowTitle) {
        console.log(`           ${chalk.dim(windowInfo.windowTitle.slice(0, 60))}`);
      }
    }
  };

  tick();
  setInterval(tick, 2000);
}
