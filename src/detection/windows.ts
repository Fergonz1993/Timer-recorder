import { execSync } from 'child_process';
import type { WindowInfo } from '../types/index.js';

// PowerShell script to get the active window information
const GET_ACTIVE_WINDOW_PS = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Win32 {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@

$hwnd = [Win32]::GetForegroundWindow()
$title = New-Object System.Text.StringBuilder 256
[Win32]::GetWindowText($hwnd, $title, 256) | Out-Null

$processId = 0
[Win32]::GetWindowThreadProcessId($hwnd, [ref]$processId) | Out-Null

$process = Get-Process -Id $processId -ErrorAction SilentlyContinue
$appName = if ($process) { $process.ProcessName } else { "Unknown" }

Write-Output "$appName|||$($title.ToString())"
`;

// Check if running on Windows
export function isWindows(): boolean {
  return process.platform === 'win32';
}

// Get information about the currently active window using PowerShell
export function getActiveWindow(): WindowInfo {
  try {
    const result = execSync(
      `powershell -NoProfile -Command "${GET_ACTIVE_WINDOW_PS.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`,
      {
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      }
    ).trim();

    const [appName, windowTitle] = result.split('|||');

    return {
      appName: appName || 'Unknown',
      appBundleId: '', // Windows doesn't have bundle IDs
      windowTitle: windowTitle || '',
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

// Check if window detection is working
export function checkWindowsPermission(): boolean {
  try {
    const info = getActiveWindow();
    return info.appName !== 'Unknown';
  } catch {
    return false;
  }
}

// Get permission instructions for Windows
export function getWindowsPermissionInstructions(): string {
  return `
Window detection requires PowerShell access.

Timer Record uses PowerShell to detect the active window.
This should work out of the box on Windows 10/11.

If you're having issues:
1. Make sure PowerShell is available in your PATH
2. Run as Administrator if needed
3. Check that your antivirus isn't blocking PowerShell

Run 'tt detect' to test window detection.
`;
}
