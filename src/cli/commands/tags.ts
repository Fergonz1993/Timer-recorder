import chalk from 'chalk';
import Table from 'cli-table3';
import {
  getAllTags,
  createTag,
  deleteTag,
  getTagByName,
  getTagsWithCount,
  updateTag,
  attachTagToEntry,
  detachTagFromEntry,
  getTagsForEntry,
  getTagSummary,
} from '../../storage/repositories/tags.js';
import { getEntryById } from '../../storage/repositories/entries.js';
import { success, error, warn, formatDuration, formatCategory } from '../utils/format.js';

// List all tags
export function listTags(options?: { usage?: boolean }): void {
  const tags = options?.usage ? getTagsWithCount() : getAllTags();

  if (tags.length === 0) {
    console.log();
    console.log(chalk.dim('No tags found'));
    console.log();
    console.log(chalk.dim('Create one with: tt tag add <name>'));
    console.log();
    return;
  }

  console.log();
  console.log(chalk.bold('Tags'));
  console.log();

  if (options?.usage) {
    const tagsWithCount = tags as import('../../types/index.js').TagWithCount[];
    const table = new Table({
      head: [
        chalk.bold('Name'),
        chalk.bold('Color'),
        chalk.bold('Entries'),
      ],
      style: { head: [], border: [] },
      chars: {
        top: '', 'top-mid': '', 'top-left': '', 'top-right': '',
        bottom: '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
        left: '', 'left-mid': '', mid: '', 'mid-mid': '',
        right: '', 'right-mid': '', middle: ' ',
      },
    });

    for (const tag of tagsWithCount) {
      table.push([
        formatCategory(tag.name, tag.color),
        tag.color ? chalk.hex(tag.color)('██') : chalk.dim('--'),
        tag.usage_count > 0 ? tag.usage_count.toString() : chalk.dim('--'),
      ]);
    }

    console.log(table.toString());
  } else {
    for (const tag of tags) {
      const colorBlock = tag.color ? chalk.hex(tag.color)('██ ') : '';
      console.log(`  ${colorBlock}${formatCategory(tag.name, tag.color)}`);
    }
  }

  console.log();
}

// Add a new tag
export function addTag(
  name: string,
  options?: { color?: string }
): void {
  // Check if tag already exists
  if (getTagByName(name)) {
    error(`Tag "${name}" already exists`);
    process.exit(1);
  }

  try {
    const tag = createTag({
      name,
      color: options?.color,
    });
    success(`Created tag: ${formatCategory(tag.name, tag.color)}`);
  } catch (err) {
    error('Failed to create tag');
    process.exit(1);
  }
}

// Remove a tag
export function removeTag(name: string): void {
  const tag = getTagByName(name);
  if (!tag) {
    error(`Tag "${name}" not found`);
    process.exit(1);
  }

  if (deleteTag(tag.id)) {
    success(`Removed tag: ${name}`);
  } else {
    error('Failed to remove tag');
    process.exit(1);
  }
}

// Update tag
export function editTag(
  name: string,
  options: { rename?: string; color?: string }
): void {
  const tag = getTagByName(name);
  if (!tag) {
    error(`Tag "${name}" not found`);
    process.exit(1);
  }

  const updates: { name?: string; color?: string | null } = {};

  if (options.rename) updates.name = options.rename;
  if (options.color !== undefined) updates.color = options.color || null;

  if (Object.keys(updates).length === 0) {
    warn('No updates specified');
    return;
  }

  const updated = updateTag(tag.id, updates);
  if (updated) {
    success(`Updated tag: ${formatCategory(updated.name, updated.color)}`);
  } else {
    error('Failed to update tag');
    process.exit(1);
  }
}

// Attach tag to entry
export function attachTag(entryId: string, tagName: string): void {
  const id = parseInt(entryId, 10);
  if (isNaN(id)) {
    error('Invalid entry ID');
    process.exit(1);
  }

  const entry = getEntryById(id);
  if (!entry) {
    error(`Entry #${id} not found`);
    process.exit(1);
  }

  let tag = getTagByName(tagName);
  if (!tag) {
    // Create tag if it doesn't exist
    tag = createTag({ name: tagName });
    console.log(chalk.dim(`Created tag: ${tagName}`));
  }

  try {
    attachTagToEntry(id, tag.id);
    success(`Tagged entry #${id} with: ${formatCategory(tag.name, tag.color)}`);
  } catch (err) {
    error('Failed to attach tag');
    process.exit(1);
  }
}

// Detach tag from entry
export function detachTag(entryId: string, tagName: string): void {
  const id = parseInt(entryId, 10);
  if (isNaN(id)) {
    error('Invalid entry ID');
    process.exit(1);
  }

  // Validate entry exists first
  const entry = getEntryById(id);
  if (!entry) {
    error(`Entry #${id} not found`);
    process.exit(1);
  }

  const tag = getTagByName(tagName);
  if (!tag) {
    error(`Tag "${tagName}" not found`);
    process.exit(1);
  }

  if (detachTagFromEntry(id, tag.id)) {
    success(`Removed tag "${tagName}" from entry #${id}`);
  } else {
    warn(`Entry #${id} does not have tag "${tagName}"`);
  }
}

// Show tags for entry
export function showEntryTags(entryId: string): void {
  const id = parseInt(entryId, 10);
  if (isNaN(id)) {
    error('Invalid entry ID');
    process.exit(1);
  }

  const entry = getEntryById(id);
  if (!entry) {
    error(`Entry #${id} not found`);
    process.exit(1);
  }

  const tags = getTagsForEntry(id);

  console.log();
  console.log(chalk.bold(`Tags for entry #${id}`));
  console.log();

  if (tags.length === 0) {
    console.log(chalk.dim('No tags'));
  } else {
    for (const tag of tags) {
      console.log(`  ${formatCategory(tag.name, tag.color)}`);
    }
  }

  console.log();
}

// Show tag summary
export function showTagSummary(options?: { from?: string; to?: string }): void {
  const today = new Date().toISOString().split('T')[0];
  const startDate = options?.from || today;
  const endDate = options?.to || today;

  const summary = getTagSummary(startDate, endDate);

  if (summary.length === 0) {
    console.log();
    console.log(chalk.dim('No tag data for this period'));
    console.log();
    return;
  }

  console.log();
  console.log(chalk.bold('Tag Summary'));
  console.log(chalk.dim(`${startDate} to ${endDate}`));
  console.log();

  const table = new Table({
    head: [
      chalk.bold('Tag'),
      chalk.bold('Time'),
      chalk.bold('Entries'),
    ],
    style: { head: [], border: [] },
    chars: {
      top: '', 'top-mid': '', 'top-left': '', 'top-right': '',
      bottom: '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
      left: '', 'left-mid': '', mid: '', 'mid-mid': '',
      right: '', 'right-mid': '', middle: ' ',
    },
  });

  for (const item of summary) {
    table.push([
      formatCategory(item.tag, item.color),
      formatDuration(item.total_seconds),
      item.entry_count.toString(),
    ]);
  }

  console.log(table.toString());
  console.log();
}
