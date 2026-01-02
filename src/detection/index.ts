import { platform } from 'os';
import type { WindowInfo } from '../types/index.js';

// Re-export idle detection (platform-independent)
export * from './idle.js';

// Import platform-specific modules
import * as macosModule from './macos.js';
import * as linuxModule from './linux.js';
import * as windowsModule from './windows.js';

const currentPlatform = platform();

// Platform-specific window detection
export function getActiveWindow(): WindowInfo {
  if (currentPlatform === 'darwin') {
    return macosModule.getActiveWindow();
  } else if (currentPlatform === 'linux') {
    return linuxModule.getActiveWindow();
  } else if (currentPlatform === 'win32') {
    return windowsModule.getActiveWindow();
  }

  // Unsupported platform
  return {
    appName: 'Unknown',
    appBundleId: '',
    windowTitle: '',
    timestamp: new Date(),
  };
}

export function checkAccessibilityPermission(): boolean {
  if (currentPlatform === 'darwin') {
    return macosModule.checkAccessibilityPermission();
  } else if (currentPlatform === 'linux') {
    return linuxModule.checkLinuxPermission();
  } else if (currentPlatform === 'win32') {
    return windowsModule.checkWindowsPermission();
  }
  return false;
}

export function getPermissionInstructions(): string {
  if (currentPlatform === 'darwin') {
    return macosModule.getPermissionInstructions();
  } else if (currentPlatform === 'linux') {
    return linuxModule.getLinuxPermissionInstructions();
  } else if (currentPlatform === 'win32') {
    return windowsModule.getWindowsPermissionInstructions();
  }
  return `
Window detection is not supported on this platform.

Supported platforms:
  - macOS (uses Accessibility API)
  - Linux with X11 (uses xdotool)
  - Windows (uses PowerShell)
`;
}

export function isSupported(): boolean {
  return currentPlatform === 'darwin' || currentPlatform === 'linux' || currentPlatform === 'win32';
}

export function getPlatformName(): string {
  if (currentPlatform === 'darwin') return 'macOS';
  if (currentPlatform === 'linux') return 'Linux';
  if (currentPlatform === 'win32') return 'Windows';
  return currentPlatform;
}
