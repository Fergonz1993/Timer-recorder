import chalk from 'chalk';
import Table from 'cli-table3';
import { addRule, removeRule, listRules } from '../../categorization/rules.js';
import { getAllCategories } from '../../storage/repositories/categories.js';
import { success, error, warn, formatCategory } from '../utils/format.js';

// List all user-defined rules
export function rulesList(): void {
  const rules = listRules();

  console.log();
  console.log(chalk.bold('Categorization Rules'));
  console.log(chalk.dim('These rules map apps to categories for auto-tracking.\n'));

  if (rules.length === 0) {
    console.log(chalk.dim('  No custom rules defined.'));
    console.log();
    console.log(chalk.dim('  Add rules with: tt rules add --app "AppName" --category programming'));
    console.log();
    return;
  }

  const table = new Table({
    head: [
      chalk.bold('ID'),
      chalk.bold('App Pattern'),
      chalk.bold('Window Pattern'),
      chalk.bold('Category'),
    ],
    style: { head: [], border: [] },
    chars: {
      top: '', 'top-mid': '', 'top-left': '', 'top-right': '',
      bottom: '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
      left: '', 'left-mid': '', mid: '', 'mid-mid': '',
      right: '', 'right-mid': '', middle: ' ',
    },
  });

  for (const rule of rules) {
    table.push([
      chalk.dim(rule.id.toString()),
      rule.app_name_pattern || rule.app_bundle_id || chalk.dim('*'),
      rule.window_title_pattern || chalk.dim('*'),
      formatCategory(rule.category_name, null),
    ]);
  }

  console.log(table.toString());
  console.log();
}

// Add a new rule
export function rulesAdd(options: {
  app?: string;
  bundle?: string;
  window?: string;
  category: string;
  priority?: string;
}): void {
  // Validate at least one pattern is provided
  if (!options.app && !options.bundle && !options.window) {
    error('At least one pattern is required: --app, --bundle, or --window');
    console.log();
    console.log('Examples:');
    console.log('  tt rules add --app "Figma" --category design');
    console.log('  tt rules add --app "Chrome" --window "Jira" --category project-management');
    console.log('  tt rules add --bundle "com.spotify.client" --category breaks');
    process.exit(1);
  }

  // Validate category exists
  const categories = getAllCategories();
  const categoryExists = categories.some((c) => c.name === options.category);
  if (!categoryExists) {
    error(`Category not found: ${options.category}`);
    console.log();
    console.log('Available categories:');
    for (const cat of categories) {
      console.log(`  ${formatCategory(cat.name, cat.color)}`);
    }
    process.exit(1);
  }

  try {
    addRule({
      appNamePattern: options.app,
      appBundleId: options.bundle,
      windowTitlePattern: options.window,
      categoryName: options.category,
      priority: options.priority ? parseInt(options.priority, 10) : 0,
    });

    success(`Rule added: ${options.app || options.bundle || '*'} → ${options.category}`);
    console.log();

    if (options.window) {
      console.log(chalk.dim(`  Window pattern: ${options.window}`));
    }
    console.log(chalk.dim('  This rule will be used for auto-categorization.'));
    console.log();
  } catch (err) {
    error(`Failed to add rule: ${err}`);
    process.exit(1);
  }
}

// Remove a rule
export function rulesRemove(id: string): void {
  const ruleId = parseInt(id, 10);

  if (isNaN(ruleId)) {
    error('Invalid rule ID');
    process.exit(1);
  }

  if (removeRule(ruleId)) {
    success(`Rule ${ruleId} removed`);
  } else {
    error(`Rule ${ruleId} not found`);
    process.exit(1);
  }
}

// Show example rules
export function rulesExamples(): void {
  console.log();
  console.log(chalk.bold('Rule Examples'));
  console.log();

  const examples = [
    {
      cmd: 'tt rules add --app "Figma" --category design',
      desc: 'Track Figma as design work',
    },
    {
      cmd: 'tt rules add --app "Chrome" --window "Jira" --category project-management',
      desc: 'Chrome with Jira in title → project management',
    },
    {
      cmd: 'tt rules add --app "Notion" --category research',
      desc: 'Track Notion as research',
    },
    {
      cmd: 'tt rules add --bundle "com.spotify.client" --category breaks',
      desc: 'Track Spotify as break time (using bundle ID)',
    },
    {
      cmd: 'tt rules add --app "Terminal" --window "npm test" --category testing',
      desc: 'Terminal running tests → testing category',
    },
  ];

  for (const ex of examples) {
    console.log(chalk.cyan(`  ${ex.cmd}`));
    console.log(chalk.dim(`    ${ex.desc}`));
    console.log();
  }
}
