import chalk from 'chalk';
import { startTimer } from '../../core/timer.js';
import { getAllCategories } from '../../storage/repositories/categories.js';
import { success, error, formatCategory } from '../utils/format.js';

export function startCommand(category?: string, options?: { notes?: string }): void {
  try {
    // If no category provided, show available categories
    if (!category) {
      const categories = getAllCategories();
      console.log(chalk.bold('\nAvailable categories:'));
      for (const cat of categories) {
        console.log(`  ${formatCategory(cat.name, cat.color)}`);
      }
      console.log('\nUsage: tt start <category>');
      console.log('Example: tt start programming\n');
      return;
    }

    const entry = startTimer({ category, notes: options?.notes });
    success(`Timer started for ${chalk.bold(category)}`);

    if (options?.notes) {
      console.log(`  Notes: ${options.notes}`);
    }
  } catch (err) {
    if (err instanceof Error) {
      error(err.message);

      // If category not found, suggest available ones
      if (err.message.includes('not found')) {
        const categories = getAllCategories();
        console.log('\nAvailable categories:');
        for (const cat of categories) {
          console.log(`  ${formatCategory(cat.name, cat.color)}`);
        }
      }
    } else {
      error('Failed to start timer');
    }
    process.exit(1);
  }
}
