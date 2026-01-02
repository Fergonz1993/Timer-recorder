import chalk from 'chalk';
import { startTimer, stopTimer, getTimerStatus, getActiveDuration } from '../../core/timer.js';
import { getCategoryByName } from '../../storage/repositories/categories.js';
import { getDatabase } from '../../storage/database.js';
import { success, error, info, formatDurationClock, formatCategory } from '../utils/format.js';

interface FocusSettings {
  defaultDuration: number;  // in minutes
  showTimer: boolean;
  blockNotifications: boolean;
  autoStop: boolean;
}

// Get focus mode settings
function getFocusSettings(): FocusSettings {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT key, value FROM settings
    WHERE key LIKE 'focus_%'
  `).all() as { key: string; value: string }[];

  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }

  return {
    defaultDuration: parseInt(settings.focus_default_duration || '60', 10),
    showTimer: settings.focus_show_timer !== 'false',
    blockNotifications: settings.focus_block_notifications === 'true',
    autoStop: settings.focus_auto_stop === 'true',
  };
}

// Update focus mode setting
function updateFocusSetting(key: string, value: string): void {
  const db = getDatabase();
  const fullKey = key.startsWith('focus_') ? key : `focus_${key}`;
  db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `).run(fullKey, value);
}

// Parse duration string (e.g., "2h", "30m", "2.5h", "90") to minutes
function parseDurationToMinutes(durationStr: string): number | null {
  const trimmed = durationStr.trim();
  
  // Try "Xh" format (hours, supports decimals)
  if (trimmed.toLowerCase().endsWith('h')) {
    const hours = parseFloat(trimmed.slice(0, -1));
    if (isNaN(hours) || hours <= 0) return null;
    return Math.round(hours * 60); // Convert to minutes
  }
  
  // Try "Xm" format (minutes, supports decimals)
  if (trimmed.toLowerCase().endsWith('m')) {
    const minutes = parseFloat(trimmed.slice(0, -1));
    if (isNaN(minutes) || minutes <= 0) return null;
    return Math.round(minutes);
  }
  
  // Try plain number (assumed to be minutes)
  const minutes = parseFloat(trimmed);
  if (isNaN(minutes) || minutes <= 0) return null;
  return Math.round(minutes);
}

// Focus mode state (in-memory for the session)
let focusStartTime: number | null = null;
let focusDurationMinutes: number | null = null;
let focusCategory: string | null = null;

// Start focus mode
export function focusStart(options?: {
  category?: string;
  duration?: string;
  notes?: string;
}): void {
  const active = getTimerStatus();
  if (active) {
    error('Timer already running');
    console.log(chalk.dim('\nStop current timer first with: tt stop'));
    return;
  }

  const settings = getFocusSettings();
  const category = options?.category || 'programming';
  const durationStr = options?.duration || settings.defaultDuration.toString();

  // Parse duration
  const durationMinutes = parseDurationToMinutes(durationStr);
  if (durationMinutes === null || durationMinutes < 1 || durationMinutes > 480) {
    error('Duration must be between 1-480 minutes');
    console.log(chalk.dim('\nValid formats: "2h", "30m", "2.5h", "90"'));
    return;
  }

  // Check category exists
  const cat = getCategoryByName(category);
  if (!cat) {
    error(`Category "${category}" not found`);
    console.log(chalk.dim('\nAvailable categories: tt categories list'));
    return;
  }

  // Start the timer
  startTimer({ category, notes: options?.notes });
  focusStartTime = Date.now();
  focusDurationMinutes = durationMinutes;
  focusCategory = category;

  console.log();
  console.log(chalk.bold.magenta('🎯 Focus Mode Started'));
  console.log();
  console.log(`  Category: ${formatCategory(category, cat.color)}`);
  console.log(`  Duration: ${durationMinutes} minutes`);
  console.log(`  Goal:     ${new Date(Date.now() + durationMinutes * 60 * 1000).toLocaleTimeString()}`);
  console.log();
  info('Stay focused! Use `tt focus` to check progress');
  console.log();
}

