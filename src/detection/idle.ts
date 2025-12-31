import { execSync } from 'child_process';

// Get system idle time in seconds
export function getIdleTime(): number {
  try {
    // Use ioreg to get HID idle time (in nanoseconds)
    const result = execSync(
      `ioreg -c IOHIDSystem | awk '/HIDIdleTime/ {print $NF; exit}'`,
      {
        encoding: 'utf-8',
        timeout: 2000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    ).trim();

    // Convert nanoseconds to seconds
    const nanoseconds = parseInt(result, 10);
    if (isNaN(nanoseconds)) return 0;

    return Math.floor(nanoseconds / 1000000000);
  } catch {
    return 0;
  }
}

// Check if system is idle (default: 5 minutes)
export function isIdle(thresholdSeconds = 300): boolean {
  return getIdleTime() > thresholdSeconds;
}
