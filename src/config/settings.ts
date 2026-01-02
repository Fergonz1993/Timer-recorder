import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getConfigDir } from './paths.js';
import type { Config } from '../types/index.js';

const CONFIG_FILE = 'config.json';

// Default configuration values
export const DEFAULT_CONFIG: Config = {
  pollInterval: 5,           // 5 seconds between detection checks
  idleThreshold: 300,        // 5 minutes before considered idle
  minEntryDuration: 30,      // 30 seconds minimum entry duration
  defaultCategory: null,     // null = uncategorized
  'pomodoro.work': 25,       // 25 minutes work duration
  'pomodoro.break': 5,       // 5 minutes break duration
  'pomodoro.longBreak': 15,  // 15 minutes long break
  'pomodoro.sessionsBeforeLongBreak': 4, // 4 sessions before long break
};

// Valid config keys for validation
export const CONFIG_KEYS = [
  'pollInterval',
  'idleThreshold',
  'minEntryDuration',
  'defaultCategory',
  'pomodoro.work',
  'pomodoro.break',
  'pomodoro.longBreak',
  'pomodoro.sessionsBeforeLongBreak',
] as const;
export type ConfigKey = (typeof CONFIG_KEYS)[number];

/**
 * Get the full path to the config file
 */
export function getConfigPath(): string {
  return join(getConfigDir(), CONFIG_FILE);
}

/**
 * Load configuration from file, merging with defaults
 */
export function loadConfig(): Config {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    const userConfig = JSON.parse(content) as Partial<Config>;
    return { ...DEFAULT_CONFIG, ...userConfig };
  } catch {
    // If config is corrupted, return defaults
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Save configuration to file
 */
export function saveConfig(config: Config): void {
  const configPath = getConfigPath();
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

/**
 * Get a specific configuration value
 */
export function getConfigValue<K extends ConfigKey>(key: K): Config[K] {
  const config = loadConfig();
  return config[key];
}

/**
 * Set multiple configuration values in a single batch update
 */
export function setConfigValues(updates: Partial<Config> | Record<string, unknown>): Config {
  const config = loadConfig();
  const updatedConfig = { ...config, ...updates } as Config;
  saveConfig(updatedConfig);
  return updatedConfig;
}

/**
 * Set a specific configuration value
 */
export function setConfigValue<K extends ConfigKey>(key: K, value: Config[K]): Config;
export function setConfigValue(key: string, value: unknown): Config;
export function setConfigValue(key: string, value: unknown): Config {
  return setConfigValues({ [key]: value });
}

/**
 * Reset configuration to defaults
 */
export function resetConfig(): Config {
  saveConfig(DEFAULT_CONFIG);
  return DEFAULT_CONFIG;
}

/**
 * Check if a key is a valid config key
 */
export function isValidConfigKey(key: string): key is ConfigKey {
  return CONFIG_KEYS.includes(key as ConfigKey);
}

/**
 * Parse and validate a config value from string input
 */
export function parseConfigValue(key: ConfigKey, value: string): Config[ConfigKey] {
  switch (key) {
    case 'pollInterval':
    case 'idleThreshold':
    case 'minEntryDuration': {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 1) {
        throw new Error(`${key} must be a positive integer`);
      }
      // Reasonable limits
      if (key === 'pollInterval' && (num < 1 || num > 60)) {
        throw new Error('pollInterval must be between 1 and 60 seconds');
      }
      if (key === 'idleThreshold' && (num < 30 || num > 3600)) {
        throw new Error('idleThreshold must be between 30 and 3600 seconds');
      }
      if (key === 'minEntryDuration' && (num < 5 || num > 300)) {
        throw new Error('minEntryDuration must be between 5 and 300 seconds');
      }
      return num;
    }
    case 'pomodoro.work':
    case 'pomodoro.break':
    case 'pomodoro.longBreak':
    case 'pomodoro.sessionsBeforeLongBreak': {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 1) {
        throw new Error(`${key} must be a positive integer`);
      }
      // Reasonable limits for pomodoro
      if (key === 'pomodoro.work' && (num < 1 || num > 120)) {
        throw new Error('pomodoro.work must be between 1 and 120 minutes');
      }
      if (key === 'pomodoro.break' && (num < 1 || num > 60)) {
        throw new Error('pomodoro.break must be between 1 and 60 minutes');
      }
      if (key === 'pomodoro.longBreak' && (num < 1 || num > 120)) {
        throw new Error('pomodoro.longBreak must be between 1 and 120 minutes');
      }
      if (key === 'pomodoro.sessionsBeforeLongBreak' && (num < 1 || num > 10)) {
        throw new Error('pomodoro.sessionsBeforeLongBreak must be between 1 and 10');
      }
      return num;
    }
    case 'defaultCategory':
      // Empty string or "null" means no default category
      if (value === '' || value.toLowerCase() === 'null') {
        return null;
      }
      return value;
    default:
      throw new Error(`Unknown config key: ${key}`);
  }
}

/**
 * Format a config value for display
 */
export function formatConfigValue(key: ConfigKey, value: Config[ConfigKey]): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'number') {
    // Add unit hints for time values
    switch (key) {
      case 'pollInterval':
        return `${value} seconds`;
      case 'idleThreshold':
        return `${value} seconds (${Math.floor(value / 60)} min)`;
      case 'minEntryDuration':
        return `${value} seconds`;
      case 'pomodoro.work':
      case 'pomodoro.break':
      case 'pomodoro.longBreak':
        return `${value} minutes`;
      case 'pomodoro.sessionsBeforeLongBreak':
        return `${value} sessions`;
      default:
        return String(value);
    }
  }
  return String(value);
}
