import chalk from 'chalk';
import Table from 'cli-table3';
import { writeFileSync } from 'fs';
import {
  runPrivacyAudit,
  secureDeleteDatabase,
  wipeAllData,
  exportAllData,
  enablePrivacyLockdown,
  disablePrivacyLockdown,
  isPrivacyLockdownEnabled,
  enableAnonymousMode,
  disableAnonymousMode,
  isAnonymousModeEnabled,
  setDataRetention,
  getDataRetentionSettings,
  runDataRetentionCleanup,
  createEncryptedBackup,
  restoreEncryptedBackup,
  checkDashboardSecurity,
} from '../../privacy/index.js';
import { success, error, info, warn } from '../utils/format.js';

// Format bytes to human-readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Show privacy audit - what data exists and where
 */
export function privacyAuditCommand(): void {
  const audit = runPrivacyAudit();

  console.log();
  console.log(chalk.bold.green('Privacy Audit Report'));
  console.log(chalk.gray('━'.repeat(60)));
  console.log();

  // Database section
  console.log(chalk.bold.cyan('Database'));
  console.log(chalk.gray(`  Path: ${audit.database.path}`));
  if (audit.database.exists) {
    console.log(chalk.gray(`  Size: ${formatBytes(audit.database.size)}`));
    console.log(chalk.gray(`  Entries: ${audit.database.entries}`));
    console.log(chalk.gray(`  Categories: ${audit.database.categories}`));
    console.log(chalk.gray(`  Projects: ${audit.database.projects}`));
    console.log(chalk.gray(`  Tags: ${audit.database.tags}`));
    if (audit.database.oldestEntry) {
      console.log(chalk.gray(`  Date range: ${audit.database.oldestEntry.split('T')[0]} to ${audit.database.newestEntry?.split('T')[0]}`));
    }
  } else {
    console.log(chalk.yellow('  [Not created yet]'));
  }
  console.log();

  // Config section
  console.log(chalk.bold.cyan('Configuration'));
  console.log(chalk.gray(`  Path: ${audit.config.path}`));
  if (audit.config.exists) {
    console.log(chalk.gray(`  Size: ${formatBytes(audit.config.size)}`));
  } else {
    console.log(chalk.yellow('  [Using defaults]'));
  }
  console.log();

  // Logs section
  console.log(chalk.bold.cyan('Logs'));
  console.log(chalk.gray(`  Path: ${audit.logs.path}`));
  if (audit.logs.exists) {
    console.log(chalk.gray(`  Size: ${formatBytes(audit.logs.size)}`));
  } else {
    console.log(chalk.green('  [No logs]'));
  }
  console.log();

  // Daemon section
  console.log(chalk.bold.cyan('Background Daemon'));
  console.log(chalk.gray(`  Running: ${audit.daemon.running ? chalk.yellow('Yes') : chalk.green('No')}`));
  console.log(chalk.gray(`  macOS launchd: ${audit.daemon.launchdInstalled ? chalk.yellow('Installed') : chalk.green('Not installed')}`));
  console.log(chalk.gray(`  Linux systemd: ${audit.daemon.systemdInstalled ? chalk.yellow('Installed') : chalk.green('Not installed')}`));
  console.log();

  // Network section
  console.log(chalk.bold.cyan('Network Exposure'));
  if (audit.network.webhooksConfigured > 0) {
    console.log(chalk.yellow(`  Webhooks: ${audit.network.webhooksConfigured} configured (sends data to external URLs)`));
  } else {
    console.log(chalk.green('  Webhooks: None configured'));
  }
  console.log(chalk.green('  Dashboard: Localhost only (127.0.0.1)'));
  console.log();

  // Privacy modes
  console.log(chalk.bold.cyan('Privacy Settings'));
  console.log(chalk.gray(`  Lockdown mode: ${audit.encryption.enabled ? chalk.green('Enabled') : chalk.gray('Disabled')}`));
  console.log(chalk.gray(`  Anonymous mode: ${audit.anonymousMode.enabled ? chalk.green('Enabled') : chalk.gray('Disabled')}`));
  if (audit.dataRetention.enabled) {
    console.log(chalk.gray(`  Data retention: ${chalk.green(`${audit.dataRetention.days} days`)}`));
  } else {
    console.log(chalk.gray(`  Data retention: ${chalk.gray('Disabled (data kept forever)')}`));
  }
  console.log();

  // Summary
  console.log(chalk.bold.cyan('Summary'));
  console.log(chalk.green('  All data is stored locally on your machine.'));
  console.log(chalk.green('  No data is sent to any server by default.'));
  if (audit.network.webhooksConfigured > 0) {
    console.log(chalk.yellow(`  Note: You have ${audit.network.webhooksConfigured} webhook(s) that may send data externally.`));
  }
  console.log();
}

