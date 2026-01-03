/**
 * Sync commands for multi-device synchronization
 */

import chalk from 'chalk';
import { success, error, info } from '../utils/format.js';
import {
  getSyncConfig,
  saveSyncConfig,
  getSyncState,
  performSync,
  SyncConfig,
} from '../../sync/sync-engine.js';

// Show sync status
export function syncStatusCommand(): void {
  console.log();

  const config = getSyncConfig();
  const state = getSyncState();

  console.log(chalk.bold('Sync Status'));
  console.log();

  if (!config.enabled) {
    console.log(`  Status:   ${chalk.dim('Disabled')}`);
    console.log();
    info('Enable sync with: tt sync enable --path <folder>');
    console.log();
    return;
  }

  console.log(`  Status:   ${chalk.green('Enabled')}`);
  console.log(`  Backend:  ${config.backend}`);

  if (config.backend === 'file' && config.syncPath) {
    console.log(`  Path:     ${config.syncPath}`);
  } else if (config.backend === 'server' && config.serverUrl) {
    console.log(`  Server:   ${config.serverUrl}`);
  }

  console.log();
  console.log(`  Device ID:        ${chalk.cyan(state.deviceId.slice(0, 8))}...`);
  console.log(`  Last Sync:        ${state.lastSyncAt ? new Date(state.lastSyncAt).toLocaleString() : chalk.dim('Never')}`);
  console.log(`  Pending Changes:  ${state.pendingChanges > 0 ? chalk.yellow(state.pendingChanges.toString()) : '0'}`);
  console.log(`  Auto Sync:        ${config.autoSync ? 'Yes' : 'No'}`);
  console.log(`  Conflict Mode:    ${config.conflictResolution}`);
  console.log();
}

// Enable sync
export function syncEnableCommand(options: {
  path?: string;
  server?: string;
  apiKey?: string;
  interval?: string;
  conflict?: 'local' | 'remote' | 'newest';
}): void {
  console.log();

  if (!options.path && !options.server) {
    error('Please specify sync location:');
    console.log();
    console.log('  File sync (iCloud, Dropbox, etc):');
    console.log(`    ${chalk.dim('tt sync enable --path ~/Library/Mobile\\ Documents/com~apple~CloudDocs/TimerRecord')}`);
    console.log();
    console.log('  Server sync:');
    console.log(`    ${chalk.dim('tt sync enable --server https://sync.example.com --api-key <key>')}`);
    console.log();
    return;
  }

  const config: Partial<SyncConfig> = {
    enabled: true,
    autoSync: true,
    syncIntervalMinutes: options.interval ? parseInt(options.interval, 10) : 15,
    conflictResolution: options.conflict || 'newest',
  };

  if (options.path) {
    config.backend = 'file';
    config.syncPath = options.path;
  } else if (options.server) {
    config.backend = 'server';
    config.serverUrl = options.server;
    config.apiKey = options.apiKey;
  }

  saveSyncConfig(config);

  success('Sync enabled!');
  console.log();

  if (options.path) {
    console.log(`  Sync folder: ${options.path}`);
    console.log();
    info('Run `tt sync now` to sync immediately');
  }

  console.log();
}

// Disable sync
export function syncDisableCommand(): void {
  console.log();

  saveSyncConfig({ enabled: false });

  success('Sync disabled');
  console.log();
}

// Sync now
export async function syncNowCommand(): Promise<void> {
  console.log();

  const config = getSyncConfig();

  if (!config.enabled) {
    error('Sync is not enabled. Run: tt sync enable --path <folder>');
    console.log();
    return;
  }

  console.log('Syncing...');
  console.log();

  try {
    const result = await performSync();

    if (result.success) {
      success('Sync complete!');
      console.log();

      if (result.pushed) {
        console.log(`  ${chalk.green('✓')} Pushed local changes`);
      }

      if (result.imported > 0) {
        console.log(`  ${chalk.green('✓')} Imported ${result.imported} changes from other devices`);
      }

      if (result.conflicts > 0) {
        console.log(`  ${chalk.yellow('!')} ${result.conflicts} conflicts resolved (${config.conflictResolution})`);
      }

      if (!result.pushed && result.imported === 0) {
        console.log(`  ${chalk.dim('○')} No changes to sync`);
      }
    } else {
      error(`Sync failed: ${result.error}`);
    }
  } catch (e) {
    error(`Sync error: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }

  console.log();
}

// Configure sync settings
export function syncConfigCommand(options: {
  interval?: string;
  conflict?: 'local' | 'remote' | 'newest';
  autoSync?: string;
}): void {
  console.log();

  const config: Partial<SyncConfig> = {};

  if (options.interval) {
    config.syncIntervalMinutes = parseInt(options.interval, 10);
  }

  if (options.conflict) {
    config.conflictResolution = options.conflict;
  }

  if (options.autoSync !== undefined) {
    config.autoSync = options.autoSync === 'true' || options.autoSync === '1';
  }

  if (Object.keys(config).length > 0) {
    saveSyncConfig(config);
    success('Sync configuration updated');
  } else {
    // Show current config
    const current = getSyncConfig();
    console.log(chalk.bold('Sync Configuration'));
    console.log();
    console.log(`  Interval:    ${current.syncIntervalMinutes} minutes`);
    console.log(`  Auto Sync:   ${current.autoSync ? 'Yes' : 'No'}`);
    console.log(`  Conflicts:   ${current.conflictResolution}`);
    console.log();
    console.log('Configure with:');
    console.log(`  ${chalk.dim('tt sync config --interval 30')}`);
    console.log(`  ${chalk.dim('tt sync config --conflict newest|local|remote')}`);
    console.log(`  ${chalk.dim('tt sync config --auto-sync true|false')}`);
  }

  console.log();
}
