import { platform } from 'os';
import type { WindowInfo } from '../types/index.js';

// Re-export idle detection (platform-independent)
export * from './idle.js';

// Import platform-specific modules
import * as macosModule from './macos.js';
import * as linuxModule from './linux.js';

const currentPlatform = platform();

// Platform-specific window detection
export function getActiveWindow(): WindowInfo {
  if (currentPlatform === 'darwin') {
    return macosModule.getActiveWindow();
  } else if (currentPlatform === 'linux') {
    return linuxModule.getActiveWindow();
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
  }
  return false;
}

export function getPermissionInstructions(): string {
  if (currentPlatform === 'darwin') {
    return macosModule.getPermissionInstructions();
  } else if (currentPlatform === 'linux') {
    return linuxModule.getLinuxPermissionInstructions();
  }
  return `
Window detection is not supported on this platform.

Supported platforms:
  - macOS (uses Accessibility API)
  - Linux with X11 (uses xdotool)

Windows support is not yet available.
`;
}

export function isSupported(): boolean {
  return currentPlatform === 'darwin' || currentPlatform === 'linux';
}

export function getPlatformName(): string {
  if (currentPlatform === 'darwin') return 'macOS';
  if (currentPlatform === 'linux') return 'Linux';
  if (currentPlatform === 'win32') return 'Windows';
  return currentPlatform;
}
