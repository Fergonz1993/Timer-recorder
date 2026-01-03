/**
 * Sync Engine for Multi-Device Synchronization
 *
 * Supports multiple sync backends:
 * - File-based (iCloud, Google Drive, Dropbox)
 * - Self-hosted server
 * - Custom API endpoint
 */

import { getDatabase } from '../storage/database.js';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface SyncConfig {
  enabled: boolean;
  backend: 'file' | 'server' | 'custom';
  // File sync settings
  syncPath?: string;
  // Server sync settings
  serverUrl?: string;
  apiKey?: string;
  // Sync behavior
  autoSync: boolean;
  syncIntervalMinutes: number;
  conflictResolution: 'local' | 'remote' | 'newest';
}

export interface SyncState {
  lastSyncAt: string | null;
  localVersion: number;
  remoteVersion: number;
  deviceId: string;
  pendingChanges: number;
}

export interface SyncChange {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  rowId: number;
  data: Record<string, unknown>;
  timestamp: string;
  deviceId: string;
}

// Get or create device ID
function getDeviceId(): string {
  const db = getDatabase();
  const existing = db.prepare(`SELECT value FROM settings WHERE key = 'device_id'`).get() as { value: string } | undefined;

  if (existing?.value) {
    return existing.value;
  }

  const deviceId = crypto.randomUUID();
  db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('device_id', ?)`).run(deviceId);
  return deviceId;
}

// Get sync config from settings
export function getSyncConfig(): SyncConfig {
  const db = getDatabase();
  const getVal = (key: string) => {
    const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(`sync_${key}`) as { value: string } | undefined;
    return row?.value;
  };

  return {
    enabled: getVal('enabled') === '1',
    backend: (getVal('backend') as SyncConfig['backend']) || 'file',
    syncPath: getVal('path') || undefined,
    serverUrl: getVal('server_url') || undefined,
    apiKey: getVal('api_key') || undefined,
    autoSync: getVal('auto_sync') !== '0',
    syncIntervalMinutes: parseInt(getVal('interval') || '15', 10),
    conflictResolution: (getVal('conflict_resolution') as SyncConfig['conflictResolution']) || 'newest',
  };
}

// Save sync config
export function saveSyncConfig(config: Partial<SyncConfig>): void {
  const db = getDatabase();
  const setVal = (key: string, value: string | undefined) => {
    if (value !== undefined) {
      db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run(`sync_${key}`, value);
    }
  };

  if (config.enabled !== undefined) setVal('enabled', config.enabled ? '1' : '0');
  if (config.backend !== undefined) setVal('backend', config.backend);
  if (config.syncPath !== undefined) setVal('path', config.syncPath);
  if (config.serverUrl !== undefined) setVal('server_url', config.serverUrl);
  if (config.apiKey !== undefined) setVal('api_key', config.apiKey);
  if (config.autoSync !== undefined) setVal('auto_sync', config.autoSync ? '1' : '0');
  if (config.syncIntervalMinutes !== undefined) setVal('interval', config.syncIntervalMinutes.toString());
  if (config.conflictResolution !== undefined) setVal('conflict_resolution', config.conflictResolution);
}

// Get sync state
export function getSyncState(): SyncState {
  const db = getDatabase();
  const getVal = (key: string) => {
    const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(`sync_state_${key}`) as { value: string } | undefined;
    return row?.value || null;
  };

  // Count pending changes (entries modified since last sync)
  const lastSync = getVal('last_sync');
  let pendingChanges = 0;
  if (lastSync) {
    const result = db.prepare(`
      SELECT COUNT(*) as count FROM time_entries
      WHERE updated_at > ?
    `).get(lastSync) as { count: number };
    pendingChanges = result.count;
  }

  return {
    lastSyncAt: getVal('last_sync'),
    localVersion: parseInt(getVal('local_version') || '0', 10),
    remoteVersion: parseInt(getVal('remote_version') || '0', 10),
    deviceId: getDeviceId(),
    pendingChanges,
  };
}

// Export data for sync
export function exportSyncData(): object {
  const db = getDatabase();
  const deviceId = getDeviceId();
  const timestamp = new Date().toISOString();

  // Export all tables that should be synced
  const tables = ['time_entries', 'categories', 'projects', 'tags', 'entry_tags', 'goals'];
  const data: Record<string, unknown[]> = {};

  for (const table of tables) {
    try {
      data[table] = db.prepare(`SELECT * FROM ${table}`).all();
    } catch {
      data[table] = [];
    }
  }

  return {
    version: 1,
    deviceId,
    exportedAt: timestamp,
    data,
  };
}

// Import sync data (merge with local)
export function importSyncData(syncData: {
  version: number;
  deviceId: string;
  exportedAt: string;
  data: Record<string, unknown[]>;
}, conflictResolution: 'local' | 'remote' | 'newest' = 'newest'): {
  imported: number;
  conflicts: number;
  errors: string[]
} {
  const db = getDatabase();
  const localDeviceId = getDeviceId();
  let imported = 0;
  let conflicts = 0;
  const errors: string[] = [];

  // Skip if it's our own data
  if (syncData.deviceId === localDeviceId) {
    return { imported: 0, conflicts: 0, errors: ['Cannot import own data'] };
  }

  // Process each table
  for (const [table, rows] of Object.entries(syncData.data)) {
    if (!Array.isArray(rows)) continue;

    for (const row of rows) {
      try {
        const rowData = row as Record<string, unknown>;
        const id = rowData.id as number;

        // Check if row exists locally
        const existing = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);

        if (!existing) {
          // New row - insert (excluding id for auto-increment)
          const columns = Object.keys(rowData).filter(k => k !== 'id');
          const values = columns.map(c => rowData[c]);
          const placeholders = columns.map(() => '?').join(', ');

          db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`).run(...values);
          imported++;
        } else {
          // Existing row - handle conflict
          conflicts++;

          const localUpdated = (existing as Record<string, unknown>).updated_at as string || '';
          const remoteUpdated = rowData.updated_at as string || '';

          let shouldUpdate = false;
          if (conflictResolution === 'remote') {
            shouldUpdate = true;
          } else if (conflictResolution === 'newest') {
            shouldUpdate = remoteUpdated > localUpdated;
          }
          // If 'local', shouldUpdate stays false

          if (shouldUpdate) {
            const columns = Object.keys(rowData).filter(k => k !== 'id');
            const setClause = columns.map(c => `${c} = ?`).join(', ');
            const values = columns.map(c => rowData[c]);

            db.prepare(`UPDATE ${table} SET ${setClause} WHERE id = ?`).run(...values, id);
            imported++;
          }
        }
      } catch (e) {
        errors.push(`Error in ${table}: ${e instanceof Error ? e.message : 'Unknown'}`);
      }
    }
  }

  // Update sync state
  db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('sync_state_last_sync', ?)`).run(new Date().toISOString());

  return { imported, conflicts, errors };
}

// File-based sync: write to sync folder
export async function syncToFile(syncPath: string): Promise<{ success: boolean; error?: string }> {
  try {
    const data = exportSyncData();
    const deviceId = getDeviceId();
    const filename = `timer-record-${deviceId}.json`;
    const filepath = path.join(syncPath, filename);

    // Ensure directory exists
    if (!fs.existsSync(syncPath)) {
      fs.mkdirSync(syncPath, { recursive: true });
    }

    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));

    // Update last sync time
    const db = getDatabase();
    db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('sync_state_last_sync', ?)`).run(new Date().toISOString());

    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

