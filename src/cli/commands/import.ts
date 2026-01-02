import { readFileSync, existsSync } from 'fs';
import chalk from 'chalk';
import { getDatabase } from '../../storage/database.js';
import { getCategoryByName, createCategory } from '../../storage/repositories/categories.js';
import { getProjectByName, createProject } from '../../storage/repositories/projects.js';
import { success, error, info } from '../utils/format.js';

interface ImportEntry {
  start_time: string;
  end_time?: string;
  duration_seconds?: number;
  category?: string;
  project?: string;
  notes?: string;
  tags?: string[];
}

// Import from JSON file
export function importJson(filePath: string, options?: { dryRun?: boolean }): void {
  if (!existsSync(filePath)) {
    error(`File not found: ${filePath}`);
    return;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    // Handle both array and object with entries property
    const entries: ImportEntry[] = Array.isArray(data) ? data : data.entries || [];

    if (entries.length === 0) {
      error('No entries found in file');
      return;
    }

    console.log();
    console.log(chalk.bold(`Importing ${entries.length} entries from JSON`));
    console.log();

    if (options?.dryRun) {
      info('Dry run mode - no changes will be made');
      console.log();
    }

    const db = getDatabase();
    let imported = 0;
    let skipped = 0;

    for (const entry of entries) {
      if (!entry.start_time) {
        skipped++;
        continue;
      }

      // Get or create category
      let categoryId: number | null = null;
      if (entry.category) {
        let category = getCategoryByName(entry.category);
        if (!category && !options?.dryRun) {
          category = createCategory(entry.category);
        }
        categoryId = category?.id || null;
      }

      // Get or create project
      let projectId: number | null = null;
      if (entry.project) {
        let project = getProjectByName(entry.project);
        if (!project && !options?.dryRun) {
          project = createProject({ name: entry.project });
        }
        projectId = project?.id || null;
      }

      if (!options?.dryRun) {
        db.prepare(`
          INSERT INTO time_entries (
            category_id, project_id, start_time, end_time,
            duration_seconds, notes, is_manual
          )
          VALUES (?, ?, ?, ?, ?, ?, 1)
        `).run(
          categoryId,
          projectId,
          entry.start_time,
          entry.end_time || null,
          entry.duration_seconds || null,
          entry.notes || null
        );
      }

      imported++;
    }

    if (options?.dryRun) {
      console.log(`  Would import: ${imported} entries`);
      console.log(`  Would skip:   ${skipped} entries`);
    } else {
      success(`Imported ${imported} entries`);
      if (skipped > 0) {
        console.log(chalk.dim(`  Skipped ${skipped} invalid entries`));
      }
    }
    console.log();
  } catch (err) {
    error(`Failed to import: ${(err as Error).message}`);
  }
}

// Import from CSV file
export function importCsv(filePath: string, options?: { dryRun?: boolean }): void {
  if (!existsSync(filePath)) {
    error(`File not found: ${filePath}`);
    return;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');

    if (lines.length < 2) {
      error('CSV file is empty or has no data rows');
      return;
    }

    // Parse header
    const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const startTimeIdx = header.findIndex(h => h === 'start_time' || h === 'start' || h === 'started');
    const endTimeIdx = header.findIndex(h => h === 'end_time' || h === 'end' || h === 'ended');
    const durationIdx = header.findIndex(h => h === 'duration' || h === 'duration_seconds');
    const categoryIdx = header.findIndex(h => h === 'category');
    const projectIdx = header.findIndex(h => h === 'project');
    const notesIdx = header.findIndex(h => h === 'notes' || h === 'description');

    if (startTimeIdx === -1) {
      error('CSV must have a start_time column');
      return;
    }

    console.log();
    console.log(chalk.bold(`Importing from CSV (${lines.length - 1} rows)`));
    console.log();

    if (options?.dryRun) {
      info('Dry run mode - no changes will be made');
      console.log();
    }

    const db = getDatabase();
    let imported = 0;
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);

      const startTime = values[startTimeIdx];
      if (!startTime) {
        skipped++;
        continue;
      }

      const endTime = endTimeIdx >= 0 ? values[endTimeIdx] : null;
      const duration = durationIdx >= 0 ? parseInt(values[durationIdx], 10) : null;
      const categoryName = categoryIdx >= 0 ? values[categoryIdx] : null;
      const projectName = projectIdx >= 0 ? values[projectIdx] : null;
      const notes = notesIdx >= 0 ? values[notesIdx] : null;

      // Get or create category
      let categoryId: number | null = null;
      if (categoryName) {
        let category = getCategoryByName(categoryName);
        if (!category && !options?.dryRun) {
          category = createCategory(categoryName);
        }
        categoryId = category?.id || null;
      }

      // Get or create project
      let projectId: number | null = null;
      if (projectName) {
        let project = getProjectByName(projectName);
        if (!project && !options?.dryRun) {
          project = createProject({ name: projectName });
        }
        projectId = project?.id || null;
      }

      if (!options?.dryRun) {
        db.prepare(`
          INSERT INTO time_entries (
            category_id, project_id, start_time, end_time,
            duration_seconds, notes, is_manual
          )
          VALUES (?, ?, ?, ?, ?, ?, 1)
        `).run(
          categoryId,
          projectId,
          startTime,
          endTime || null,
          isNaN(duration!) ? null : duration,
          notes || null
        );
      }

      imported++;
    }

    if (options?.dryRun) {
      console.log(`  Would import: ${imported} entries`);
      console.log(`  Would skip:   ${skipped} entries`);
    } else {
      success(`Imported ${imported} entries`);
      if (skipped > 0) {
        console.log(chalk.dim(`  Skipped ${skipped} invalid entries`));
      }
    }
    console.log();
  } catch (err) {
    error(`Failed to import: ${(err as Error).message}`);
  }
}

// Parse CSV line handling quoted values
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

// Show import help
export function importHelp(): void {
  console.log();
  console.log(chalk.bold('Import Time Entries'));
  console.log();
  console.log('Import from JSON:');
  console.log('  tt import json <file>');
  console.log('  tt import json entries.json --dry-run');
  console.log();
  console.log('Import from CSV:');
  console.log('  tt import csv <file>');
  console.log('  tt import csv timesheet.csv --dry-run');
  console.log();
  console.log('JSON format:');
  console.log('  [');
  console.log('    {');
  console.log('      "start_time": "2024-01-15T09:00:00",');
  console.log('      "end_time": "2024-01-15T10:30:00",');
  console.log('      "category": "programming",');
  console.log('      "project": "MyProject",');
  console.log('      "notes": "Working on feature X"');
  console.log('    }');
  console.log('  ]');
  console.log();
  console.log('CSV format:');
  console.log('  start_time,end_time,category,project,notes');
  console.log('  2024-01-15T09:00:00,2024-01-15T10:30:00,programming,MyProject,"Notes here"');
  console.log();
}