// Show focus mode status
export function focusStatus(): void {
  const active = getTimerStatus();

  console.log();

  if (!active) {
    console.log(chalk.dim('Not in focus mode'));
    console.log();
    info('Start with: tt focus start <category>');
    console.log();
    return;
  }

  const duration = getActiveDuration();
  const categoryName = active.category_name || 'uncategorized';

  console.log(chalk.bold.magenta('🎯 Focus Mode Active'));
  console.log();
  console.log(`  Category:  ${formatCategory(categoryName, null)}`);
  console.log(`  Duration:  ${chalk.bold(formatDurationClock(duration))}`);
  console.log(`  Started:   ${new Date(active.start_time).toLocaleTimeString()}`);

  // Show progress bar if we have a target duration
  if (focusDurationMinutes) {
    const targetSeconds = focusDurationMinutes * 60;
    const progress = Math.min(1, duration / targetSeconds);
    const barWidth = 25;
    const filled = Math.floor(progress * barWidth);
    const bar = chalk.magenta('█'.repeat(filled)) + chalk.dim('░'.repeat(barWidth - filled));

    console.log();
    console.log(`  Progress:  [${bar}] ${Math.floor(progress * 100)}%`);

    const remaining = Math.max(0, targetSeconds - duration);
    if (remaining > 0) {
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      console.log(`  Remaining: ${mins}:${secs.toString().padStart(2, '0')}`);
    } else {
      console.log(chalk.green('  ✓ Goal reached!'));
    }
  }

  console.log();
  info('End focus session with: tt stop');
  console.log();
}

// End focus mode
export function focusEnd(): void {
  const active = getTimerStatus();

  if (!active) {
    error('Not in focus mode');
    return;
  }

  const duration = getActiveDuration();
  const categoryName = active.category_name || 'uncategorized';

  stopTimer();

  // Reset focus state
  focusStartTime = null;
  focusDurationMinutes = null;
  focusCategory = null;

  const hours = Math.floor(duration / 3600);
  const mins = Math.floor((duration % 3600) / 60);
  const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  console.log();
  console.log(chalk.bold.green('✓ Focus Session Complete'));
  console.log();
  console.log(`  Category: ${categoryName}`);
  console.log(`  Duration: ${durationStr}`);
  console.log();

  // Show motivational message
  if (duration >= 3600) {
    info('Excellent focus session! Take a well-deserved break.');
  } else if (duration >= 1800) {
    info('Great work! Consider taking a short break.');
  } else {
    info('Good start! Try for a longer session next time.');
  }
  console.log();
}

// Configure focus mode settings
export function focusConfig(options: {
  duration?: string;
  showTimer?: boolean;
  autoStop?: boolean;
}): void {
  const settings = getFocusSettings();

  const hasOptions = options.duration || options.showTimer !== undefined || options.autoStop !== undefined;

  if (!hasOptions) {
    // Show current settings
    console.log();
    console.log(chalk.bold('Focus Mode Settings'));
    console.log();
    console.log(`  Default duration: ${settings.defaultDuration} minutes`);
    console.log(`  Show timer:       ${settings.showTimer ? 'yes' : 'no'}`);
    console.log(`  Auto-stop:        ${settings.autoStop ? 'yes' : 'no'}`);
    console.log();
    return;
  }

  if (options.duration) {
    const mins = parseDurationToMinutes(options.duration);
    if (mins === null || mins < 1 || mins > 480) {
      error('Duration must be between 1-480 minutes');
      console.log(chalk.dim('\nValid formats: "2h", "30m", "2.5h", "90"'));
      return;
    }
    updateFocusSetting('default_duration', mins.toString());
  }

  if (options.showTimer !== undefined) {
    updateFocusSetting('show_timer', options.showTimer.toString());
  }

  if (options.autoStop !== undefined) {
    updateFocusSetting('auto_stop', options.autoStop.toString());
  }

  console.log();
  success('Focus settings updated');
  focusConfig({});
}