/**
 * Export all data (GDPR-style)
 */
export function privacyExportCommand(options: { output?: string; format?: string }): void {
  console.log();
  info('Exporting all your data...');

  const data = exportAllData();
  const format = options.format || 'json';

  let content: string;
  let filename: string;

  if (format === 'json') {
    content = JSON.stringify(data, null, 2);
    filename = options.output || `timer-record-export-${Date.now()}.json`;
  } else {
    error('Unsupported format. Use --format json');
    return;
  }

  writeFileSync(filename, content);

  console.log();
  success(`Exported all data to: ${filename}`);
  console.log();
  console.log(chalk.gray('  Included:'));
  console.log(chalk.gray(`    - ${data.entries.length} time entries`));
  console.log(chalk.gray(`    - ${data.categories.length} categories`));
  console.log(chalk.gray(`    - ${data.projects.length} projects`));
  console.log(chalk.gray(`    - ${data.tags.length} tags`));
  console.log(chalk.gray(`    - ${data.goals.length} goals`));
  console.log(chalk.gray(`    - ${data.templates.length} templates`));
  console.log(chalk.gray(`    - ${data.invoices.length} invoices`));
  console.log(chalk.gray(`    - ${data.webhooks.length} webhooks`));
  console.log(chalk.gray(`    - Configuration settings`));
  console.log();
}

/**
 * Secure delete database
 */
export function privacySecureDeleteCommand(options: { confirm?: boolean }): void {
  console.log();

  if (!options.confirm) {
    warn('This will PERMANENTLY and SECURELY delete your database!');
    console.log();
    console.log(chalk.gray('  This operation:'));
    console.log(chalk.gray('  - Overwrites data multiple times before deletion'));
    console.log(chalk.gray('  - Cannot be undone'));
    console.log(chalk.gray('  - Removes all time entries, categories, projects, etc.'));
    console.log();
    console.log(chalk.yellow('  Run with --confirm to proceed'));
    console.log();
    return;
  }

  const result = secureDeleteDatabase();

  if (result.success) {
    success(result.message);
  } else {
    error(result.message);
  }
  console.log();
}

/**
 * Complete data wipe
 */
export function privacyWipeCommand(options: { confirm?: boolean; keepConfig?: boolean }): void {
  console.log();

  if (!options.confirm) {
    warn('This will PERMANENTLY delete ALL Timer Record data!');
    console.log();
    console.log(chalk.gray('  This operation:'));
    console.log(chalk.gray('  - Securely deletes the database'));
    console.log(chalk.gray('  - Removes configuration files (unless --keep-config)'));
    console.log(chalk.gray('  - Deletes log files'));
    console.log(chalk.gray('  - Uninstalls system services'));
    console.log(chalk.gray('  - Cannot be undone'));
    console.log();
    console.log(chalk.yellow('  Run with --confirm to proceed'));
    console.log(chalk.gray('  Add --keep-config to preserve your settings'));
    console.log();
    return;
  }

  info('Wiping all data...');
  const result = wipeAllData({ keepConfig: options.keepConfig });

  console.log();
  if (result.deleted.length > 0) {
    success(`Deleted ${result.deleted.length} items:`);
    result.deleted.forEach(path => {
      console.log(chalk.gray(`  - ${path}`));
    });
  }

  if (result.failed.length > 0) {
    error(`Failed to delete ${result.failed.length} items:`);
    result.failed.forEach(path => {
      console.log(chalk.red(`  - ${path}`));
    });
  }

  if (result.success) {
    console.log();
    success('All Timer Record data has been wiped.');
  }
  console.log();
}

/**
 * Privacy lockdown mode
 */
