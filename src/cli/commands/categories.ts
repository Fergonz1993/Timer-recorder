import chalk from 'chalk';
import Table from 'cli-table3';
import {
  getAllCategories,
  createCategory,
  deleteCategory,
  getCategoryByName,
} from '../../storage/repositories/categories.js';
import { success, error, warn, formatCategory } from '../utils/format.js';

// List all categories
export function listCategories(): void {
  const categories = getAllCategories();

  console.log();
  console.log(chalk.bold('Categories'));
  console.log();

  const table = new Table({
    head: [
      chalk.bold('Name'),
      chalk.bold('Color'),
      chalk.bold('Productive'),
      chalk.bold('Description'),
    ],
    style: { head: [], border: [] },
    chars: {
      top: '', 'top-mid': '', 'top-left': '', 'top-right': '',
      bottom: '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
      left: '', 'left-mid': '', mid: '', 'mid-mid': '',
      right: '', 'right-mid': '', middle: ' ',
    },
  });

  for (const cat of categories) {
    table.push([
      formatCategory(cat.name, cat.color),
      cat.color ? chalk.hex(cat.color)('██') : chalk.dim('--'),
      cat.is_productive ? chalk.green('yes') : chalk.dim('no'),
      cat.description || chalk.dim('--'),
    ]);
  }

  console.log(table.toString());
  console.log();
}

// Add a new category
export function addCategory(
  name: string,
  options?: { color?: string; description?: string; unproductive?: boolean }
): void {
  // Check if category already exists
  if (getCategoryByName(name)) {
    error(`Category "${name}" already exists`);
    process.exit(1);
  }

  try {
    const category = createCategory(
      name,
      options?.color,
      options?.description,
      !options?.unproductive
    );
    success(`Created category: ${formatCategory(category.name, category.color)}`);
  } catch (err) {
    error('Failed to create category');
    process.exit(1);
  }
}

// Remove a category
export function removeCategory(name: string): void {
  // Don't allow removing built-in categories
  const builtIn = [
    'programming', 'debugging', 'code-review', 'business-logic', 'testing', 'research',
    'excel-modeling', 'presentations', 'financial-analysis', 'valuation',
    'communication', 'meetings', 'uncategorized',
  ];

  if (builtIn.includes(name)) {
    warn(`Cannot remove built-in category "${name}"`);
    return;
  }

  const category = getCategoryByName(name);
  if (!category) {
    error(`Category "${name}" not found`);
    process.exit(1);
  }

  if (deleteCategory(name)) {
    success(`Removed category: ${name}`);
  } else {
    error('Failed to remove category');
    process.exit(1);
  }
}
