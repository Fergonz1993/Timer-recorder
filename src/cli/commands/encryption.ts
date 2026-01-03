/**
 * Encryption commands for enterprise data security
 */

import chalk from 'chalk';
import * as readline from 'readline';
import { success, error, info } from '../utils/format.js';
import {
  getEncryptionConfig,
  initializeEncryption,
  unlockEncryption,
  lockEncryption,
  isEncryptionUnlocked,
  changeEncryptionPassword,
  disableEncryption,
  encryptExistingData,
  saveEncryptionConfig,
} from '../../security/encryption.js';

// Prompt for password (hidden input)
function promptPassword(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Attempt to hide input on supported terminals
    if (process.stdin.isTTY) {
      process.stdout.write(prompt);

      let password = '';
      const stdin = process.stdin;
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf8');

      const onData = (char: string) => {
        if (char === '\n' || char === '\r' || char === '\u0004') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          rl.close();
          console.log();
          resolve(password);
        } else if (char === '\u0003') {
          // Ctrl+C
          process.exit();
        } else if (char === '\u007F' || char === '\b') {
          // Backspace
          password = password.slice(0, -1);
        } else {
          password += char;
        }
      };

      stdin.on('data', onData);
    } else {
      // Fallback for non-TTY
      rl.question(prompt, (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

// Show encryption status
export function encryptionStatusCommand(): void {
  console.log();
  console.log(chalk.bold('Encryption Status'));
  console.log();

  const config = getEncryptionConfig();

  if (!config.enabled) {
    console.log(`  Status:     ${chalk.dim('Disabled')}`);
    console.log();
    info('Enable encryption with: tt encrypt init');
    console.log();
    return;
  }

  const locked = !isEncryptionUnlocked();

  console.log(`  Status:     ${chalk.green('Enabled')}`);
  console.log(`  State:      ${locked ? chalk.yellow('Locked') : chalk.green('Unlocked')}`);
  console.log();
  console.log(`  Encrypt Notes:      ${config.encryptNotes ? chalk.green('Yes') : chalk.dim('No')}`);
  console.log(`  Encrypt Projects:   ${config.encryptProjects ? chalk.green('Yes') : chalk.dim('No')}`);
  console.log(`  Encrypt Sync Data:  ${config.encryptSync ? chalk.green('Yes') : chalk.dim('No')}`);

  if (config.lastKeyRotation) {
    console.log(`  Last Key Rotation:  ${new Date(config.lastKeyRotation).toLocaleDateString()}`);
  }

  console.log();

  if (locked) {
    info('Unlock with: tt encrypt unlock');
  }
  console.log();
}

// Initialize encryption
export async function encryptionInitCommand(): Promise<void> {
  console.log();

  const config = getEncryptionConfig();
  if (config.enabled) {
    error('Encryption is already initialized.');
    console.log();
    console.log(`  To change password: ${chalk.cyan('tt encrypt change-password')}`);
    console.log(`  To disable: ${chalk.cyan('tt encrypt disable')}`);
    console.log();
    return;
  }

  console.log(chalk.bold('Initialize End-to-End Encryption'));
  console.log();
  console.log(chalk.yellow('⚠️  IMPORTANT:'));
  console.log('  - Choose a strong password you will remember');
  console.log('  - If you forget this password, your encrypted data CANNOT be recovered');
  console.log('  - This password is never stored - only you know it');
  console.log();

  const password = await promptPassword('  Enter encryption password: ');

  if (password.length < 8) {
    error('Password must be at least 8 characters');
    console.log();
    return;
  }

  const confirmPassword = await promptPassword('  Confirm password: ');

  if (password !== confirmPassword) {
    error('Passwords do not match');
    console.log();
    return;
  }

  const result = initializeEncryption(password);

  if (result.success) {
    success('Encryption initialized!');
    console.log();
    console.log('  Your data will now be encrypted.');
    console.log('  You\'ll need to unlock with your password when starting the app.');
    console.log();

    // Encrypt existing data
    info('Encrypting existing data...');
    const encryptResult = encryptExistingData();
    console.log(`  Encrypted ${encryptResult.encrypted} items`);

    if (encryptResult.errors.length > 0) {
      console.log(chalk.yellow(`  ${encryptResult.errors.length} errors occurred`));
    }
  } else {
    error(result.error || 'Failed to initialize encryption');
  }

  console.log();
}

// Unlock encryption
export async function encryptionUnlockCommand(): Promise<void> {
  console.log();

  const config = getEncryptionConfig();
  if (!config.enabled) {
    error('Encryption is not initialized. Run: tt encrypt init');
    console.log();
    return;
  }

  if (isEncryptionUnlocked()) {
    info('Encryption is already unlocked.');
    console.log();
    return;
  }

  const password = await promptPassword('  Enter encryption password: ');
  const result = unlockEncryption(password);

  if (result.success) {
    success('Encryption unlocked!');
    console.log();
    console.log('  You can now access your encrypted data.');
  } else {
    error(result.error || 'Failed to unlock');
  }

  console.log();
}

// Lock encryption
export function encryptionLockCommand(): void {
  console.log();

  if (!isEncryptionUnlocked()) {
    info('Encryption is already locked.');
    console.log();
    return;
  }

  lockEncryption();
  success('Encryption locked!');
  console.log();
  console.log('  Your encrypted data is now protected.');
  console.log();
}

// Change password
export async function encryptionChangePasswordCommand(): Promise<void> {
  console.log();

  const config = getEncryptionConfig();
  if (!config.enabled) {
    error('Encryption is not initialized.');
    console.log();
    return;
  }

  console.log(chalk.bold('Change Encryption Password'));
  console.log();

  const currentPassword = await promptPassword('  Current password: ');
  const newPassword = await promptPassword('  New password: ');

  if (newPassword.length < 8) {
    error('New password must be at least 8 characters');
    console.log();
    return;
  }

  const confirmPassword = await promptPassword('  Confirm new password: ');

  if (newPassword !== confirmPassword) {
    error('Passwords do not match');
    console.log();
    return;
  }

  console.log();
  info('Changing password and re-encrypting data...');

  const result = changeEncryptionPassword(currentPassword, newPassword);

  if (result.success) {
    success('Password changed successfully!');
    console.log();
    console.log('  All data has been re-encrypted with your new password.');
  } else {
    error(result.error || 'Failed to change password');
  }

  console.log();
}

// Disable encryption
export async function encryptionDisableCommand(options: { confirm?: boolean }): Promise<void> {
  console.log();

  const config = getEncryptionConfig();
  if (!config.enabled) {
    info('Encryption is not enabled.');
    console.log();
    return;
  }

  if (!options.confirm) {
    error('This will decrypt all your data and disable encryption.');
    console.log();
    console.log(`  Run with ${chalk.cyan('--confirm')} to proceed.`);
    console.log();
    return;
  }

  console.log(chalk.bold('Disable Encryption'));
  console.log();
  console.log(chalk.yellow('⚠️  WARNING:'));
  console.log('  - All your data will be decrypted');
  console.log('  - Data will be stored in plaintext');
  console.log();

  const password = await promptPassword('  Enter encryption password to confirm: ');

  const result = disableEncryption(password);

  if (result.success) {
    success('Encryption disabled!');
    console.log();
    console.log('  All data has been decrypted.');
  } else {
    error(result.error || 'Failed to disable encryption');
  }

  console.log();
}

// Configure encryption options
export function encryptionConfigCommand(options: {
  notes?: string;
  projects?: string;
  sync?: string;
}): void {
  console.log();

  const config = getEncryptionConfig();
  if (!config.enabled) {
    error('Encryption is not initialized. Run: tt encrypt init');
    console.log();
    return;
  }

  // Parse boolean options
  const parseBoolean = (value: string | undefined): boolean | undefined => {
    if (value === undefined) return undefined;
    return value === 'true' || value === '1' || value === 'yes';
  };

  const updates: Partial<typeof config> = {};

  if (options.notes !== undefined) {
    updates.encryptNotes = parseBoolean(options.notes);
  }
  if (options.projects !== undefined) {
    updates.encryptProjects = parseBoolean(options.projects);
  }
  if (options.sync !== undefined) {
    updates.encryptSync = parseBoolean(options.sync);
  }

  if (Object.keys(updates).length > 0) {
    saveEncryptionConfig(updates);
    success('Encryption configuration updated');
    console.log();
  } else {
    // Show current config
    console.log(chalk.bold('Encryption Configuration'));
    console.log();
    console.log(`  Encrypt Notes:      ${config.encryptNotes ? 'Yes' : 'No'}`);
    console.log(`  Encrypt Projects:   ${config.encryptProjects ? 'Yes' : 'No'}`);
    console.log(`  Encrypt Sync Data:  ${config.encryptSync ? 'Yes' : 'No'}`);
    console.log();
    console.log('Configure with:');
    console.log(`  ${chalk.dim('tt encrypt config --notes true|false')}`);
    console.log(`  ${chalk.dim('tt encrypt config --projects true|false')}`);
    console.log(`  ${chalk.dim('tt encrypt config --sync true|false')}`);
  }

  console.log();
}

// Encrypt existing data
export async function encryptDataCommand(): Promise<void> {
  console.log();

  const config = getEncryptionConfig();
  if (!config.enabled) {
    error('Encryption is not initialized. Run: tt encrypt init');
    console.log();
    return;
  }

  if (!isEncryptionUnlocked()) {
    error('Encryption is locked. Run: tt encrypt unlock');
    console.log();
    return;
  }

  console.log('Encrypting existing data...');
  console.log();

  const result = encryptExistingData();

  success(`Encrypted ${result.encrypted} items`);

  if (result.errors.length > 0) {
    console.log();
    console.log(chalk.yellow('Errors:'));
    for (const err of result.errors.slice(0, 5)) {
      console.log(`  - ${err}`);
    }
    if (result.errors.length > 5) {
      console.log(`  ... and ${result.errors.length - 5} more`);
    }
  }

  console.log();
}
