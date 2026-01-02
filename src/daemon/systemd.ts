import { writeFileSync, unlinkSync, existsSync, mkdirSync, chmodSync } from 'fs';
import { execSync } from 'child_process';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const SERVICE_NAME = 'timer-record.service';
const SYSTEMD_USER_DIR = join(homedir(), '.config', 'systemd', 'user');
const SERVICE_PATH = join(SYSTEMD_USER_DIR, SERVICE_NAME);

// Get the path to the daemon script
function getDaemonScriptPath(): string {
  // Try to find the installed location
  try {
    const npmRoot = execSync('npm root -g', { encoding: 'utf-8' }).trim();
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
    return execSync('which node', { encoding: 'utf-8' }).trim();
  } catch {
    return '/usr/bin/node';
  }
}

// Generate systemd service unit content
function generateServiceUnit(): string {
  const nodePath = getNodePath();
  const daemonPath = getDaemonScriptPath();
  const display = process.env.DISPLAY || ':0';

  return `[Unit]
Description=Timer Record - Work Time Tracker
Documentation=https://github.com/timer-record/timer-record
After=graphical-session.target

[Service]
Type=simple
ExecStart=${nodePath} ${daemonPath}
Restart=on-failure
RestartSec=10
Environment=DISPLAY=${display}
Environment=NODE_ENV=production

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=timer-record

[Install]
WantedBy=default.target
`;
}

// Install systemd user service
export function installSystemd(): { success: boolean; message: string } {
  try {
    // Create systemd user directory if it doesn't exist
    if (!existsSync(SYSTEMD_USER_DIR)) {
      mkdirSync(SYSTEMD_USER_DIR, { recursive: true });
    }

    // Stop existing service if running
    try {
      execSync('systemctl --user stop timer-record.service', { stdio: 'ignore' });
    } catch {
      // Ignore if not running
    }

    // Generate and write service file
    const serviceContent = generateServiceUnit();
    writeFileSync(SERVICE_PATH, serviceContent);
    chmodSync(SERVICE_PATH, 0o644);

    // Reload systemd daemon
    execSync('systemctl --user daemon-reload');

    // Enable the service (auto-start on login)
    execSync('systemctl --user enable timer-record.service');

    // Start the service
    execSync('systemctl --user start timer-record.service');

    return {
      success: true,
      message: `Installed and started. Timer Record will now auto-start on login.\nService: ${SERVICE_PATH}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to install: ${error}`,
    };
  }
}

// Uninstall systemd user service
export function uninstallSystemd(): { success: boolean; message: string } {
  try {
    if (!existsSync(SERVICE_PATH)) {
      return {
        success: false,
        message: 'Service is not installed.',
      };
    }

    // Stop the service
    try {
      execSync('systemctl --user stop timer-record.service');
    } catch {
      // Ignore if not running
    }

    // Disable the service
    try {
      execSync('systemctl --user disable timer-record.service');
    } catch {
      // Ignore if not enabled
    }

    // Remove the service file
    unlinkSync(SERVICE_PATH);

    // Reload systemd daemon
    execSync('systemctl --user daemon-reload');

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

// Check if systemd user service is installed
export function isSystemdInstalled(): boolean {
  return existsSync(SERVICE_PATH);
}

// Check if systemd user service is running
export function isSystemdRunning(): boolean {
  try {
    const output = execSync('systemctl --user is-active timer-record.service', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return output === 'active';
  } catch {
    return false;
  }
}

// Get systemd status info
export function getSystemdStatus(): {
  installed: boolean;
  running: boolean;
  servicePath: string;
} {
  return {
    installed: isSystemdInstalled(),
    running: isSystemdRunning(),
    servicePath: SERVICE_PATH,
  };
}
