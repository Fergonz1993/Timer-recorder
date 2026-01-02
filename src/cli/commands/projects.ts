import chalk from 'chalk';
import Table from 'cli-table3';
import {
  getAllProjects,
  createProject,
  deleteProject,
  archiveProject,
  getProjectByName,
  getProjectsWithStats,
  getDefaultProject,
  setDefaultProject,
  clearDefaultProject,
  updateProject,
  getClients,
  getProjectsByClient,
} from '../../storage/repositories/projects.js';
import { success, error, warn, formatDuration, formatCategory } from '../utils/format.js';

// List all projects
export function listProjects(options?: { all?: boolean; client?: string }): void {
  let projects;

  if (options?.client) {
    projects = getProjectsByClient(options.client);
  } else {
    projects = options?.all
      ? getAllProjects(false)
      : getProjectsWithStats();
  }

  if (projects.length === 0) {
    console.log();
    console.log(chalk.dim('No projects found'));
    console.log();
    console.log(chalk.dim('Create one with: tt project add <name>'));
    console.log();
    return;
  }

  console.log();
  console.log(chalk.bold('Projects'));
  console.log();

  const table = new Table({
    head: [
      chalk.bold('Name'),
      chalk.bold('Client'),
      chalk.bold('Time'),
      chalk.bold('Entries'),
      chalk.bold('Billable'),
      chalk.bold('Default'),
    ],
    style: { head: [], border: [] },
    chars: {
      top: '', 'top-mid': '', 'top-left': '', 'top-right': '',
      bottom: '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
      left: '', 'left-mid': '', mid: '', 'mid-mid': '',
      right: '', 'right-mid': '', middle: ' ',
    },
  });

  for (const proj of projects) {
    const name = proj.is_active
      ? formatCategory(proj.name, proj.color)
      : chalk.strikethrough(chalk.dim(proj.name));

    // Safe property access with runtime checks
    let totalSeconds = 0;
    let entryCount = 0;
    if ('total_seconds' in proj && typeof (proj as { total_seconds: unknown }).total_seconds === 'number') {
      totalSeconds = (proj as { total_seconds: number }).total_seconds;
    }
    if ('entry_count' in proj && typeof (proj as { entry_count: unknown }).entry_count === 'number') {
      entryCount = (proj as { entry_count: number }).entry_count;
    }

    table.push([
      name,
      proj.client || chalk.dim('--'),
      totalSeconds > 0 ? formatDuration(totalSeconds) : chalk.dim('--'),
      entryCount > 0 ? entryCount.toString() : chalk.dim('--'),
      proj.is_billable ? chalk.green('yes') : chalk.dim('no'),
      proj.is_default ? chalk.yellow('*') : '',
    ]);
  }

  console.log(table.toString());
  console.log();
}

// Add a new project
export function addProject(
  name: string,
  options?: {
    client?: string;
    color?: string;
    description?: string;
    rate?: string;
    billable?: boolean;
  }
): void {
  // Check if project already exists
  if (getProjectByName(name)) {
    error(`Project "${name}" already exists`);
    throw new Error(`Project "${name}" already exists`);
  }

  try {
    // Validate rate if provided
    let hourlyRate: number | null = null;
    if (options?.rate) {
      const rate = parseFloat(options.rate);
      if (!Number.isFinite(rate) || rate < 0) {
        error('Invalid hourly rate: must be a non-negative number');
        process.exit(1);
      }
      hourlyRate = rate;
    }

    const project = createProject({
      name,
      client: options?.client,
      color: options?.color,
      description: options?.description,
      hourlyRate,
      isBillable: options?.billable || false,
    });
    success(`Created project: ${formatCategory(project.name, project.color)}`);

    if (options?.client) {
      console.log(chalk.dim(`  Client: ${options.client}`));
    }
    if (options?.rate) {
      console.log(chalk.dim(`  Rate: $${options.rate}/hr`));
    }
  } catch (err) {
    error('Failed to create project');
    process.exit(1);
  }
}

