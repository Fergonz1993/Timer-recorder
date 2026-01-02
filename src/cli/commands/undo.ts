import chalk from 'chalk';
import {
  popAndExecuteUndo,
  getUndoHistory,
  clearUndoHistory,
  UndoAction,
} from '../../core/undo.js';
import { success, error, info } from '../utils/format.js';

// Execute undo
export function undoCommand(): void {
  const result = popAndExecuteUndo();

  console.log();
  if (result.success) {
    success(result.message);
  } else {
    info(result.message);
  }
  console.log();
}

// Show undo history
export function undoHistoryCommand(options?: { limit?: string }): void {
  const limit = options?.limit ? parseInt(options.limit, 10) : 10;
  const history = getUndoHistory(limit);

  console.log();
  console.log(chalk.bold('Undo History'));
  console.log();

  if (history.length === 0) {
    console.log(chalk.dim('  No undo history'));
    console.log();
    return;
  }

  const formatAction = (action: UndoAction): string => {
    switch (action.action_type) {
      case 'create_entry': return 'Created entry';
      case 'delete_entry': return 'Deleted entry';
      case 'update_entry': return 'Updated entry';
      case 'stop_timer': return 'Stopped timer';
      case 'start_timer': return 'Started timer';
      default: return action.action_type;
    }
  };

  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr + 'Z');
    return date.toLocaleString();
  };

  for (const action of history) {
    const idStr = action.entity_id ? ` #${action.entity_id}` : '';
    console.log(`  ${chalk.dim('•')} ${formatAction(action)}${idStr}`);
    console.log(`    ${chalk.dim(formatTime(action.created_at))}`);
  }

  console.log();
  info('Use `tt undo` to undo the most recent action');
  console.log();
}

// Clear undo history
export function undoClearCommand(): void {
  clearUndoHistory();
  console.log();
  success('Undo history cleared');
  console.log();
}
