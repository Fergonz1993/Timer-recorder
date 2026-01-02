import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const SERVICE_NAME = 'TimerRecord';
const TASK_NAME = 'TimerRecordDaemon';
const APP_DATA_DIR = join(homedir(), 'AppData', 'Local', 'TimerRecord');
const BATCH_FILE = join(APP_DATA_DIR, 'timer-record-daemon.bat');

// Get the path to the daemon script
function getDaemonScriptPath(): string {
  // Try to find the installed location
  try {
    const npmRoot = execSync('npm root -g', { encoding: 'utf-8', windowsHide: true }).trim();
    const globalPath = join(npmRoot, 'timer-record', 'dist', 'daemon', 'index.js');
    if (existsSync(globalPath)) {
      return globalPath;
    }
  } catch {
    // Fall back to local path
  }

  // Use local path relative to this file
  const currentFile = fileURLToPath(import.meta.url);
  return join(dirname(dirname(currentFile)), 'daemon', 'index.js');
}

// Get Node.js path
function getNodePath(): string {
  try {
    return execSync('where node', { encoding: 'utf-8', windowsHide: true }).trim().split('\n')[0];
  } catch {
    return 'node';
  }
}

// Generate batch file for the daemon
function generateBatchFile(): string {
  const nodePath = getNodePath();
  const daemonPath = getDaemonScriptPath();

  return `@echo off
"${nodePath}" "${daemonPath}"
`;
}

// Install Windows scheduled task (auto-start on login)
export function installWindowsService(): { success: boolean; message: string } {
  try {
    // Create app data directory if it doesn't exist
    if (!existsSync(APP_DATA_DIR)) {
      mkdirSync(APP_DATA_DIR, { recursive: true });
    }

    // Create batch file
    const batchContent = generateBatchFile();
    writeFileSync(BATCH_FILE, batchContent);

    // Remove existing task if present
    try {
      execSync(`schtasks /delete /tn "${TASK_NAME}" /f`, {
        encoding: 'utf-8',
        windowsHide: true,
        stdio: 'ignore',
      });
    } catch {
      // Ignore if task doesn't exist
    }

    // Create scheduled task to run at logon
    execSync(
      `schtasks /create /tn "${TASK_NAME}" /tr "${BATCH_FILE}" /sc onlogon /rl limited`,
      {
        encoding: 'utf-8',
        windowsHide: true,
      }
    );

    // Start the task now
    try {
      execSync(`schtasks /run /tn "${TASK_NAME}"`, {
        encoding: 'utf-8',
        windowsHide: true,
      });
    } catch {
      // Task might not start immediately, that's ok
    }

    return {
      success: true,
      message: `Installed and started. Timer Record will now auto-start on login.\nTask: ${TASK_NAME}\nBatch: ${BATCH_FILE}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to install: ${error}`,
    };
  }
}

// Uninstall Windows scheduled task
export function uninstallWindowsService(): { success: boolean; message: string } {
  try {
    // Check if task exists
    try {
      execSync(`schtasks /query /tn "${TASK_NAME}"`, {
        encoding: 'utf-8',
        windowsHide: true,
        stdio: 'ignore',
      });
    } catch {
      return {
        success: false,
        message: 'Service is not installed.',
      };
    }

    // Stop the task if running
    try {
      execSync(`schtasks /end /tn "${TASK_NAME}"`, {
        encoding: 'utf-8',
        windowsHide: true,
        stdio: 'ignore',
      });
    } catch {
      // Ignore if not running
    }

    // Delete the task
    execSync(`schtasks /delete /tn "${TASK_NAME}" /f`, {
      encoding: 'utf-8',
      windowsHide: true,
    });

    // Remove batch file
    if (existsSync(BATCH_FILE)) {
      unlinkSync(BATCH_FILE);
    }

    return {
      success: true,
      message: 'Service uninstalled. Timer Record will no longer auto-start.',
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to uninstall: ${error}`,
    };
  }
}

// Check if Windows scheduled task is installed
export function isWindowsServiceInstalled(): boolean {
  try {
    execSync(`schtasks /query /tn "${TASK_NAME}"`, {
      encoding: 'utf-8',
      windowsHide: true,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

// Check if Windows scheduled task is running
export function isWindowsServiceRunning(): boolean {
  try {
    const output = execSync(`schtasks /query /tn "${TASK_NAME}" /v /fo csv`, {
      encoding: 'utf-8',
      windowsHide: true,
    });
    return output.includes('Running');
  } catch {
    return false;
  }
}

// Get Windows service status info
export function getWindowsServiceStatus(): {
  installed: boolean;
  running: boolean;
  servicePath: string;
} {
  return {
    installed: isWindowsServiceInstalled(),
    running: isWindowsServiceRunning(),
    servicePath: BATCH_FILE,
  };
}