// Remove a project
export function removeProject(name: string, options?: { force?: boolean }): void {
  const project = getProjectByName(name);
  if (!project) {
    error(`Project "${name}" not found`);
    process.exit(1);
  }

  if (options?.force) {
    if (deleteProject(project.id)) {
      success(`Deleted project: ${name}`);
    } else {
      error('Failed to delete project');
      process.exit(1);
    }
  } else {
    if (archiveProject(project.id)) {
      success(`Archived project: ${name}`);
      console.log(chalk.dim('  Use --force to permanently delete'));
    } else {
      error('Failed to archive project');
      process.exit(1);
    }
  }
}

// Set default project
export function setDefault(name: string): void {
  const project = getProjectByName(name);
  if (!project) {
    error(`Project "${name}" not found`);
    process.exit(1);
  }

  if (!project.is_active) {
    error(`Project "${name}" is archived`);
    process.exit(1);
  }

  setDefaultProject(project.id);
  success(`Set default project: ${formatCategory(project.name, project.color)}`);
}

// Clear default project
export function clearDefault(): void {
  clearDefaultProject();
  success('Cleared default project');
}

// Show project info
export function showProject(name: string): void {
  const project = getProjectByName(name);
  if (!project) {
    error(`Project "${name}" not found`);
    process.exit(1);
  }

  console.log();
  console.log(chalk.bold(formatCategory(project.name, project.color)));
  console.log();

  if (project.description) {
    console.log(project.description);
    console.log();
  }

  console.log(`  ${chalk.dim('Client:')}     ${project.client || chalk.dim('--')}`);
  console.log(`  ${chalk.dim('Billable:')}   ${project.is_billable ? chalk.green('yes') : 'no'}`);
  if (project.hourly_rate) {
    console.log(`  ${chalk.dim('Rate:')}       $${project.hourly_rate}/hr`);
  }
  console.log(`  ${chalk.dim('Active:')}     ${project.is_active ? chalk.green('yes') : chalk.red('no')}`);
  console.log(`  ${chalk.dim('Default:')}    ${project.is_default ? chalk.yellow('yes') : 'no'}`);
  console.log(`  ${chalk.dim('Created:')}    ${new Date(project.created_at).toLocaleDateString()}`);
  console.log();
}

// Update project
export function editProject(
  name: string,
  options: {
    rename?: string;
    client?: string;
    color?: string;
    description?: string;
    rate?: string;
    billable?: boolean;
    notBillable?: boolean;
  }
): void {
  const project = getProjectByName(name);
  if (!project) {
    error(`Project "${name}" not found`);
    process.exit(1);
  }

  const updates: Parameters<typeof updateProject>[1] = {};

  if (options.rename) updates.name = options.rename;
  if (options.client !== undefined) updates.client = options.client || null;
  if (options.color !== undefined) updates.color = options.color || null;
  if (options.description !== undefined) updates.description = options.description || null;
  if (options.rate !== undefined) updates.hourlyRate = options.rate ? parseFloat(options.rate) : null;
  if (options.billable) updates.isBillable = true;
  if (options.notBillable) updates.isBillable = false;

  if (Object.keys(updates).length === 0) {
    warn('No updates specified');
    return;
  }

  const updated = updateProject(project.id, updates);
  if (updated) {
    success(`Updated project: ${formatCategory(updated.name, updated.color)}`);
  } else {
    error('Failed to update project');
    process.exit(1);
  }
}

// List clients
export function listClients(): void {
  const clients = getClients();

  if (clients.length === 0) {
    console.log();
    console.log(chalk.dim('No clients found'));
    console.log();
    return;
  }

  console.log();
  console.log(chalk.bold('Clients'));
  console.log();

  for (const client of clients) {
    console.log(`  ${client}`);
  }

  console.log();
}
