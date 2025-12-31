import { writeFileSync, unlinkSync, existsSync, chmodSync } from 'fs';
import { execSync } from 'child_process';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const PLIST_NAME = 'com.timer-record.daemon.plist';
const LAUNCH_AGENTS_DIR = join(homedir(), 'Library', 'LaunchAgents');
const PLIST_PATH = join(LAUNCH_AGENTS_DIR, PLIST_NAME);

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
    return '/usr/local/bin/node';
  }
}

// Generate launchd plist content
function generatePlist(): string {
  const nodePath = getNodePath();
  const daemonPath = getDaemonScriptPath();
  const logPath = '/tmp/timer-record.log';
  const errorLogPath = '/tmp/timer-record.error.log';

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.timer-record.daemon</string>

    <key>ProgramArguments</key>
    <array>
        <string>${nodePath}</string>
        <string>${daemonPath}</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>StandardOutPath</key>
    <string>${logPath}</string>

    <key>StandardErrorPath</key>
    <string>${errorLogPath}</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>

    <key>ProcessType</key>
    <string>Background</string>

    <key>Nice</key>
    <integer>10</integer>
</dict>
</plist>`;
}

// Install launchd service
export function installLaunchd(): { success: boolean; message: string } {
  try {
    // Check if already installed
    if (existsSync(PLIST_PATH)) {
      // Unload first
      try {
        execSync(`launchctl unload "${PLIST_PATH}"`, { stdio: 'ignore' });
      } catch {
        // Ignore if not loaded
      }
    }

    // Generate and write plist
    const plistContent = generatePlist();
    writeFileSync(PLIST_PATH, plistContent);
    chmodSync(PLIST_PATH, 0o644);

    // Load the service
    execSync(`launchctl load "${PLIST_PATH}"`);

    return {
      success: true,
      message: `Installed and started. Timer Record will now auto-start on login.\nPlist: ${PLIST_PATH}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to install: ${error}`,
    };
  }
}

// Uninstall launchd service
export function uninstallLaunchd(): { success: boolean; message: string } {
  try {
    if (!existsSync(PLIST_PATH)) {
      return {
        success: false,
        message: 'Service is not installed.',
      };
    }

    // Unload the service
    try {
      execSync(`launchctl unload "${PLIST_PATH}"`);
    } catch {
      // Ignore if not loaded
    }

    // Remove the plist file
    unlinkSync(PLIST_PATH);

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

// Check if launchd service is installed
export function isLaunchdInstalled(): boolean {
  return existsSync(PLIST_PATH);
}

// Check if launchd service is running
export function isLaunchdRunning(): boolean {
  try {
    const output = execSync('launchctl list', { encoding: 'utf-8' });
    return output.includes('com.timer-record.daemon');
  } catch {
    return false;
  }
}

// Get launchd status info
export function getLaunchdStatus(): {
  installed: boolean;
  running: boolean;
  plistPath: string;
} {
  return {
    installed: isLaunchdInstalled(),
    running: isLaunchdRunning(),
    plistPath: PLIST_PATH,
  };
}
