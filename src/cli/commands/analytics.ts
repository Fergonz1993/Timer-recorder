import chalk from 'chalk';
import Table from 'cli-table3';
import asciichart from 'asciichart';
import {
  getCategorySummary,
  getDailyTotals,
  getHourlyBreakdown,
  getMonthRange,
  getWeekRange,
  getWeeklyTotals,
  getMonthlyTotals,
  getStreakData,
  getProductivityScore,
  getAverageStats,
} from '../../storage/repositories/entries.js';
import { formatDuration, formatCategory, formatBar } from '../utils/format.js';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Monthly summary (similar to week command)
 */
export function monthCommand(options?: { monthsAgo?: number }): void {
  const monthsAgo = options?.monthsAgo || 0;
  const { start, end } = getMonthRange(monthsAgo);

  const summary = getCategorySummary(start, end);
  const dailyTotals = getDailyTotals(start, end);
  const hourlyData = getHourlyBreakdown(start, end);

  // Calculate total seconds
  const totalSeconds = summary.reduce((acc, s) => acc + s.total_seconds, 0);

  // Format date range
  const startDate = new Date(start);
  const monthName = startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  console.log();
  console.log(chalk.bold('Monthly Summary'));
  console.log(chalk.dim(monthName));
  console.log();

  if (summary.length === 0) {
    console.log(chalk.dim('  No time tracked this month.'));
    console.log();
    return;
  }

  console.log(`  Total: ${chalk.bold(formatDuration(totalSeconds))}`);
  console.log();

  // Daily trend chart
  renderMonthlyChart(dailyTotals, start, end);

  // Category breakdown table
  console.log(chalk.bold('By Category'));
  console.log();

  const table = new Table({
    head: [
      chalk.bold('Category'),
      chalk.bold('Time'),
      chalk.bold('%'),
      chalk.bold(''),
    ],
    colWidths: [22, 12, 8, 24],
    style: { head: [], border: [] },
    chars: {
      top: '─', 'top-mid': '─', 'top-left': '', 'top-right': '',
      bottom: '─', 'bottom-mid': '─', 'bottom-left': '', 'bottom-right': '',
      left: '', 'left-mid': '', mid: '─', 'mid-mid': '─',
      right: '', 'right-mid': '', middle: ' ',
    },
  });

  for (const item of summary) {
    const percentage = totalSeconds > 0 ? (item.total_seconds / totalSeconds) * 100 : 0;
    table.push([
      '  ' + formatCategory(item.category, item.color),
      formatDuration(item.total_seconds),
      `${percentage.toFixed(1)}%`,
      formatBar(percentage, 20),
    ]);
  }

  console.log(table.toString());
  console.log();

  // Hourly heatmap
  renderHourlyHeatmap(hourlyData);
}

function renderMonthlyChart(
  dailyTotals: { date: string; total_seconds: number; day_name: string }[],
  start: string,
  end: string
): void {
  console.log(chalk.bold('Daily Activity'));
  console.log();

  const startDate = new Date(start);
  const year = startDate.getFullYear();
  const month = startDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Create array for all days of the month
  const hoursPerDay: number[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateStr = date.toISOString().split('T')[0];

    const dayData = dailyTotals.find((d) => d.date === dateStr);
    hoursPerDay.push(dayData ? dayData.total_seconds / 3600 : 0);
  }

  const maxHours = Math.max(...hoursPerDay);
  if (maxHours > 0) {
    // ASCII chart
    const chartConfig = {
      height: 8,
      colors: [asciichart.green],
      format: (x: number) => x.toFixed(1).padStart(5) + 'h',
    };

    console.log(asciichart.plot(hoursPerDay, chartConfig));

    // Day labels (show every 5 days)
    let labels = '        ';
    for (let i = 1; i <= daysInMonth; i++) {
      if (i === 1 || i % 5 === 0 || i === daysInMonth) {
        labels += i.toString().padStart(2);
      } else {
        labels += '  ';
      }
    }
    console.log(chalk.dim(labels));
  } else {
    console.log(chalk.dim('  No data to display'));
  }

  console.log();
}

