import notifier from 'node-notifier';
import { getDatabase } from '../storage/database.js';

export interface NotificationSettings {
  enabled: boolean;
  sound: boolean;
  goalReminders: boolean;
  pomodoroAlerts: boolean;
  idleReminders: boolean;
  idleMinutes: number;
}

// Get notification settings
export function getNotificationSettings(): NotificationSettings {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT key, value FROM settings
    WHERE key LIKE 'notification_%'
  `).all() as { key: string; value: string }[];

  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }

  return {
    enabled: settings.notification_enabled !== 'false',
    sound: settings.notification_sound !== 'false',
    goalReminders: settings.notification_goal_reminders !== 'false',
    pomodoroAlerts: settings.notification_pomodoro_alerts !== 'false',
    idleReminders: settings.notification_idle_reminders === 'true',
    idleMinutes: parseInt(settings.notification_idle_minutes || '15', 10),
  };
}

// Update notification setting
export function updateNotificationSetting(key: string, value: string): void {
  const db = getDatabase();
  const fullKey = key.startsWith('notification_') ? key : `notification_${key}`;
  db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `).run(fullKey, value);
}

// Send a desktop notification
export function sendNotification(options: {
  title: string;
  message: string;
  sound?: boolean;
  icon?: string;
}): void {
  const settings = getNotificationSettings();

  if (!settings.enabled) {
    return;
  }

  notifier.notify({
    title: options.title,
    message: options.message,
    sound: options.sound ?? settings.sound,
    icon: options.icon,
    timeout: 10,
  });
}

// Pomodoro notifications
export function notifyPomodoroWorkComplete(): void {
  const settings = getNotificationSettings();
  if (!settings.pomodoroAlerts) return;

  sendNotification({
    title: '🍅 Pomodoro Complete!',
    message: 'Great work! Time for a break.',
    sound: true,
  });
}

export function notifyPomodoroBreakComplete(): void {
  const settings = getNotificationSettings();
  if (!settings.pomodoroAlerts) return;

  sendNotification({
    title: '☕ Break Over!',
    message: 'Ready to get back to work?',
    sound: true,
  });
}

export function notifyPomodoroLongBreakComplete(): void {
  const settings = getNotificationSettings();
  if (!settings.pomodoroAlerts) return;

  sendNotification({
    title: '🌴 Long Break Over!',
    message: 'Feeling refreshed? Start a new pomodoro!',
    sound: true,
  });
}

// Goal notifications
export function notifyGoalReached(categoryName: string, targetHours: number): void {
  const settings = getNotificationSettings();
  if (!settings.goalReminders) return;

  sendNotification({
    title: '🎯 Goal Reached!',
    message: `You've reached ${targetHours}h on ${categoryName}!`,
    sound: true,
  });
}

export function notifyGoalProgress(categoryName: string, percentComplete: number): void {
  const settings = getNotificationSettings();
  if (!settings.goalReminders) return;

  sendNotification({
    title: '📈 Goal Progress',
    message: `${categoryName}: ${percentComplete}% complete`,
    sound: false,
  });
}

// Idle notifications
export function notifyIdle(idleMinutes: number): void {
  const settings = getNotificationSettings();
  if (!settings.idleReminders) return;

  sendNotification({
    title: '⏰ Still tracking?',
    message: `Timer has been running for ${idleMinutes} minutes without activity.`,
    sound: true,
  });
}

// Timer notifications
export function notifyTimerStarted(category: string): void {
  sendNotification({
    title: '▶️ Timer Started',
    message: `Tracking time for ${category}`,
    sound: false,
  });
}

export function notifyTimerStopped(category: string, duration: string): void {
  sendNotification({
    title: '⏹️ Timer Stopped',
    message: `${category}: ${duration}`,
    sound: false,
  });
}
