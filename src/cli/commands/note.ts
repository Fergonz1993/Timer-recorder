import chalk from 'chalk';
import {
  getActiveEntry,
  getEntryById,
  updateEntry,
} from '../../storage/repositories/entries.js';
import { success, error } from '../utils/format.js';

interface NoteOptions {
  entry?: string;
}

// Helper function to append note to existing notes
function appendNote(existing: string | null | undefined, note: string): string {
  return existing ? `${existing}\n${note}` : note;
}

// Add note to active timer or specific entry
export function noteCommand(noteText: string, options?: NoteOptions): void {
  if (options?.entry) {
    // Add note to specific entry
    const entryId = parseInt(options.entry, 10);
    if (isNaN(entryId)) {
      error('Invalid entry ID');
      process.exit(1);
    }

    const entry = getEntryById(entryId);
    if (!entry) {
      error(`Entry #${entryId} not found`);
      process.exit(1);
    }

    // Append note to existing notes
    const newNotes = appendNote(entry.notes, noteText);

    updateEntry(entryId, { notes: newNotes });
    success(`Added note to entry #${entryId}`);
    console.log(chalk.dim(`  ${noteText}`));
  } else {
    // Add note to active timer
    const active = getActiveEntry();
    if (!active) {
      error('No active timer');
      console.log(chalk.dim('\nStart a timer first with: tt start <category>'));
      console.log(chalk.dim('Or specify an entry: tt note "text" --entry <id>'));
      process.exit(1);
    }

    // Get full entry to access notes
    const entry = getEntryById(active.id);
    if (!entry) {
      error('Could not find active entry');
      process.exit(1);
    }

    // Append note to existing notes
    const newNotes = appendNote(entry.notes, noteText);

    updateEntry(active.id, { notes: newNotes });
    success('Added note to current timer');
    console.log(chalk.dim(`  ${noteText}`));
  }
}
