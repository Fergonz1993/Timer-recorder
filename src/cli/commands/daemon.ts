import { spawn, execSync } from 'child_process';
import { existsSync, readFileSync, unlinkSync, createWriteStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { success, error, warn, info } from '../utils/format.js';
import {
  checkAccessibilityPermission,
  getPermissionInstructions,
} from '../../detection/macos.js';
import {
  installLaunchd,
  uninstallLaunchd,
  getLaunchdStatus,
} from '../../daemon/launchd.js';

const PID_FILE = '/tmp/timer-record.pid';
const LOG_FILE = '/tmp/timer-record.log';

// Get the daemon script path
function getDaemonPath(): string {
  // Find the dist directory relative to this file
  const currentFile = fileURLToPath(import.meta.url);
  const distDir = dirname(dirname(dirname(currentFile)));
  return join(distDir, 'daemon', 'index.js');
}

// Check if daemon is running
function isDaemonRunning(): { running: boolean; pid: number | null } {
  if (!existsSync(PID_FILE)) {
    return { running: false, pid: null };
  }

  try {
    const pid = parseInt(readFileSync(PID_FILE, 'utf-8').trim(), 10);

    // Check if process is alive
    process.kill(pid, 0);
    return { running: true, pid };
  } catch {
    // Process not running, clean up stale PID file
    try {
      unlinkSync(PID_FILE);
    } catch {
      // Ignore
    }
    return { running: false, pid: null };
  }
}

// Start the daemon
export function daemonStart(): void {
  const { running, pid } = isDaemonRunning();

  if (running) {
    warn(`Daemon already running (PID: ${pid})`);
    return;
  }

  // Check accessibility permission first
  if (!checkAccessibilityPermission()) {
    console.log(chalk.yellow(getPermissionInstructions()));
    return;
  }

  const daemonPath = getDaemonPath();

  if (!existsSync(daemonPath)) {
    error(`Daemon script not found: ${daemonPath}`);
    error('Try running: npm run build');
    process.exit(1);
  }

  // Spawn daemon as detached process
  const child = spawn('node', [daemonPath], {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  // Redirect output to log file
  const logStream = createWriteStream(LOG_FILE, { flags: 'a' });
  child.stdout?.pipe(logStream);
  child.stderr?.pipe(logStream);

  child.unref();

  // Wait a moment to verify it started
  setTimeout(() => {
    const status = isDaemonRunning();
    if (status.running) {
      success(`Daemon started (PID: ${status.pid})`);
      info(`Log file: ${LOG_FILE}`);
      console.log();
      console.log(chalk.dim('Auto-tracking your apps in the background...'));
      console.log(chalk.dim('Use `tt status` to see current tracking'));
      console.log(chalk.dim('Use `tt daemon stop` to stop'));
    } else {
      error('Failed to start daemon');
      console.log(chalk.dim(`Check logs: cat ${LOG_FILE}`));
    }
  }, 500);
}

// Stop the daemon
export function daemonStop(): void {
  const { running, pid } = isDaemonRunning();

  if (!running) {
    warn('Daemon is not running');
    return;
  }

  try {
    process.kill(pid!, 'SIGTERM');
    success(`Daemon stopped (PID: ${pid})`);

    // Clean up PID file
    try {
      unlinkSync(PID_FILE);
    } catch {
      // Ignore
    }
  } catch (err) {
    error(`Failed to stop daemon: ${err}`);
    process.exit(1);
  }
}

// Show daemon status
export function daemonStatus(): void {
  const { running, pid } = isDaemonRunning();

  console.log();
  if (running) {
    console.log(chalk.green('● Daemon running'));
    console.log(`  PID: ${pid}`);
    console.log(`  Log: ${LOG_FILE}`);
  } else {
    console.log(chalk.dim('○ Daemon not running'));
    console.log();
    info('Use `tt daemon start` to begin auto-tracking');
  }
  console.log();
}

// Show recent logs
export function daemonLogs(lines = 20): void {
  if (!existsSync(LOG_FILE)) {
    warn('No log file found');
    return;
  }

  try {
    const output = execSync(`tail -n ${lines} "${LOG_FILE}"`, {
      encoding: 'utf-8',
    });
    console.log(chalk.bold('\nRecent daemon logs:'));
    console.log(chalk.dim('─'.repeat(40)));
    console.log(output);
  } catch {
    error('Failed to read logs');
  }
}

// Install as system service (auto-start on login)
export function daemonInstall(): void {
  // Check accessibility permission first
  if (!checkAccessibilityPermission()) {
    console.log(chalk.yellow(getPermissionInstructions()));
    warn('Please grant Accessibility permission before installing.');
    return;
  }

  console.log();
  info('Installing Timer Record as a system service...');
  console.log();

  const result = installLaunchd();

  if (result.success) {
    success('Service installed!');
    console.log();
    console.log(chalk.dim(result.message));
    console.log();
    console.log(chalk.green('✓'), 'Timer Record will now auto-start when you log in.');
    console.log(chalk.dim('  Use `tt daemon uninstall` to remove.'));
  } else {
    error(result.message);
  }
  console.log();
}

// Uninstall system service
export function daemonUninstall(): void {
  console.log();
  info('Uninstalling Timer Record service...');
  console.log();

  const result = uninstallLaunchd();

  if (result.success) {
    success(result.message);
  } else {
    error(result.message);
  }
  console.log();
}

// Enhanced status with launchd info
export function daemonStatusFull(): void {
  const { running, pid } = isDaemonRunning();
  const launchd = getLaunchdStatus();

  console.log();
  console.log(chalk.bold('Daemon Status'));
  console.log(chalk.dim('─'.repeat(30)));
  console.log();

  // Process status
  if (running) {
    console.log(chalk.green('● Process:    Running'));
    console.log(`  PID:        ${pid}`);
  } else {
    console.log(chalk.dim('○ Process:    Not running'));
  }

  console.log();

  // Launchd status
  if (launchd.installed) {
    console.log(chalk.green('● Auto-start: Enabled'));
    if (launchd.running) {
      console.log(chalk.dim('  (managed by launchd)'));
    }
  } else {
    console.log(chalk.dim('○ Auto-start: Disabled'));
    console.log(chalk.dim('  Use `tt daemon install` to enable'));
  }

  console.log();
  console.log(chalk.dim(`Log file: ${LOG_FILE}`));
  console.log();
}
