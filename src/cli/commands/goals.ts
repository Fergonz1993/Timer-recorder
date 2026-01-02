import Table from 'cli-table3';
import chalk from 'chalk';
import {
  createGoal,
  getActiveGoals,
  getGoalsWithProgress,
  getGoalByCategory,
  deleteGoal,
} from '../../storage/repositories/goals.js';
import { getCategoryByName, getAllCategories } from '../../storage/repositories/categories.js';
import { success, error, formatDuration, formatCategory, formatBar } from '../utils/format.js';
import type { GoalPeriod, GoalWithProgress } from '../../types/index.js';

const PERIOD_LABELS: Record<GoalPeriod, string> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
};

/**
 * Parse target string like "40h/week" or "8h/day"
 */
function parseTarget(target: string): { seconds: number; period: GoalPeriod } | null {
  // Match patterns like "40h/week", "8h/day", "160h/month"
  const match = target.match(/^(\d+(?:\.\d+)?)\s*h\s*\/\s*(day|week|month)$/i);
  if (!match) return null;

  const hours = parseFloat(match[1]);
  const periodStr = match[2].toLowerCase();

  let period: GoalPeriod;
  switch (periodStr) {
    case 'day':
      period = 'daily';
      break;
    case 'week':
      period = 'weekly';
      break;
    case 'month':
      period = 'monthly';
      break;
    default:
      return null;
  }

  return {
    seconds: Math.round(hours * 3600),
    period,
  };
}

/**
 * Format target for display
 */
function formatTarget(seconds: number, period: GoalPeriod): string {
  const hours = seconds / 3600;
  return `${hours}h/${PERIOD_LABELS[period]}`;
}

/**
 * Set a goal
 */
export function goalsSetCommand(categoryName: string, target: string): void {
  // Validate category
  const category = getCategoryByName(categoryName);
  if (!category) {
    error(`Category not found: ${categoryName}`);
    console.log('\nAvailable categories:');
    const categories = getAllCategories();
    for (const cat of categories) {
      console.log(`  ${formatCategory(cat.name, cat.color)}`);
    }
    process.exit(1);
  }

  // Parse target
  const parsed = parseTarget(target);
  if (!parsed) {
    error(`Invalid target format: ${target}`);
    console.log('\nValid formats:');
    console.log('  8h/day     (8 hours per day)');
    console.log('  40h/week   (40 hours per week)');
    console.log('  160h/month (160 hours per month)');
    process.exit(1);
  }

  // Check for existing goal to determine message (createGoal performs an upsert)
  const existing = getGoalByCategory(category.id, parsed.period);
  createGoal(category.id, parsed.seconds, parsed.period);
  
  if (existing) {
    success(`Updated goal: ${formatCategory(category.name, category.color)} → ${formatTarget(parsed.seconds, parsed.period)}`);
  } else {
    success(`Created goal: ${formatCategory(category.name, category.color)} → ${formatTarget(parsed.seconds, parsed.period)}`);
  }

  console.log();
}

/**
 * List all goals
 */
export function goalsListCommand(): void {
  const goals = getActiveGoals();

  console.log(chalk.bold('\nTime Tracking Goals\n'));

  if (goals.length === 0) {
    console.log(chalk.dim('  No goals set yet.'));
    console.log(chalk.dim('\n  Set a goal with: tt goals set <category> <target>'));
    console.log(chalk.dim('  Example: tt goals set programming 40h/week\n'));
    return;
  }

  const table = new Table({
    head: [chalk.cyan('Category'), chalk.cyan('Target'), chalk.cyan('Period')],
    colWidths: [20, 15, 12],
  });

  // Get category names for display
  const categories = getAllCategories();
  const categoryMap = new Map(categories.map(c => [c.id, c]));

  for (const goal of goals) {
    const cat = categoryMap.get(goal.category_id);
    const catName = cat ? formatCategory(cat.name, cat.color) : 'Unknown';

    table.push([
      catName,
      formatTarget(goal.target_seconds, goal.period),
      goal.period,
    ]);
  }

  console.log(table.toString());
  console.log();
}

/**
 * Show progress toward goals
 */
export function goalsProgressCommand(): void {
  const goals = getGoalsWithProgress();

  console.log(chalk.bold('\nGoal Progress\n'));

  if (goals.length === 0) {
    console.log(chalk.dim('  No goals set yet.'));
    console.log(chalk.dim('\n  Set a goal with: tt goals set <category> <target>'));
    console.log(chalk.dim('  Example: tt goals set programming 40h/week\n'));
    return;
  }

  // Group by period
  const byPeriod: Record<GoalPeriod, GoalWithProgress[]> = {
    daily: [],
    weekly: [],
    monthly: [],
  };

  for (const goal of goals) {
    byPeriod[goal.period].push(goal);
  }

  const periodOrder: GoalPeriod[] = ['daily', 'weekly', 'monthly'];

  for (const period of periodOrder) {
    const periodGoals = byPeriod[period];
    if (periodGoals.length === 0) continue;

    const periodLabel = period.charAt(0).toUpperCase() + period.slice(1);
    console.log(chalk.bold(`  ${periodLabel} Goals`));
    console.log();

    for (const goal of periodGoals) {
      const catName = formatCategory(goal.category_name, goal.category_color);
      const current = formatDuration(goal.current_seconds);
      const target = formatDuration(goal.target_seconds);
      const percentage = goal.percentage;

      // Color the progress bar based on completion
      let barColor = chalk.red;
      if (percentage >= 100) barColor = chalk.green;
      else if (percentage >= 75) barColor = chalk.yellow;
      else if (percentage >= 50) barColor = chalk.cyan;

      const barWidth = 20;
      const filled = Math.round((Math.min(100, percentage) / 100) * barWidth);
      const bar = barColor('█'.repeat(filled)) + chalk.dim('░'.repeat(barWidth - filled));

      console.log(`    ${catName.padEnd(20)} ${bar} ${percentage.toFixed(0).padStart(3)}%`);
      console.log(chalk.dim(`    ${' '.repeat(20)} ${current} / ${target}`));
      console.log();
    }
  }
}

/**
 * Remove a goal
 */
export function goalsRemoveCommand(categoryName: string, options: { period?: string }): void {
  // Validate category
  const category = getCategoryByName(categoryName);
  if (!category) {
    error(`Category not found: ${categoryName}`);
    process.exit(1);
  }

  // Validate period
  const period = (options.period || 'weekly') as GoalPeriod;
  if (!['daily', 'weekly', 'monthly'].includes(period)) {
    error(`Invalid period: ${period}`);
    console.log('\nValid periods: daily, weekly, monthly');
    process.exit(1);
  }

  // Find and remove goal
  const goal = getGoalByCategory(category.id, period);
  if (!goal) {
    error(`No ${period} goal found for ${categoryName}`);
    process.exit(1);
  }

  deleteGoal(goal.id);
  success(`Removed ${period} goal for ${formatCategory(category.name, category.color)}`);
  console.log();
}
