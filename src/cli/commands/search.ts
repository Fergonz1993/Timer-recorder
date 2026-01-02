import chalk from 'chalk';
import Table from 'cli-table3';
import { getDatabase } from '../../storage/database.js';
import { formatDuration, formatCategory, formatTime, formatDate } from '../utils/format.js';

interface SearchResult {
  id: number;
  category_name: string | null;
  category_color: string | null;
  project_name: string | null;
  start_time: string;
  duration_seconds: number | null;
  notes: string | null;
}

// Notes column width constant (used for both display and truncation)
const NOTES_COL_WIDTH = 60;

// Search entries by note content
export function searchCommand(query: string, options?: { limit?: string }): void {
  const db = getDatabase();
  const limit = options?.limit ? parseInt(options.limit, 10) : 20;

  // Note: For large datasets, consider implementing FTS5 virtual table
  // For now, using LIKE which works but may be slow on very large databases
  const results = db.prepare(`
    SELECT
      e.id,
      c.name as category_name,
      c.color as category_color,
      p.name as project_name,
      e.start_time,
      e.duration_seconds,
      e.notes
    FROM time_entries e
    LEFT JOIN categories c ON e.category_id = c.id
    LEFT JOIN projects p ON e.project_id = p.id
    WHERE e.notes LIKE ? COLLATE NOCASE
    ORDER BY e.start_time DESC
    LIMIT ?
  `).all(`%${query}%`, limit) as SearchResult[];

  console.log();
  console.log(chalk.bold(`Search: "${query}"`));
  console.log();

  if (results.length === 0) {
    console.log(chalk.dim('  No entries found'));
    console.log();
    return;
  }

  console.log(chalk.dim(`  Found ${results.length} entries`));
  console.log();

  const table = new Table({
    head: [
      chalk.bold('ID'),
      chalk.bold('Date'),
      chalk.bold('Category'),
      chalk.bold('Duration'),
      chalk.bold('Notes'),
    ],
    colWidths: [6, 12, 15, 10, NOTES_COL_WIDTH],
    style: { head: [], border: [] },
    chars: {
      top: '', 'top-mid': '', 'top-left': '', 'top-right': '',
      bottom: '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
      left: '', 'left-mid': '', mid: '', 'mid-mid': '',
      right: '', 'right-mid': '', middle: ' ',
    },
    wordWrap: true,
  });

  for (const entry of results) {
    // Highlight the search term in notes
    const notes = entry.notes || '';
    const highlightedNotes = notes.replace(
      new RegExp(`(${escapeRegex(query)})`, 'gi'),
      chalk.yellow('$1')
    );

    // Truncate notes if too long (using same constant as colWidths)
    const truncatedNotes = highlightedNotes.length > NOTES_COL_WIDTH
      ? highlightedNotes.substring(0, NOTES_COL_WIDTH - 3) + '...'
      : highlightedNotes;

    table.push([
      chalk.dim(`#${entry.id}`),
      formatDate(entry.start_time),
      formatCategory(entry.category_name || 'uncategorized', entry.category_color),
      entry.duration_seconds ? formatDuration(entry.duration_seconds) : chalk.dim('--'),
      truncatedNotes || chalk.dim('--'),
    ]);
  }

  console.log(table.toString());
  console.log();
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
