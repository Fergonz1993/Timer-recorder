import chalk from 'chalk';
import {
  TimerRecordError,
  CategoryNotFoundError,
  EntryNotFoundError,
  PermissionError,
  ValidationError,
  ConfigurationError,
  GoalNotFoundError,
} from '../../errors/index.js';
import { getAllCategories } from '../../storage/repositories/categories.js';
import { formatCategory } from './format.js';

/**
 * Handle errors in CLI commands
 * Provides user-friendly error messages and exits appropriately
 */
export function handleError(err: unknown): never {
  // Category not found - show available categories
  if (err instanceof CategoryNotFoundError) {
    console.log(chalk.red('✗'), err.message);
    console.log('\nAvailable categories:');
    try {
      const categories = getAllCategories();
      for (const cat of categories) {
        console.log(`  ${formatCategory(cat.name, cat.color)}`);
      }
    } catch {
      console.log(chalk.dim('  (unable to load categories)'));
    }
    process.exit(1);
  }

  // Entry not found
  if (err instanceof EntryNotFoundError) {
    console.log(chalk.red('✗'), err.message);
    console.log(chalk.dim('\nUse "tt list" to see recent entries with IDs.'));
    process.exit(1);
  }

  // Permission error
  if (err instanceof PermissionError) {
    console.log(chalk.red('✗'), err.message);
    console.log();
    console.log('To grant accessibility permission:');
    console.log('  1. Open System Settings > Privacy & Security > Accessibility');
    console.log('  2. Click the + button');
    console.log('  3. Add your terminal app (Terminal, iTerm, Warp, etc.)');
    console.log('  4. Toggle it ON');
    console.log();
    process.exit(1);
  }

  // Validation error
  if (err instanceof ValidationError) {
    console.log(chalk.red('✗'), err.message);
    if (err.details?.field) {
      console.log(chalk.dim(`  Field: ${err.details.field}`));
    }
    process.exit(1);
  }

  // Configuration error
  if (err instanceof ConfigurationError) {
    console.log(chalk.red('✗'), err.message);
    if (err.details?.key) {
      console.log(chalk.dim(`  Key: ${err.details.key}`));
    }
    console.log(chalk.dim('\nUse "tt config list" to see current configuration.'));
    process.exit(1);
  }

  // Goal not found
  if (err instanceof GoalNotFoundError) {
    console.log(chalk.red('✗'), err.message);
    console.log(chalk.dim('\nUse "tt goals list" to see current goals.'));
    process.exit(1);
  }

  // Generic TimerRecordError
  if (err instanceof TimerRecordError) {
    console.log(chalk.red('✗'), err.message);
    if (process.env.DEBUG && err.details) {
      console.log(chalk.dim(`  Details: ${JSON.stringify(err.details)}`));
    }
    process.exit(1);
  }

  // Standard Error
  if (err instanceof Error) {
    console.log(chalk.red('✗'), 'An unexpected error occurred');
    if (process.env.DEBUG) {
      console.log(chalk.dim(`  ${err.name}: ${err.message}`));
      if (err.stack) {
        console.log(chalk.dim(err.stack));
      }
    } else {
      console.log(chalk.dim(`  ${err.message}`));
      console.log(chalk.dim('\n  Set DEBUG=1 for more details.'));
    }
    process.exit(1);
  }

  // Unknown error type
  console.log(chalk.red('✗'), 'An unexpected error occurred');
  if (process.env.DEBUG) {
    console.log(chalk.dim(`  ${String(err)}`));
  }
  process.exit(1);
}

/**
 * Wrap a synchronous function with error handling
 */
export function withErrorHandler<T extends (...args: unknown[]) => void>(
  fn: T
): (...args: Parameters<T>) => void {
  return (...args: Parameters<T>) => {
    try {
      fn(...args);
    } catch (err) {
      handleError(err);
    }
  };
}

/**
 * Wrap an async function with error handling
 */
export function withAsyncErrorHandler<T extends (...args: unknown[]) => Promise<void>>(
  fn: T
): (...args: Parameters<T>) => Promise<void> {
  return async (...args: Parameters<T>) => {
    try {
      await fn(...args);
    } catch (err) {
      handleError(err);
    }
  };
}
