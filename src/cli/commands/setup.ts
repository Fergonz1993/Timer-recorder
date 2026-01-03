/**
 * Interactive Onboarding Wizard
 * Guides new users through initial setup
 */

import * as readline from 'readline';
import chalk from 'chalk';
import { success, error, info } from '../utils/format.js';
import { getDatabase } from '../../storage/database.js';
import { createCategory, getAllCategories } from '../../storage/repositories/categories.js';
import { createProject } from '../../storage/repositories/projects.js';
import { saveGitHubConfig } from '../../integrations/github.js';
import { saveJiraConfig } from '../../integrations/jira.js';

// Simple readline prompt helper
function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Yes/No prompt
async function confirmPrompt(question: string, defaultYes: boolean = true): Promise<boolean> {
  const hint = defaultYes ? '[Y/n]' : '[y/N]';
  const answer = await prompt(`${question} ${chalk.dim(hint)} `);

  if (answer === '') {
    return defaultYes;
  }
  return answer.toLowerCase().startsWith('y');
}

// Multiple choice prompt
async function choicePrompt(question: string, choices: string[]): Promise<number> {
  console.log();
  console.log(chalk.bold(question));
  console.log();
  choices.forEach((choice, i) => {
    console.log(`  ${chalk.cyan(i + 1)}. ${choice}`);
  });
  console.log();

  while (true) {
    const answer = await prompt(`Enter number (1-${choices.length}): `);
    const num = parseInt(answer, 10);
    if (num >= 1 && num <= choices.length) {
      return num - 1;
    }
    console.log(chalk.red('Invalid choice. Try again.'));
  }
}