export function privacyLockdownCommand(action: string): void {
  console.log();

  if (action === 'enable') {
    const result = enablePrivacyLockdown();
    success('Privacy lockdown enabled');
    console.log();
    result.changes.forEach(change => {
      console.log(chalk.gray(`  - ${change}`));
    });
  } else if (action === 'disable') {
    const result = disablePrivacyLockdown();
    success('Privacy lockdown disabled');
    console.log();
    result.changes.forEach(change => {
      console.log(chalk.gray(`  - ${change}`));
    });
  } else if (action === 'status') {
    const enabled = isPrivacyLockdownEnabled();
    if (enabled) {
      console.log(chalk.green('Privacy lockdown is ENABLED'));
      console.log();
      console.log(chalk.gray('  - Webhooks are disabled'));
      console.log(chalk.gray('  - Dashboard is disabled'));
      console.log(chalk.gray('  - No network features active'));
    } else {
      console.log(chalk.gray('Privacy lockdown is disabled'));
    }
  } else {
    error('Unknown action. Use: enable, disable, or status');
  }
  console.log();
}

/**
 * Anonymous tracking mode
 */
export function privacyAnonymousCommand(action: string): void {
  console.log();

  if (action === 'enable') {
    enableAnonymousMode();
    success('Anonymous mode enabled');
    console.log();
    console.log(chalk.gray('  New entries will not store:'));
    console.log(chalk.gray('  - Application names'));
    console.log(chalk.gray('  - Window titles'));
    console.log(chalk.gray('  - Bundle identifiers'));
    console.log();
    console.log(chalk.yellow('  Note: Only affects new entries, not existing data.'));
  } else if (action === 'disable') {
    disableAnonymousMode();
    success('Anonymous mode disabled');
    console.log(chalk.gray('  Full app/window tracking restored.'));
  } else if (action === 'status') {
    const enabled = isAnonymousModeEnabled();
    if (enabled) {
      console.log(chalk.green('Anonymous mode is ENABLED'));
      console.log(chalk.gray('  App names and window titles are not being stored.'));
    } else {
      console.log(chalk.gray('Anonymous mode is disabled'));
      console.log(chalk.gray('  Full app/window tracking is active.'));
    }
  } else {
    error('Unknown action. Use: enable, disable, or status');
  }
  console.log();
}

/**
 * Data retention settings
 */
export function privacyRetentionCommand(options: { days?: string; disable?: boolean; cleanup?: boolean }): void {
  console.log();

  if (options.cleanup) {
    const result = runDataRetentionCleanup();
    if (result.deleted > 0) {
      success(`Cleaned up ${result.deleted} old entries`);
    } else {
      info('No entries to clean up');
    }
    console.log();
    return;
  }

  if (options.disable) {
    setDataRetention(null);
    success('Data retention disabled');
    console.log(chalk.gray('  Data will be kept indefinitely.'));
    console.log();
    return;
  }

  if (options.days) {
    const days = parseInt(options.days, 10);
    if (isNaN(days) || days <= 0) {
      error('Days must be a positive number');
      console.log();
      return;
    }
    setDataRetention(days);
    success(`Data retention set to ${days} days`);
    console.log(chalk.gray(`  Entries older than ${days} days will be deleted on cleanup.`));
    console.log(chalk.gray('  Run with --cleanup to delete old entries now.'));
    console.log();
    return;
  }

  // Show current settings
  const settings = getDataRetentionSettings();
  console.log(chalk.bold('Data Retention Settings'));
  console.log();
  if (settings.enabled) {
    console.log(chalk.green(`  Retention period: ${settings.days} days`));
    console.log(chalk.gray('  Entries older than this will be deleted on cleanup.'));
  } else {
    console.log(chalk.gray('  Data retention is disabled'));
    console.log(chalk.gray('  Data is kept indefinitely.'));
  }
  console.log();
  console.log(chalk.gray('  Commands:'));
  console.log(chalk.gray('    tt privacy retention --days 90    Set retention to 90 days'));
  console.log(chalk.gray('    tt privacy retention --disable    Keep data forever'));
  console.log(chalk.gray('    tt privacy retention --cleanup    Delete old entries now'));
  console.log();
}

/**
 * Encrypted backup
 */
