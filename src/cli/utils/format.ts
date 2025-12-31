import chalk from 'chalk';

// Format seconds as human-readable duration
export function formatDuration(seconds: number): string {
  if (seconds < 0) seconds = 0;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs.toString().padStart(2, '0')}s`;
  } else {
    return `${secs}s`;
  }
}

// Format duration as HH:MM:SS
export function formatDurationClock(seconds: number): string {
  if (seconds < 0) seconds = 0;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    secs.toString().padStart(2, '0'),
  ].join(':');
}

// Create a colored category name
export function formatCategory(name: string, color?: string | null): string {
  if (color) {
    return chalk.hex(color)(name);
  }
  return chalk.cyan(name);
}

// Create a progress bar
export function formatBar(percentage: number, width = 20): string {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
}

// Format a timestamp
export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

// Format a date
export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// Success message
export function success(message: string): void {
  console.log(chalk.green('✓'), message);
}

// Error message
export function error(message: string): void {
  console.log(chalk.red('✗'), message);
}

// Warning message
export function warn(message: string): void {
  console.log(chalk.yellow('!'), message);
}

// Info message
export function info(message: string): void {
  console.log(chalk.blue('i'), message);
}
