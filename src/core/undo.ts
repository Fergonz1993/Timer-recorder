import { getDatabase } from '../storage/database.js';

export type UndoActionType = 'create_entry' | 'update_entry' | 'delete_entry' | 'start_timer' | 'stop_timer';

export interface UndoAction {
  id: number;
  action_type: UndoActionType;
  entity_type: string;
  entity_id: number | null;
  old_data: string | null;  // JSON serialized
  new_data: string | null;  // JSON serialized
  created_at: string;
}

// Ensure undo table exists
function ensureUndoTable(): void {
  const db = getDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS undo_stack (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      old_data TEXT,
      new_data TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

// Add an action to the undo stack
export function pushUndoAction(action: {
  actionType: UndoActionType;
  entityType: string;
  entityId?: number;
  oldData?: unknown;
  newData?: unknown;
}): void {
  ensureUndoTable();
  const db = getDatabase();

  db.prepare(`
    INSERT INTO undo_stack (action_type, entity_type, entity_id, old_data, new_data)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    action.actionType,
    action.entityType,
    action.entityId ?? null,
    action.oldData ? JSON.stringify(action.oldData) : null,
    action.newData ? JSON.stringify(action.newData) : null
  );

  // Keep only last 50 undo actions
  db.prepare(`
    DELETE FROM undo_stack
    WHERE id NOT IN (
      SELECT id FROM undo_stack ORDER BY id DESC LIMIT 50
    )
  `).run();
}

// Get the last undo action
export function getLastUndoAction(): UndoAction | null {
  ensureUndoTable();
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM undo_stack ORDER BY id DESC LIMIT 1
  `).get() as UndoAction | null;
}

// Pop and execute the last undo action
export function popAndExecuteUndo(): { success: boolean; message: string } {
  ensureUndoTable();
  const db = getDatabase();
  const action = getLastUndoAction();

  if (!action) {
    return { success: false, message: 'Nothing to undo' };
  }

  try {
    switch (action.action_type) {
      case 'create_entry': {
        // Undo create by deleting the entry
        if (action.entity_id) {
          db.prepare('DELETE FROM time_entries WHERE id = ?').run(action.entity_id);
        }
        break;
      }

      case 'delete_entry': {
        // Undo delete by recreating the entry
        if (action.old_data) {
          const data = JSON.parse(action.old_data);
          db.prepare(`
            INSERT INTO time_entries (
              id, category_id, app_name, app_bundle_id, window_title,
              start_time, end_time, duration_seconds, is_manual, notes,
              project_id, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            data.id,
            data.category_id,
            data.app_name,
            data.app_bundle_id,
            data.window_title,
            data.start_time,
            data.end_time,
            data.duration_seconds,
            data.is_manual,
            data.notes,
            data.project_id,
            data.created_at
          );
        }
        break;
      }

      case 'update_entry': {
        // Undo update by restoring old data
        if (action.old_data && action.entity_id) {
          const data = JSON.parse(action.old_data);
          db.prepare(`
            UPDATE time_entries SET
              category_id = ?,
              start_time = ?,
              end_time = ?,
              duration_seconds = ?,
              notes = ?,
              project_id = ?
            WHERE id = ?
          `).run(
            data.category_id,
            data.start_time,
            data.end_time,
            data.duration_seconds,
            data.notes,
            data.project_id,
            action.entity_id
          );
        }
        break;
      }

      case 'stop_timer': {
        // Undo stop by reopening the entry (removing end_time)
        if (action.entity_id) {
          db.prepare(`
            UPDATE time_entries
            SET end_time = NULL, duration_seconds = NULL
            WHERE id = ?
          `).run(action.entity_id);
        }
        break;
      }

      case 'start_timer': {
        // Undo start by deleting the entry if it exists
        if (action.entity_id) {
          db.prepare('DELETE FROM time_entries WHERE id = ?').run(action.entity_id);
        }
        break;
      }
    }

    // Remove the action from the stack
    db.prepare('DELETE FROM undo_stack WHERE id = ?').run(action.id);

    // Generate message
    let message = 'Undid ';
    switch (action.action_type) {
      case 'create_entry': message += 'entry creation'; break;
      case 'delete_entry': message += 'entry deletion'; break;
      case 'update_entry': message += 'entry update'; break;
      case 'stop_timer': message += 'timer stop'; break;
      case 'start_timer': message += 'timer start'; break;
    }

    return { success: true, message };
  } catch (err) {
    return { success: false, message: `Undo failed: ${(err as Error).message}` };
  }
}

// Get undo history
export function getUndoHistory(limit: number = 10): UndoAction[] {
  ensureUndoTable();
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM undo_stack ORDER BY id DESC LIMIT ?
  `).all(limit) as UndoAction[];
}

// Clear undo history
export function clearUndoHistory(): void {
  ensureUndoTable();
  const db = getDatabase();
  db.prepare('DELETE FROM undo_stack').run();
}
