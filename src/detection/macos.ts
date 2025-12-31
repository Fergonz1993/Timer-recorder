import { execSync } from 'child_process';
import type { WindowInfo } from '../types/index.js';

// AppleScript to get frontmost application info
const GET_ACTIVE_WINDOW_SCRIPT = `
tell application "System Events"
  set frontApp to first application process whose frontmost is true
  set frontAppName to name of frontApp
  set frontAppId to bundle identifier of frontApp
  set windowTitle to ""
  try
    tell process frontAppName
      tell (1st window whose value of attribute "AXMain" is true)
        set windowTitle to value of attribute "AXTitle"
      end tell
    end tell
  on error
    try
      tell process frontAppName
        set windowTitle to name of front window
      end tell
    end try
  end try
  return frontAppName & "|||" & frontAppId & "|||" & windowTitle
end tell
`;

// Get information about the currently active window
export function getActiveWindow(): WindowInfo {
  try {
    const result = execSync(`osascript -e '${GET_ACTIVE_WINDOW_SCRIPT}'`, {
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    const [appName, appBundleId, windowTitle] = result.split('|||');

    return {
      appName: appName || 'Unknown',
      appBundleId: appBundleId || '',
      windowTitle: windowTitle || '',
      timestamp: new Date(),
    };
  } catch (error) {
    // Return unknown if detection fails
    return {
      appName: 'Unknown',
      appBundleId: '',
      windowTitle: '',
      timestamp: new Date(),
    };
  }
}

// Check if we have accessibility permissions
export function checkAccessibilityPermission(): boolean {
  try {
    // Try to get window info - will fail without permissions
    const info = getActiveWindow();
    // If we got a real app name, we have permissions
    return info.appName !== 'Unknown';
  } catch {
    return false;
  }
}

// Get permission instructions
export function getPermissionInstructions(): string {
  return `
Accessibility permission required for window detection!

To enable automatic tracking:
1. Open System Settings > Privacy & Security > Accessibility
2. Click the lock to make changes
3. Add your Terminal app (Terminal, iTerm2, etc.) to the list
4. Restart your terminal and try again

Run 'tt daemon start' again after granting permission.
`;
}
