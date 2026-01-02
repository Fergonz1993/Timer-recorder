import chalk from 'chalk';
import { startTimer } from '../../core/timer.js';
import { getAllCategories } from '../../storage/repositories/categories.js';
import { getProjectById, getDefaultProject } from '../../storage/repositories/projects.js';
import { success, error, formatCategory } from '../utils/format.js';

export function startCommand(
  category?: string,
  options?: { notes?: string; project?: string; tags?: string }
): void {
  try {
    // If no category provided, show available categories
    if (!category) {
      const categories = getAllCategories();
      console.log(chalk.bold('\nAvailable categories:'));
      for (const cat of categories) {
        console.log(`  ${formatCategory(cat.name, cat.color)}`);
      }
      console.log('\nUsage: tt start <category>');
      console.log('Example: tt start programming');
      console.log('         tt start programming --project myproject --tags feature,urgent\n');
      return;
    }

    const entry = startTimer({
      category,
      project: options?.project,
      tags: options?.tags,
      notes: options?.notes,
    });
    success(`Timer started for ${chalk.bold(category)}`);

    // Get project details from the created entry instead of redundant queries
    if (entry.project_id) {
      const project = getProjectById(entry.project_id);
      if (project) {
        console.log(`  Project: ${formatCategory(project.name, project.color)}`);
      }
    } else {
      // Check if there's a default project that was applied
      const defaultProj = getDefaultProject();
      if (defaultProj) {
        console.log(`  Project: ${formatCategory(defaultProj.name, defaultProj.color)} ${chalk.dim('(default)')}`);
      }
    }

    if (options?.tags) {
      console.log(`  Tags: ${options.tags}`);
    }

    if (options?.notes) {
      console.log(`  Notes: ${options.notes}`);
    }
  } catch (err) {
    if (err instanceof Error) {
      error(err.message);

      // If category not found, suggest available ones
      if (err.message.includes('Category not found')) {
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
