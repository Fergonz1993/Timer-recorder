import chalk from 'chalk';
import Table from 'cli-table3';
import asciichart from 'asciichart';
import {
  getCategorySummary,
  getCategorySummaryFiltered,
  getDailyTotals,
  getHourlyBreakdown,
  getWeekRange,
  type FilterOptions,
} from '../../storage/repositories/entries.js';
import { getProjectByName } from '../../storage/repositories/projects.js';
import { getTagByName } from '../../storage/repositories/tags.js';
import { formatDuration, formatCategory, formatBar } from '../utils/format.js';

interface WeekOptions {
  weeksAgo?: number;
  previous?: string;
  project?: string;
  tag?: string;
  tags?: string;
}

export function weekCommand(options?: WeekOptions): void {
  const weeksAgo = options?.weeksAgo || (options?.previous ? parseInt(options.previous, 10) : 0);
  const { start, end } = getWeekRange(weeksAgo);

  // Build filters
  const filters: FilterOptions = {};
  let filterDescription = '';

  if (options?.project) {
    const project = getProjectByName(options.project);
    if (project) {
      filters.projectId = project.id;
      filterDescription += ` [project: ${project.name}]`;
    }
  }

  if (options?.tag || options?.tags) {
    const tagString = options.tag || options.tags || '';
    const tagNames = tagString.split(',').map(t => t.trim()).filter(t => t);
    const tagIds: number[] = [];
    for (const name of tagNames) {
      const tag = getTagByName(name);
      if (tag) tagIds.push(tag.id);
    }
    if (tagIds.length > 0) {
      filters.tagIds = tagIds;
      filterDescription += ` [tags: ${tagNames.join(', ')}]`;
    }
  }

  const hasFilters = filters.projectId || (filters.tagIds && filters.tagIds.length > 0);

  const summary = hasFilters
    ? getCategorySummaryFiltered(start, end, filters)
    : getCategorySummary(start, end);
  const dailyTotals = getDailyTotals(start, end);  // Note: daily/hourly charts don't filter
  const hourlyData = getHourlyBreakdown(start, end);

  // Calculate total seconds
  const totalSeconds = summary.reduce((acc, s) => acc + s.total_seconds, 0);

  // Format date range
  const startDate = new Date(start);
  const endDate = new Date(end);
  const dateRange = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  console.log();
  console.log(chalk.bold('Weekly Summary') + (filterDescription ? chalk.dim(filterDescription) : ''));
  console.log(chalk.dim(dateRange));
  console.log();

  if (summary.length === 0) {
    console.log(chalk.dim('  No time tracked this week.'));
    console.log();
    return;
  }

  console.log(`  Total: ${chalk.bold(formatDuration(totalSeconds))}`);
  console.log();

  // Daily trend chart
  renderDailyChart(dailyTotals, start);

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

function renderDailyChart(dailyTotals: { date: string; total_seconds: number; day_name: string }[], weekStart: string): void {
  console.log(chalk.bold('Daily Activity'));
  console.log();

  // Create array for all 7 days of the week
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hoursPerDay: number[] = [];

  // Fill in data for each day
  const startDate = new Date(weekStart);
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    const dayData = dailyTotals.find((d) => d.date === dateStr);
    hoursPerDay.push(dayData ? dayData.total_seconds / 3600 : 0);
  }

  // Only show chart if there's data
  const maxHours = Math.max(...hoursPerDay);
  if (maxHours > 0) {
    // ASCII chart
    const chartConfig = {
      height: 8,
      colors: [asciichart.blue],
      format: (x: number) => x.toFixed(1).padStart(5) + 'h',
    };

    console.log(asciichart.plot(hoursPerDay, chartConfig));
    console.log('        ' + days.map((d) => d.padStart(5)).join('  '));
  } else {
    // Simple bar chart fallback
    for (let i = 0; i < 7; i++) {
      const hours = hoursPerDay[i];
      const barLength = Math.round((hours / Math.max(maxHours, 1)) * 20);
      const bar = hours > 0 ? chalk.blue('█'.repeat(barLength)) : chalk.dim('·');
      console.log(`  ${days[i]}  ${bar} ${formatDuration(hoursPerDay[i] * 3600)}`);
    }
  }

  console.log();
}

function renderHourlyHeatmap(hourlyData: { hour: number; total_seconds: number }[]): void {
  console.log(chalk.bold('Activity by Hour'));
  console.log();

  // Create array for all 24 hours
  const hourlySeconds = new Array(24).fill(0);
  for (const h of hourlyData) {
    hourlySeconds[h.hour] = h.total_seconds;
  }

  const maxSeconds = Math.max(...hourlySeconds);

  // Render two rows: 0-11 and 12-23
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