export async function privacyBackupCommand(options: { password?: string; output?: string }): Promise<void> {
  console.log();

  if (!options.password) {
    error('Password required for encrypted backup');
    console.log();
    console.log(chalk.gray('  Usage: tt privacy backup --password "your-secret-password"'));
    console.log();
    return;
  }

  if (options.password.length < 8) {
    error('Password must be at least 8 characters');
    console.log();
    return;
  }

  info('Creating encrypted backup...');

  try {
    const result = await createEncryptedBackup(options.password);
    console.log();
    success('Encrypted backup created');
    console.log(chalk.gray(`  Path: ${result.path}`));
    console.log(chalk.gray(`  Size: ${formatBytes(result.size)}`));
    console.log();
    console.log(chalk.yellow('  IMPORTANT: Remember your password!'));
    console.log(chalk.yellow('  Without it, the backup cannot be decrypted.'));
  } catch (err) {
    error(`Backup failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
  console.log();
}

/**
 * Restore encrypted backup
 */
export async function privacyRestoreCommand(file: string, options: { password?: string }): Promise<void> {
  console.log();

  if (!options.password) {
    error('Password required to decrypt backup');
    console.log();
    console.log(chalk.gray('  Usage: tt privacy restore <file> --password "your-secret-password"'));
    console.log();
    return;
  }

  info('Decrypting backup...');

  try {
    const result = await restoreEncryptedBackup(file, options.password);
    console.log();
    if (result.success) {
      success(result.message);
    } else {
      error(result.message);
    }
  } catch (err) {
    error(`Restore failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
  console.log();
}

/**
 * Check dashboard security
 */
export function privacyDashboardCommand(): void {
  console.log();
  console.log(chalk.bold('Dashboard Security Check'));
  console.log();

  const check = checkDashboardSecurity();

  if (check.localhostOnly) {
    console.log(chalk.green('  Localhost only: Yes'));
    console.log(chalk.gray('    Dashboard is only accessible from your machine.'));
  } else {
    console.log(chalk.red('  Localhost only: No'));
    console.log(chalk.yellow('    Warning: Dashboard may be accessible from network!'));
  }
  console.log();

  if (check.noExternalResources) {
    console.log(chalk.green('  No external resources: Yes'));
    console.log(chalk.gray('    Dashboard loads no scripts, fonts, or styles from external servers.'));
  } else {
    console.log(chalk.red('  No external resources: No'));
  }
  console.log();

  if (check.issues.length === 0) {
    success('Dashboard is secure');
    console.log(chalk.gray('  - Bound to localhost (127.0.0.1)'));
    console.log(chalk.gray('  - No external resources loaded'));
    console.log(chalk.gray('  - No tracking or analytics'));
  } else {
    warn('Issues found:');
    check.issues.forEach(issue => {
      console.log(chalk.yellow(`  - ${issue}`));
    });
  }
  console.log();
}

/**
 * Main privacy status overview
 */
export function privacyStatusCommand(): void {
  console.log();
  console.log(chalk.bold.green('Privacy Status'));
  console.log(chalk.gray('━'.repeat(40)));
  console.log();

  const lockdown = isPrivacyLockdownEnabled();
  const anonymous = isAnonymousModeEnabled();
  const retention = getDataRetentionSettings();

  // Status icons
  const statusLine = (label: string, enabled: boolean, description: string) => {
    const icon = enabled ? chalk.green('ON ') : chalk.gray('OFF');
    console.log(`  ${icon}  ${label}`);
    console.log(chalk.gray(`       ${description}`));
    console.log();
  };

  statusLine(
    'Privacy Lockdown',
    lockdown,
    lockdown ? 'All network features disabled' : 'Webhooks and dashboard available'
  );

  statusLine(
    'Anonymous Mode',
    anonymous,
    anonymous ? 'App/window names not stored' : 'Full activity details tracked'
  );

  statusLine(
    'Data Retention',
    retention.enabled,
    retention.enabled ? `Auto-delete after ${retention.days} days` : 'Data kept indefinitely'
  );

  console.log(chalk.gray('Commands:'));
  console.log(chalk.gray('  tt privacy audit           Full privacy audit'));
  console.log(chalk.gray('  tt privacy export          Export all your data'));
  console.log(chalk.gray('  tt privacy lockdown        Enable/disable lockdown'));
  console.log(chalk.gray('  tt privacy anonymous       Enable/disable anonymous mode'));
  console.log(chalk.gray('  tt privacy retention       Configure data retention'));
  console.log(chalk.gray('  tt privacy backup          Create encrypted backup'));
  console.log(chalk.gray('  tt privacy wipe            Delete all data'));
  console.log();
}
