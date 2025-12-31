import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// Get data directory (XDG compliant)
export function getDataDir(): string {
  const xdgData = process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share');
  const dataDir = join(xdgData, 'timer-record');

  // Ensure directory exists
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  return dataDir;
}

// Get config directory
export function getConfigDir(): string {
  const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  const configDir = join(xdgConfig, 'timer-record');

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  return configDir;
}

// Get database path
export function getDatabasePath(): string {
  return join(getDataDir(), 'timer-record.db');
}

// Get socket path for daemon IPC
export function getSocketPath(): string {
  return '/tmp/timer-record.sock';
}
