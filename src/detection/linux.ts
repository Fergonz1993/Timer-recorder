import { execSync } from 'child_process';
import type { WindowInfo } from '../types/index.js';

// Check if running on X11 (not Wayland)
export function isX11(): boolean {
  try {
    const display = process.env.DISPLAY;
    const waylandDisplay = process.env.WAYLAND_DISPLAY;
    return Boolean(display) && !waylandDisplay;
  } catch {
    return false;
  }
}

// Check if xdotool is installed
export function isXdotoolInstalled(): boolean {
  try {
    execSync('which xdotool', { encoding: 'utf-8', stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// Get information about the currently active window using xdotool
export function getActiveWindow(): WindowInfo {
  try {
    // Get active window ID
    const windowId = execSync('xdotool getactivewindow', {
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    // Get window name (title)
    const windowTitle = execSync(`xdotool getwindowname ${windowId}`, {
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    // Get window PID and then app name from /proc
    const windowPid = execSync(`xdotool getwindowpid ${windowId}`, {
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    let appName = 'Unknown';
    try {
      // Get the command name from /proc
      appName = execSync(`cat /proc/${windowPid}/comm`, {
        encoding: 'utf-8',
        timeout: 1000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
    } catch {
      // Try xprop as fallback for WM_CLASS
      try {
        const xpropOutput = execSync(`xprop -id ${windowId} WM_CLASS`, {
          encoding: 'utf-8',
          timeout: 3000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        // Parse WM_CLASS = "instance", "class"
        const match = xpropOutput.match(/WM_CLASS.*=.*"([^"]+)"/);
        if (match) {
          appName = match[1];
        }
      } catch {
        // Ignore, keep Unknown
      }
    }

    return {
      appName,
      appBundleId: '', // Linux doesn't have bundle IDs
      windowTitle,
      timestamp: new Date(),
    };
  } catch {
    // Return unknown if detection fails
    return {
      appName: 'Unknown',
      appBundleId: '',
      windowTitle: '',
      timestamp: new Date(),
    };
  }
}

// Check if we can detect windows (xdotool available and X11 running)
export function checkLinuxPermission(): boolean {
  if (!isX11()) {
    return false;
  }
  if (!isXdotoolInstalled()) {
    return false;
  }
  // Try to get window info
  try {
    const info = getActiveWindow();
    return info.appName !== 'Unknown';
  } catch {
    return false;
  }
}

// Get permission instructions for Linux
export function getLinuxPermissionInstructions(): string {
  if (!isX11()) {
    return `
Wayland detected - window detection requires X11.

Timer Record uses xdotool for window detection, which only works on X11.
If you're using Wayland, consider:
  - Running your desktop in X11 mode
  - Using XWayland for specific applications
  - Waiting for Wayland support in a future version

To check your display server:
  echo $XDG_SESSION_TYPE
`;
  }

  if (!isXdotoolInstalled()) {
    return `
xdotool not found!

To enable window detection on Linux, install xdotool:

  Ubuntu/Debian: sudo apt install xdotool
  Fedora:        sudo dnf install xdotool
  Arch:          sudo pacman -S xdotool

Then run 'tt daemon start' again.
`;
  }

  return `
Window detection permission issue.

Make sure you have:
1. xdotool installed: sudo apt install xdotool
2. X11 display server running (not Wayland)
3. A desktop environment with window management

Run 'tt detect' to test window detection.
`;
}
