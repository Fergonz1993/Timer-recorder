import chalk from 'chalk';
import {
  getPomodoroSettings,
  updatePomodoroSetting,
  startPomodoroSession,
  getActivePomodoroSession,
  pausePomodoroSession,
  resumePomodoroSession,
  completePomodoroSession,
  advancePomodoroPhase,
  getPomodoroRemainingTime,
  getPomodoroElapsedTime,
  getTodayPomodoroCount,
  PomodoroSession,
  PomodoroState,
} from '../../storage/repositories/pomodoro.js';
import { getCategoryByName } from '../../storage/repositories/categories.js';
import { success, error, info, formatDurationClock } from '../utils/format.js';

// Format state for display
function formatState(state: PomodoroState): string {
  switch (state) {
    case 'work':
      return chalk.red('🍅 WORK');
    case 'break':
      return chalk.green('☕ BREAK');
    case 'long_break':
      return chalk.blue('🌴 LONG BREAK');
    case 'paused':
      return chalk.yellow('⏸  PAUSED');
    case 'completed':
      return chalk.dim('✓  COMPLETED');
  }
}

// Format time remaining as MM:SS
function formatTimeRemaining(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Start pomodoro timer
export function pomodoroStart(options?: {
  category?: string;
  notes?: string;
  work?: string;
  break?: string;
  project?: string;
}): void {
  const active = getActivePomodoroSession();
  if (active) {
    error('Pomodoro already running');
    console.log(chalk.dim('\nUse `tt pomodoro status` to see current session'));
    console.log(chalk.dim('Or `tt pomodoro stop` to end it'));
    return;
  }

  let categoryId: number | undefined;
  if (options?.category) {
    const category = getCategoryByName(options.category);
    if (!category) {
      error(`Category "${options.category}" not found`);
      return;
    }
    categoryId = category.id;
  }

  // Update settings if custom durations provided
  if (options?.work) {
    const mins = parseInt(options.work, 10);
    if (isNaN(mins) || mins < 1 || mins > 120) {
      error('Invalid work duration: must be an integer between 1-120 minutes');
      return;
    }
    updatePomodoroSetting('work_duration', mins.toString());
    console.log(chalk.dim(`  Work duration set to ${mins} minutes`));
  }
  if (options?.break) {
    const mins = parseInt(options.break, 10);
    if (isNaN(mins) || mins < 1 || mins > 60) {
      error('Invalid break duration: must be an integer between 1-60 minutes');
      return;
    }
    updatePomodoroSetting('break_duration', mins.toString());
    console.log(chalk.dim(`  Break duration set to ${mins} minutes`));
  }

  const settings = getPomodoroSettings();
  const session = startPomodoroSession({
    categoryId,
    notes: options?.notes,
  });

  console.log();
  success('Pomodoro started!');
  console.log();
  console.log(`  ${formatState('work')}`);
  console.log(`  Duration:  ${chalk.bold(settings.work_duration + ' minutes')}`);
  if (options?.category) {
    console.log(`  Category:  ${options.category}`);
  }
  console.log();
  info('Focus on your task. Use `tt pomodoro status` to check time.');
  console.log();
}

// Show pomodoro status
export function pomodoroStatus(): void {
  const session = getActivePomodoroSession();

  console.log();

  if (!session) {
    console.log(chalk.dim('No active pomodoro session'));
    console.log();
    info('Start one with: tt pomodoro start');
    console.log();
    return;
  }

  const remaining = getPomodoroRemainingTime(session);
  const elapsed = getPomodoroElapsedTime(session);
  const todayCount = getTodayPomodoroCount();

  console.log(chalk.bold('Pomodoro Timer'));
  console.log();
  console.log(`  ${formatState(session.state)}`);
  console.log();

  if (session.state !== 'paused' && session.state !== 'completed') {
    // Show time remaining with progress bar
    const total = session.state === 'work' ? session.work_duration :
                  session.state === 'long_break' ? session.long_break_duration :
                  session.break_duration;
    const progress = Math.min(1, Math.max(0, elapsed / total));
    const barWidth = 20;
    const filled = Math.min(barWidth, Math.max(0, Math.floor(progress * barWidth)));
    const empty = barWidth - filled;
    const bar = chalk.red('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));

    console.log(`  Time:      ${chalk.bold(formatTimeRemaining(remaining))} remaining`);
    console.log(`  Progress:  [${bar}] ${Math.floor(progress * 100)}%`);
  } else if (session.state === 'paused') {
    console.log(`  Paused at: ${formatTimeRemaining(elapsed)} elapsed`);
  }

  console.log(`  Session:   ${session.current_session} of ${session.sessions_until_long_break}`);
  console.log(`  Today:     ${todayCount} pomodoro${todayCount !== 1 ? 's' : ''} completed`);

  if (session.notes) {
    console.log(`  Notes:     ${session.notes}`);
  }

  console.log();

  // Show available actions
  if (session.state === 'paused') {
    info('Resume with: tt pomodoro resume');
  } else if (remaining === 0) {
    info('Phase complete! Advance with: tt pomodoro next');
  } else {
    info('Pause with: tt pomodoro pause');
  }
  console.log();
}

// Pause pomodoro
export function pomodoroPause(): void {
  const session = getActivePomodoroSession();

  if (!session) {
    error('No active pomodoro session');
    return;
  }

  if (session.state === 'paused') {
    error('Pomodoro is already paused');
    return;
  }

  if (session.state === 'completed') {
    error('Pomodoro is already completed');
    return;
  }

  pausePomodoroSession(session.id);
  console.log();
  success('Pomodoro paused');
  console.log(chalk.dim('\nResume with: tt pomodoro resume'));
  console.log();
}

// Resume pomodoro
export function pomodoroResume(): void {
  const session = getActivePomodoroSession();

  if (!session) {
    error('No active pomodoro session');
    return;
  }

  if (session.state !== 'paused') {
    error('Pomodoro is not paused');
    return;
  }

  resumePomodoroSession(session.id);
  console.log();
  success('Pomodoro resumed');
  console.log();
}

// Advance to next phase
export function pomodoroNext(): void {
  const session = getActivePomodoroSession();

  if (!session) {
    error('No active pomodoro session');
    return;
  }

  if (session.state === 'paused') {
    error('Resume the pomodoro first');
    return;
  }

  const { newState, completed } = advancePomodoroPhase(session.id);

  console.log();
  if (completed) {
    success('Pomodoro cycle completed!');
  } else {
    success(`Moved to ${newState.replace('_', ' ')}`);
    console.log();
    console.log(`  ${formatState(newState)}`);
  }
  console.log();
}

// Stop/complete pomodoro
export function pomodoroStop(): void {
  const session = getActivePomodoroSession();

  if (!session) {
    error('No active pomodoro session');
    return;
  }

  completePomodoroSession(session.id);
  const todayCount = getTodayPomodoroCount();

  console.log();
  success('Pomodoro stopped');
  console.log();
  console.log(`  Sessions completed: ${session.current_session - 1}`);
  console.log(`  Today's total:      ${todayCount} pomodoro${todayCount !== 1 ? 's' : ''}`);
  console.log();
}

// Skip current phase
export function pomodoroSkip(): void {
  const session = getActivePomodoroSession();

  if (!session) {
    error('No active pomodoro session');
    return;
  }

  const { newState } = advancePomodoroPhase(session.id);

  console.log();
  info(`Skipped to ${newState.replace('_', ' ')}`);
  console.log();
  console.log(`  ${formatState(newState)}`);
  console.log();
}

// Configure pomodoro settings
export function pomodoroConfig(options: {
  work?: string;
  break?: string;
  longBreak?: string;
  sessions?: string;
  autoBreak?: boolean;
  autoWork?: boolean;
}): void {
  const settings = getPomodoroSettings();

  // Check if any actual options were passed
  const hasOptions = options.work || options.break || options.longBreak ||
                     options.sessions || options.autoBreak !== undefined ||
                     options.autoWork !== undefined;

  if (!hasOptions) {
    // Show current settings
    console.log();
    console.log(chalk.bold('Pomodoro Settings'));
    console.log();
    console.log(`  Work duration:       ${settings.work_duration} minutes`);
    console.log(`  Break duration:      ${settings.break_duration} minutes`);
    console.log(`  Long break duration: ${settings.long_break_duration} minutes`);
    console.log(`  Sessions until long: ${settings.sessions_until_long_break}`);
    console.log(`  Auto-start breaks:   ${settings.auto_start_breaks ? 'yes' : 'no'}`);
    console.log(`  Auto-start work:     ${settings.auto_start_work ? 'yes' : 'no'}`);
    console.log();
    return;
  }

  // Validate all inputs first before making any updates
  const validationErrors: string[] = [];

  if (options.work) {
    const mins = parseInt(options.work, 10);
    if (isNaN(mins) || mins < 1 || mins > 120) {
      validationErrors.push('Work duration must be between 1-120 minutes');
    }
  }

  if (options.break) {
    const mins = parseInt(options.break, 10);
    if (isNaN(mins) || mins < 1 || mins > 60) {
      validationErrors.push('Break duration must be between 1-60 minutes');
    }
  }

  if (options.longBreak) {
    const mins = parseInt(options.longBreak, 10);
    if (isNaN(mins) || mins < 1 || mins > 120) {
      validationErrors.push('Long break duration must be between 1-120 minutes');
    }
  }

  if (options.sessions) {
    const count = parseInt(options.sessions, 10);
    if (isNaN(count) || count < 1 || count > 10) {
      validationErrors.push('Sessions count must be between 1-10');
    }
  }

  // Report all validation errors at once
  if (validationErrors.length > 0) {
    console.log();
    for (const err of validationErrors) {
      error(err);
    }
    console.log();
    return;
  }

  // Apply updates only if validation passed
  let updated = false;

  if (options.work) {
    const mins = parseInt(options.work, 10);
    updatePomodoroSetting('work_duration', mins.toString());
    updated = true;
  }

  if (options.break) {
    const mins = parseInt(options.break, 10);
    updatePomodoroSetting('break_duration', mins.toString());
    updated = true;
  }

  if (options.longBreak) {
    const mins = parseInt(options.longBreak, 10);
    updatePomodoroSetting('long_break_duration', mins.toString());
    updated = true;
  }

  if (options.sessions) {
    const count = parseInt(options.sessions, 10);
    updatePomodoroSetting('sessions_until_long_break', count.toString());
    updated = true;
  }

  if (options.autoBreak !== undefined) {
    updatePomodoroSetting('auto_start_breaks', options.autoBreak.toString());
    updated = true;
  }

  if (options.autoWork !== undefined) {
    updatePomodoroSetting('auto_start_work', options.autoWork.toString());
    updated = true;
  }

  if (updated) {
    console.log();
    success('Settings updated');
    console.log();
    pomodoroConfig({});
  }
}
