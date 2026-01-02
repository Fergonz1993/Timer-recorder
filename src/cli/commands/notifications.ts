import chalk from 'chalk';
import {
  getNotificationSettings,
  updateNotificationSetting,
  sendNotification,
} from '../../core/notifications.js';
import { success, error, info } from '../utils/format.js';

// Show notification settings
export function notificationsStatus(): void {
  const settings = getNotificationSettings();

  console.log();
  console.log(chalk.bold('Notification Settings'));
  console.log();
  console.log(`  Notifications:    ${settings.enabled ? chalk.green('enabled') : chalk.dim('disabled')}`);
  console.log(`  Sound:            ${settings.sound ? chalk.green('on') : chalk.dim('off')}`);
  console.log(`  Goal reminders:   ${settings.goalReminders ? chalk.green('on') : chalk.dim('off')}`);
  console.log(`  Pomodoro alerts:  ${settings.pomodoroAlerts ? chalk.green('on') : chalk.dim('off')}`);
  console.log(`  Idle reminders:   ${settings.idleReminders ? chalk.green('on') : chalk.dim('off')}`);
  if (settings.idleReminders) {
    console.log(`  Idle threshold:   ${settings.idleMinutes} minutes`);
  }
  console.log();
}

// Enable notifications
export function notificationsEnable(): void {
  updateNotificationSetting('enabled', 'true');
  console.log();
  success('Notifications enabled');
  console.log();
}

// Disable notifications
export function notificationsDisable(): void {
  updateNotificationSetting('enabled', 'false');
  console.log();
  success('Notifications disabled');
  console.log();
}

// Configure notification settings
export function notificationsConfigure(options: {
  sound?: boolean;
  goals?: boolean;
  pomodoro?: boolean;
  idle?: boolean;
  idleMinutes?: string;
}): void {
  let updated = false;
  let hasError = false;

  try {
    if (options.sound !== undefined) {
      updateNotificationSetting('sound', options.sound.toString());
      updated = true;
    }
  } catch (err) {
    error(`Failed to update sound setting: ${err instanceof Error ? err.message : 'Unknown error'}`);
    hasError = true;
  }

  try {
    if (options.goals !== undefined) {
      updateNotificationSetting('goal_reminders', options.goals.toString());
      updated = true;
    }
  } catch (err) {
    error(`Failed to update goal reminders setting: ${err instanceof Error ? err.message : 'Unknown error'}`);
    hasError = true;
  }

  try {
    if (options.pomodoro !== undefined) {
      updateNotificationSetting('pomodoro_alerts', options.pomodoro.toString());
      updated = true;
    }
  } catch (err) {
    error(`Failed to update pomodoro alerts setting: ${err instanceof Error ? err.message : 'Unknown error'}`);
    hasError = true;
  }

  try {
    if (options.idle !== undefined) {
      updateNotificationSetting('idle_reminders', options.idle.toString());
      updated = true;
    }
  } catch (err) {
    error(`Failed to update idle reminders setting: ${err instanceof Error ? err.message : 'Unknown error'}`);
    hasError = true;
  }

  if (options.idleMinutes) {
    const minutes = parseInt(options.idleMinutes, 10);
    if (isNaN(minutes) || minutes < 1 || minutes > 120) {
      error('Idle threshold must be between 1-120 minutes');
      return;
    }
    try {
      updateNotificationSetting('idle_minutes', minutes.toString());
      updated = true;
    } catch (err) {
      error(`Failed to update idle minutes setting: ${err instanceof Error ? err.message : 'Unknown error'}`);
      hasError = true;
    }
  }

  if (hasError) {
    console.log();
    error('Some notification settings failed to update');
    notificationsStatus();
    return;
  }

  if (updated) {
    console.log();
    success('Notification settings updated');
    notificationsStatus();
  } else {
    notificationsStatus();
  }
}

// Test notifications
export function notificationsTest(): void {
  const settings = getNotificationSettings();

  if (!settings.enabled) {
    error('Notifications are disabled');
    console.log(chalk.dim('\nEnable with: tt notify enable'));
    return;
  }

  console.log();
  info('Sending test notification...');
  console.log();

  sendNotification({
    title: '🔔 Test Notification',
    message: 'Timer Record notifications are working!',
    sound: settings.sound,
  });

  success('Test notification sent');
  console.log();
}
