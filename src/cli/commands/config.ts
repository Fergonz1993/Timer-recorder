import Table from 'cli-table3';
import chalk from 'chalk';
import {
  loadConfig,
  resetConfig,
  getConfigPath,
  isValidConfigKey,
  parseConfigValue,
  formatConfigValue,
  setConfigValue,
  CONFIG_KEYS,
  DEFAULT_CONFIG,
} from '../../config/settings.js';
import { success, error, info } from '../utils/format.js';

/**
 * Show all configuration values
 */
export function configListCommand(): void {
  const config = loadConfig();

  console.log(chalk.bold('\nConfiguration'));
  console.log(chalk.gray(`File: ${getConfigPath()}\n`));

  const table = new Table({
    head: [chalk.cyan('Setting'), chalk.cyan('Value'), chalk.cyan('Default')],
    colWidths: [20, 30, 20],
  });

  for (const key of CONFIG_KEYS) {
    const value = config[key];
    const defaultValue = DEFAULT_CONFIG[key];
    const isDefault = JSON.stringify(value) === JSON.stringify(defaultValue);

    table.push([
      key,
      isDefault ? formatConfigValue(key, value) : chalk.yellow(formatConfigValue(key, value)),
      formatConfigValue(key, defaultValue),
    ]);
  }

  console.log(table.toString());
  console.log();
}

/**
 * Get a specific configuration value
 */
export function configGetCommand(key: string): void {
  if (!isValidConfigKey(key)) {
    error(`Unknown configuration key: ${key}`);
    console.log(`\nValid keys: ${CONFIG_KEYS.join(', ')}`);
    process.exit(1);
  }

  const config = loadConfig();
  const value = config[key];

  console.log(formatConfigValue(key, value));
}

/**
 * Set a configuration value
 */
export function configSetCommand(key: string, value: string): void {
  if (!isValidConfigKey(key)) {
    error(`Unknown configuration key: ${key}`);
    console.log(`\nValid keys: ${CONFIG_KEYS.join(', ')}`);
    process.exit(1);
  }

  try {
    const parsedValue = parseConfigValue(key, value);
    setConfigValue(key, parsedValue);
    success(`Set ${key} = ${formatConfigValue(key, parsedValue)}`);

    // Show reminder if daemon is running
    info('Restart the daemon for changes to take effect: tt daemon stop && tt daemon start');
  } catch (err) {
    error(err instanceof Error ? err.message : 'Failed to set configuration value');
    process.exit(1);
  }
}

/**
 * Reset configuration to defaults
 */
export function configResetCommand(): void {
  resetConfig();
  success('Configuration reset to defaults');
  configListCommand();
}

/**
 * Show configuration file path
 */
export function configPathCommand(): void {
  console.log(getConfigPath());
}