// Print welcome banner
function printWelcome(): void {
  console.log();
  console.log(chalk.bold.blue('╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.blue('║') + '                                                            ' + chalk.bold.blue('║'));
  console.log(chalk.bold.blue('║') + '     ⏱️  ' + chalk.bold.white(' Welcome to Timer Record!') + '                         ' + chalk.bold.blue('║'));
  console.log(chalk.bold.blue('║') + '                                                            ' + chalk.bold.blue('║'));
  console.log(chalk.bold.blue('║') + '     Track your time, boost productivity, get paid.        ' + chalk.bold.blue('║'));
  console.log(chalk.bold.blue('║') + '                                                            ' + chalk.bold.blue('║'));
  console.log(chalk.bold.blue('╚════════════════════════════════════════════════════════════╝'));
  console.log();
}

// Print step header
function printStep(step: number, total: number, title: string): void {
  console.log();
  console.log(chalk.dim(`─── Step ${step}/${total} ───`));
  console.log(chalk.bold(title));
  console.log();
}

// Check if setup has been run before
function isFirstRun(): boolean {
  const db = getDatabase();
  const result = db.prepare(`SELECT value FROM settings WHERE key = 'setup_complete'`).get() as { value: string } | undefined;
  return !result;
}

// Mark setup as complete
function markSetupComplete(): void {
  const db = getDatabase();
  db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('setup_complete', '1')`).run();
}

// Main setup wizard
export async function setupWizard(options: { force?: boolean } = {}): Promise<void> {
  // Check if already set up
  if (!options.force && !isFirstRun()) {
    console.log();
    info('Timer Record is already set up!');
    console.log();
    console.log('  Run ' + chalk.cyan('tt setup --force') + ' to run the wizard again.');
    console.log('  Run ' + chalk.cyan('tt help') + ' to see available commands.');
    console.log();
    return;
  }

  printWelcome();

  console.log('This wizard will help you set up Timer Record.');
  console.log('Press Ctrl+C at any time to exit.');
  console.log();

  const enterToContinue = await prompt(chalk.dim('Press Enter to continue...'));

  // Step 1: Work Type
  printStep(1, 5, 'What kind of work do you do?');

  const workTypes = [
    'Software Development',
    'Design & Creative',
    'Consulting / Freelance',
    'Finance / Business',
    'Research / Academic',
    'Other / General',
  ];

  const workTypeIndex = await choicePrompt('Select your primary work type:', workTypes);
  const workType = workTypes[workTypeIndex];

  // Step 2: Add custom categories based on work type
  printStep(2, 5, 'Categories');

  console.log('Categories help organize your time. We have some defaults:');
  console.log();

  const existingCategories = getAllCategories();
  const defaultCategories = existingCategories.slice(0, 5).map(c => c.name);
  console.log('  ' + defaultCategories.join(', '));
  console.log();

  const addCustomCats = await confirmPrompt('Would you like to add custom categories?', false);

  if (addCustomCats) {
    console.log();
    console.log('Enter category names (one per line, empty line to finish):');
    console.log();

    while (true) {
      const catName = await prompt('  Category: ');
      if (catName === '') break;

      try {
        createCategory(catName);
        console.log(chalk.green(`  ✓ Added: ${catName}`));
      } catch (e) {
        console.log(chalk.yellow(`  ! Already exists: ${catName}`));
      }
    }
  }

  // Step 3: Create first project
  printStep(3, 5, 'Projects');

  console.log('Projects help you track time for specific clients or initiatives.');
  console.log();

  const createProj = await confirmPrompt('Would you like to create your first project?', true);

  if (createProj) {
    console.log();
    const projName = await prompt('  Project name: ');
    if (projName) {
      const clientName = await prompt('  Client name (optional): ');
      const isBillable = await confirmPrompt('  Is this a billable project?', true);

      let hourlyRate = 0;
      if (isBillable) {
        const rateStr = await prompt('  Hourly rate (e.g., 150): $');
        hourlyRate = parseFloat(rateStr) || 0;
      }

      try {
        createProject({
          name: projName,
          client: clientName || null,
          isBillable,
          hourlyRate,
        });
        console.log();
        success(`Project "${projName}" created!`);
      } catch (e) {
        console.log(chalk.yellow(`  ! Project already exists`));
      }
    }
  }

  // Step 4: Integrations
  printStep(4, 5, 'Integrations (Optional)');

  console.log('Timer Record can integrate with GitHub and Jira to sync time.');
  console.log();

  const setupGithub = await confirmPrompt('Set up GitHub integration?', false);
  if (setupGithub) {
    console.log();
    console.log('  Get a token at: https://github.com/settings/tokens');
    console.log('  Required scope: repo (for private repos) or public_repo');
    console.log();

    const token = await prompt('  GitHub Token: ');
    const owner = await prompt('  Repo Owner (e.g., octocat): ');
    const repo = await prompt('  Repo Name (e.g., hello-world): ');

    if (token && owner && repo) {
      saveGitHubConfig({ token, owner, repo });
      success('GitHub configured!');
    }
  }

  const setupJira = await confirmPrompt('Set up Jira integration?', false);
  if (setupJira) {
    console.log();
    console.log('  Get an API token at: https://id.atlassian.com/manage-profile/security/api-tokens');
    console.log();

    const domain = await prompt('  Jira Domain (e.g., company.atlassian.net): ');
    const email = await prompt('  Your Email: ');
    const token = await prompt('  API Token: ');

    if (domain && email && token) {
      saveJiraConfig({ domain, email, apiToken: token });
      success('Jira configured!');
    }
  }

  // Step 5: Quick tips
  printStep(5, 5, 'You\'re all set!');

  console.log('Here are some commands to get started:');
  console.log();
  console.log('  ' + chalk.cyan('tt start programming') + '     Start tracking time');
  console.log('  ' + chalk.cyan('tt stop') + '                   Stop the timer');
  console.log('  ' + chalk.cyan('tt status') + '                 See current timer');
  console.log('  ' + chalk.cyan('tt today') + '                  View today\'s summary');
  console.log('  ' + chalk.cyan('tt week') + '                   View weekly summary');
  console.log();
  console.log('  ' + chalk.cyan('tt dashboard start') + '        Open web dashboard');
  console.log('  ' + chalk.cyan('tt pomodoro start') + '         Start a focus session');
  console.log('  ' + chalk.cyan('tt help') + '                   See all commands');
  console.log();

  // Mark setup as complete
  markSetupComplete();

  console.log(chalk.bold.green('Happy tracking! 🎉'));
  console.log();
}

// Quick setup without wizard (non-interactive)
export function quickSetupCommand(): void {
  console.log();
  console.log(chalk.bold('Quick Setup'));
  console.log();

  // Just ensure defaults exist
  const categories = getAllCategories();
  console.log(`  ✓ ${categories.length} categories available`);

  // Mark as complete
  markSetupComplete();

  console.log();
  success('Setup complete!');
  console.log();
  console.log('  Start tracking with: ' + chalk.cyan('tt start <category>'));
  console.log();
}