function renderHourlyHeatmap(hourlyData: { hour: number; total_seconds: number }[]): void {
  console.log(chalk.bold('Activity by Hour'));
  console.log();

  const hourlySeconds = new Array(24).fill(0);
  for (const h of hourlyData) {
    hourlySeconds[h.hour] = h.total_seconds;
  }

  const maxSeconds = Math.max(...hourlySeconds);

  const renderRow = (startHour: number, endHour: number) => {
    let hours = '  ';
    let blocks = '  ';

    for (let h = startHour; h <= endHour; h++) {
      hours += h.toString().padStart(2) + ' ';

      const seconds = hourlySeconds[h];
      const intensity = maxSeconds > 0 ? seconds / maxSeconds : 0;

      if (seconds === 0) {
        blocks += chalk.dim('░░') + ' ';
      } else if (intensity < 0.25) {
        blocks += chalk.blue('▒▒') + ' ';
      } else if (intensity < 0.5) {
        blocks += chalk.cyan('▓▓') + ' ';
      } else if (intensity < 0.75) {
        blocks += chalk.green('▓▓') + ' ';
      } else {
        blocks += chalk.greenBright('██') + ' ';
      }
    }

    console.log(chalk.dim(hours));
    console.log(blocks);
  };

  renderRow(0, 11);
  renderRow(12, 23);

  console.log();
  console.log(chalk.dim('  ░░ none  ▒▒ low  ▓▓ medium  ██ high'));
  console.log();
}

/**
 * Compare time periods (week-over-week or month-over-month)
 */
export function compareCommand(options: { type?: string; periods?: string }): void {
  const type = options.type || 'week';
  const periods = options.periods ? parseInt(options.periods, 10) : 4;

  if (isNaN(periods) || periods < 2 || periods > 12) {
    console.log(chalk.red('Periods must be a number between 2 and 12'));
    process.exit(1);
  }

  console.log();

  if (type === 'week') {
    compareWeeks(periods);
  } else if (type === 'month') {
    compareMonths(periods);
  } else {
    console.log(chalk.red('Type must be "week" or "month"'));
    process.exit(1);
  }
}

function compareWeeks(weeks: number): void {
  const weeklyTotals = getWeeklyTotals(weeks);

  console.log(chalk.bold('Week-over-Week Comparison'));
  console.log();

  if (weeklyTotals.every(w => w.total_seconds === 0)) {
    console.log(chalk.dim('  No data to compare.'));
    console.log();
    return;
  }

  const maxSeconds = Math.max(...weeklyTotals.map(w => w.total_seconds));

  const table = new Table({
    head: [chalk.cyan('Week'), chalk.cyan('Total'), chalk.cyan('Change'), chalk.cyan('')],
    colWidths: [20, 12, 12, 30],
  });

  for (let i = 0; i < weeklyTotals.length; i++) {
    const week = weeklyTotals[i];
    const label = i === 0 ? 'This week' : i === 1 ? 'Last week' : `${i} weeks ago`;

    // Calculate change from previous period
    let change = '';
    if (i < weeklyTotals.length - 1) {
      const prev = weeklyTotals[i + 1].total_seconds;
      if (prev > 0) {
        const diff = ((week.total_seconds - prev) / prev) * 100;
        if (diff > 0) {
          change = chalk.green(`+${diff.toFixed(0)}%`);
        } else if (diff < 0) {
          change = chalk.red(`${diff.toFixed(0)}%`);
        } else {
          change = chalk.dim('0%');
        }
      }
    }

    const barWidth = maxSeconds > 0 ? Math.round((week.total_seconds / maxSeconds) * 25) : 0;
    const bar = chalk.blue('█'.repeat(barWidth));

    table.push([
      label,
      formatDuration(week.total_seconds),
      change,
      bar,
    ]);
  }

  console.log(table.toString());
  console.log();
}