// File-based sync: read from sync folder
export async function syncFromFile(syncPath: string): Promise<{
  success: boolean;
  imported: number;
  conflicts: number;
  error?: string
}> {
  try {
    const deviceId = getDeviceId();
    const files = fs.readdirSync(syncPath).filter(f =>
      f.startsWith('timer-record-') && f.endsWith('.json') && !f.includes(deviceId)
    );

    let totalImported = 0;
    let totalConflicts = 0;

    const config = getSyncConfig();

    for (const file of files) {
      const filepath = path.join(syncPath, file);
      const content = fs.readFileSync(filepath, 'utf-8');
      const data = JSON.parse(content);

      const result = importSyncData(data, config.conflictResolution);
      totalImported += result.imported;
      totalConflicts += result.conflicts;
    }

    return { success: true, imported: totalImported, conflicts: totalConflicts };
  } catch (e) {
    return { success: false, imported: 0, conflicts: 0, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

// Full sync (push local, pull remote)
export async function performSync(): Promise<{
  success: boolean;
  pushed: boolean;
  imported: number;
  conflicts: number;
  error?: string;
}> {
  const config = getSyncConfig();

  if (!config.enabled) {
    return { success: false, pushed: false, imported: 0, conflicts: 0, error: 'Sync is not enabled' };
  }

  if (config.backend === 'file' && config.syncPath) {
    // Push local changes
    const pushResult = await syncToFile(config.syncPath);
    if (!pushResult.success) {
      return { success: false, pushed: false, imported: 0, conflicts: 0, error: pushResult.error };
    }

    // Pull remote changes
    const pullResult = await syncFromFile(config.syncPath);
    return {
      success: pullResult.success,
      pushed: true,
      imported: pullResult.imported,
      conflicts: pullResult.conflicts,
      error: pullResult.error,
    };
  }

  // TODO: Implement server sync
  return { success: false, pushed: false, imported: 0, conflicts: 0, error: 'Backend not implemented' };
}
