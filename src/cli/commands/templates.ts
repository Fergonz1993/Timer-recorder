import chalk from 'chalk';
import Table from 'cli-table3';
import { startTimer } from '../../core/timer.js';
import { getCategoryByName } from '../../storage/repositories/categories.js';
import { getProjectByName } from '../../storage/repositories/projects.js';
import {
  createTemplate,
  getTemplateByName,
  getAllTemplates,
  deleteTemplate,
  toggleTemplateFavorite,
  incrementTemplateUseCount,
  updateTemplate,
  Template,
} from '../../storage/repositories/templates.js';
import { success, error, info, formatCategory } from '../utils/format.js';

// List all templates
export function listTemplates(options?: { favorites?: boolean }): void {
  const templates = options?.favorites
    ? getAllTemplates({ favoritesFirst: true }).filter(t => t.is_favorite)
    : getAllTemplates({ favoritesFirst: true });

  console.log();
  console.log(chalk.bold('Templates'));
  console.log();

  if (templates.length === 0) {
    console.log(chalk.dim('  No templates yet'));
    console.log();
    info('Create one with: tt template add <name> -c <category>');
    console.log();
    return;
  }

  const table = new Table({
    head: [
      chalk.bold('Name'),
      chalk.bold('Category'),
      chalk.bold('Project'),
      chalk.bold('Tags'),
      chalk.bold('Uses'),
    ],
    colWidths: [20, 15, 15, 20, 8],
    style: { head: [], border: [] },
    chars: {
      top: '', 'top-mid': '', 'top-left': '', 'top-right': '',
      bottom: '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
      left: '', 'left-mid': '', mid: '', 'mid-mid': '',
      right: '', 'right-mid': '', middle: ' ',
    },
  });

  for (const template of templates) {
    const star = template.is_favorite ? chalk.yellow('★ ') : '  ';
    table.push([
      star + template.name,
      template.category_name ? formatCategory(template.category_name, null) : chalk.dim('--'),
      template.project_name || chalk.dim('--'),
      template.tags || chalk.dim('--'),
      template.use_count.toString(),
    ]);
  }

  console.log(table.toString());
  console.log();
}

// Add a new template
export function addTemplate(name: string, options: {
  category?: string;
  project?: string;
  tags?: string;
  notes?: string;
}): void {
  // Check if template already exists
  const existing = getTemplateByName(name);
  if (existing) {
    error(`Template "${name}" already exists`);
    return;
  }

  // Validate category
  let categoryId: number | undefined;
  if (options.category) {
    const category = getCategoryByName(options.category);
    if (!category) {
      error(`Category "${options.category}" not found`);
      return;
    }
    categoryId = category.id;
  }

  // Validate project
  let projectId: number | undefined;
  if (options.project) {
    const project = getProjectByName(options.project);
    if (!project) {
      error(`Project "${options.project}" not found`);
      return;
    }
    projectId = project.id;
  }

  createTemplate({
    name,
    categoryId,
    projectId,
    tags: options.tags,
    notes: options.notes,
  });

  console.log();
  success(`Template "${name}" created`);
  console.log();
}

// Remove a template
export function removeTemplate(name: string): void {
  const template = getTemplateByName(name);
  if (!template) {
    error(`Template "${name}" not found`);
    return;
  }

  deleteTemplate(template.id);
  console.log();
  success(`Template "${name}" removed`);
  console.log();
}

// Use a template to start a timer
export function useTemplate(name: string): void {
  const template = getTemplateByName(name);
  if (!template) {
    error(`Template "${name}" not found`);
    return;
  }

  // Increment use count
  incrementTemplateUseCount(template.id);

  // Start timer with template settings
  try {
    startTimer({
      category: template.category_name || undefined,
      project: template.project_name || undefined,
      tags: template.tags || undefined,
      notes: template.notes || undefined,
    });

    console.log();
    success(`Timer started from template "${name}"`);
    console.log();
    console.log(`  Category: ${template.category_name || 'uncategorized'}`);
    if (template.project_name) {
      console.log(`  Project:  ${template.project_name}`);
    }
    if (template.tags) {
      console.log(`  Tags:     ${template.tags}`);
    }
    console.log();
  } catch (err) {
    error((err as Error).message);
  }
}

// Toggle favorite status
export function favoriteTemplate(name: string): void {
  const template = getTemplateByName(name);
  if (!template) {
    error(`Template "${name}" not found`);
    return;
  }

  const isFavorite = toggleTemplateFavorite(template.id);
  console.log();
  if (isFavorite) {
    success(`★ Template "${name}" added to favorites`);
  } else {
    info(`Template "${name}" removed from favorites`);
  }
  console.log();
}

// Edit a template
export function editTemplate(name: string, options: {
  rename?: string;
  category?: string;
  project?: string;
  tags?: string;
  notes?: string;
  clearProject?: boolean;
  clearTags?: boolean;
  clearNotes?: boolean;
}): void {
  const template = getTemplateByName(name);
  if (!template) {
    error(`Template "${name}" not found`);
    return;
  }

  const updates: Parameters<typeof updateTemplate>[1] = {};

  if (options.rename) {
    const existing = getTemplateByName(options.rename);
    if (existing && existing.id !== template.id) {
      error(`Template "${options.rename}" already exists`);
      return;
    }
    updates.name = options.rename;
  }

  if (options.category) {
    const category = getCategoryByName(options.category);
    if (!category) {
      error(`Category "${options.category}" not found`);
      return;
    }
    updates.categoryId = category.id;
  }

  if (options.project) {
    const project = getProjectByName(options.project);
    if (!project) {
      error(`Project "${options.project}" not found`);
      return;
    }
    updates.projectId = project.id;
  } else if (options.clearProject) {
    updates.projectId = null;
  }

  if (options.tags) {
    updates.tags = options.tags;
  } else if (options.clearTags) {
    updates.tags = null;
  }

  if (options.notes) {
    updates.notes = options.notes;
  } else if (options.clearNotes) {
    updates.notes = null;
  }

  updateTemplate(template.id, updates);
  console.log();
  success(`Template "${name}" updated`);
  console.log();
}

// Show template details
export function showTemplate(name: string): void {
  const template = getTemplateByName(name);
  if (!template) {
    error(`Template "${name}" not found`);
    return;
  }

  console.log();
  console.log(chalk.bold(`Template: ${template.name}`) + (template.is_favorite ? chalk.yellow(' ★') : ''));
  console.log();
  console.log(`  Category: ${template.category_name || chalk.dim('none')}`);
  console.log(`  Project:  ${template.project_name || chalk.dim('none')}`);
  console.log(`  Tags:     ${template.tags || chalk.dim('none')}`);
  console.log(`  Notes:    ${template.notes || chalk.dim('none')}`);
  console.log();
  console.log(chalk.dim(`  Used ${template.use_count} time${template.use_count !== 1 ? 's' : ''}`));
  console.log();
  info(`Use with: tt template use ${template.name}`);
  console.log();
}