function compareMonths(months: number): void {
  const monthlyTotals = getMonthlyTotals(months);

  console.log(chalk.bold('Month-over-Month Comparison'));
  console.log();

  if (monthlyTotals.length === 0 || monthlyTotals.every(m => m.total_seconds === 0)) {
    console.log(chalk.dim('  No data to compare.'));
    console.log();
    return;
  }

  const maxSeconds = Math.max(...monthlyTotals.map(m => m.total_seconds));

  const table = new Table({
    head: [chalk.cyan('Month'), chalk.cyan('Total'), chalk.cyan('Change'), chalk.cyan('')],
    colWidths: [20, 12, 12, 30],
  });

  for (let i = 0; i < monthlyTotals.length; i++) {
    const month = monthlyTotals[i];
    const monthName = MONTH_NAMES[month.month_num - 1];
    const label = `${monthName} ${month.year}`;

    // Calculate change from previous period
    let change = '';
    if (i < monthlyTotals.length - 1) {
      const prev = monthlyTotals[i + 1].total_seconds;
      if (prev > 0) {
        const diff = ((month.total_seconds - prev) / prev) * 100;
        if (diff > 0) {
          change = chalk.green(`+${diff.toFixed(0)}%`);
        } else if (diff < 0) {
          change = chalk.red(`${diff.toFixed(0)}%`);
        } else {
          change = chalk.dim('0%');
        }
      }
    }

    const barWidth = maxSeconds > 0 ? Math.round((month.total_seconds / maxSeconds) * 25) : 0;
    const bar = chalk.green('█'.repeat(barWidth));

    table.push([
      label,
      formatDuration(month.total_seconds),
      change,
      bar,
    ]);
  }

  console.log(table.toString());
  console.log();
}

/**
 * Overall statistics
 */
export function statsCommand(): void {
  const stats = getAverageStats();
  const streaks = getStreakData();

  // Get productivity for this week
  const { start: weekStart, end: weekEnd } = getWeekRange(0);
  const weekProductivity = getProductivityScore(weekStart, weekEnd);

  // Get productivity for this month
  const { start: monthStart, end: monthEnd } = getMonthRange(0);
  const monthProductivity = getProductivityScore(monthStart, monthEnd);

  console.log();
  console.log(chalk.bold('Overall Statistics'));
  console.log();

  if (stats.totalDays === 0) {
    console.log(chalk.dim('  No data to display.'));
    console.log();
    return;
  }

  // Summary section
  console.log(chalk.bold('Summary'));
  console.log();
  console.log(`  Total time tracked:  ${chalk.bold(formatDuration(stats.totalSeconds))}`);
  console.log(`  Days with entries:   ${chalk.bold(stats.totalDays.toString())}`);
  console.log(`  Total entries:       ${chalk.bold(stats.totalEntries.toString())}`);
  console.log();

  // Averages section
  console.log(chalk.bold('Averages'));
  console.log();
  console.log(`  Per day:   ${formatDuration(Math.round(stats.avgDailySeconds))}`);
  console.log(`  Per week:  ${formatDuration(Math.round(stats.avgWeeklySeconds))}`);
  console.log();

  // Streaks section
  console.log(chalk.bold('Streaks'));
  console.log();

  if (streaks.currentStreak > 0) {
    console.log(`  Current streak:  ${chalk.green(streaks.currentStreak + ' day' + (streaks.currentStreak !== 1 ? 's' : ''))} ${chalk.yellow('★')}`);
  } else {
    console.log(`  Current streak:  ${chalk.dim('0 days')}`);
  }
  console.log(`  Longest streak:  ${chalk.bold(streaks.longestStreak + ' day' + (streaks.longestStreak !== 1 ? 's' : ''))}`);
  if (streaks.lastActiveDate) {
    const lastActive = new Date(streaks.lastActiveDate);
    console.log(`  Last active:     ${lastActive.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`);
  }
  console.log();

  // Productivity section
  console.log(chalk.bold('Productivity Score'));
  console.log();

  const renderProductivityBar = (score: number, label: string) => {
    const width = 20;
    const filled = Math.round((score / 100) * width);
    let color = chalk.red;
    if (score >= 80) color = chalk.green;
    else if (score >= 60) color = chalk.yellow;
    else if (score >= 40) color = chalk.cyan;

    const bar = color('█'.repeat(filled)) + chalk.dim('░'.repeat(width - filled));
    console.log(`  ${label.padEnd(12)} ${bar} ${score.toFixed(0)}%`);
  };

  renderProductivityBar(weekProductivity.score, 'This week:');
  renderProductivityBar(monthProductivity.score, 'This month:');
  console.log();
  console.log(chalk.dim('  Productivity = productive time / total tracked time'));
  console.log();
}
