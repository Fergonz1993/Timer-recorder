import chalk from 'chalk';
import { getDatabase } from '../../storage/database.js';
import { info } from '../utils/format.js';

interface ScoreData {
  date: string;
  totalSeconds: number;
  productiveSeconds: number;
  score: number;
  breakdown: { category: string; seconds: number; isProductive: boolean }[];
}

// Calculate productivity score for a date
function calculateDayScore(date: string): ScoreData {
  const db = getDatabase();

  const entries = db.prepare(`
    SELECT
      COALESCE(c.name, 'uncategorized') as category,
      COALESCE(SUM(e.duration_seconds), 0) as seconds,
      COALESCE(c.is_productive, 0) as is_productive
    FROM time_entries e
    LEFT JOIN categories c ON e.category_id = c.id
    WHERE date(e.start_time) = ?
    AND e.duration_seconds IS NOT NULL
    GROUP BY c.id
  `).all(date) as { category: string; seconds: number; is_productive: number }[];

  const totalSeconds = entries.reduce((sum, e) => sum + e.seconds, 0);
  const productiveSeconds = entries
    .filter(e => e.is_productive)
    .reduce((sum, e) => sum + e.seconds, 0);

  const score = totalSeconds > 0 ? Math.round((productiveSeconds / totalSeconds) * 100) : 0;

  return {
    date,
    totalSeconds,
    productiveSeconds,
    score,
    breakdown: entries.map(e => ({
      category: e.category,
      seconds: e.seconds,
      isProductive: !!e.is_productive,
    })),
  };
}

// Calculate weekly average score
function calculateWeekScore(): { average: number; days: ScoreData[] } {
  const days: ScoreData[] = [];
  let totalScore = 0;
  let daysWithData = 0;

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayScore = calculateDayScore(dateStr);
    days.push(dayScore);
    if (dayScore.totalSeconds > 0) {
      totalScore += dayScore.score;
      daysWithData++;
    }
  }

  return {
    average: daysWithData > 0 ? Math.round(totalScore / daysWithData) : 0,
    days,
  };
}

// Get score color
function getScoreColor(score: number): (text: string) => string {
  if (score >= 80) return chalk.green;
  if (score >= 60) return chalk.yellow;
  if (score >= 40) return chalk.hex('#FFA500');
  return chalk.red;
}

// Get score emoji
function getScoreEmoji(score: number): string {
  if (score >= 90) return '🔥';
  if (score >= 80) return '⭐';
  if (score >= 70) return '👍';
  if (score >= 60) return '😊';
  if (score >= 50) return '😐';
  if (score >= 40) return '😕';
  return '😴';
}

// Format duration
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Show today's score
export function scoreTodayCommand(): void {
  const todayDate = new Date().toISOString().split('T')[0];
  const data = calculateDayScore(todayDate);

  console.log();
  console.log(chalk.bold("Today's Productivity Score"));
  console.log();

  if (data.totalSeconds === 0) {
    console.log(chalk.dim('  No time tracked today'));
    console.log();
    return;
  }

  const colorFn = getScoreColor(data.score);
  const emoji = getScoreEmoji(data.score);

  // Show score with visual bar
  const barWidth = 20;
  const filled = Math.floor((data.score / 100) * barWidth);
  const bar = colorFn('█'.repeat(filled)) + chalk.dim('░'.repeat(barWidth - filled));

  console.log(`  ${emoji} Score: ${chalk.bold(colorFn(data.score.toString() + '%'))}`);
  console.log(`  [${bar}]`);
  console.log();
  console.log(`  Total time:      ${formatDuration(data.totalSeconds)}`);
  console.log(`  Productive time: ${formatDuration(data.productiveSeconds)}`);
  console.log();

  // Show breakdown
  if (data.breakdown.length > 0) {
    console.log(chalk.dim('  Breakdown:'));
    for (const item of data.breakdown.sort((a, b) => b.seconds - a.seconds)) {
      const indicator = item.isProductive ? chalk.green('●') : chalk.dim('○');
      console.log(`    ${indicator} ${item.category}: ${formatDuration(item.seconds)}`);
    }
    console.log();
  }
}

// Show weekly score
export function scoreWeekCommand(): void {
  const { average, days } = calculateWeekScore();

  console.log();
  console.log(chalk.bold('Weekly Productivity Score'));
  console.log();

  const colorFn = getScoreColor(average);
  const emoji = getScoreEmoji(average);

  console.log(`  ${emoji} Average: ${chalk.bold(colorFn(average.toString() + '%'))}`);
  console.log();

  // Show day by day
  console.log('  Day-by-day:');
  for (const day of days) {
    const dayName = new Date(day.date).toLocaleDateString('en', { weekday: 'short' });
    const dayColor = getScoreColor(day.score);

    if (day.totalSeconds > 0) {
      const miniBar = dayColor('█'.repeat(Math.floor(day.score / 10))) +
                      chalk.dim('░'.repeat(10 - Math.floor(day.score / 10)));
      console.log(`    ${dayName}: [${miniBar}] ${dayColor(day.score + '%')}`);
    } else {
      console.log(`    ${dayName}: ${chalk.dim('-- no data --')}`);
    }
  }
  console.log();
}

// Default score command
export function scoreCommand(): void {
  scoreTodayCommand();
}
