/**
 * Prediction commands for ML-based insights
 */

import chalk from 'chalk';
import { success, info } from '../utils/format.js';
import {
  getTimePatterns,
  predictWorkday,
  predictWeek,
  getProductivityInsights,
  suggestNextCategory,
  estimateTimeNeeded,
  getFocusTimeRecommendations,
  detectAnomaly,
} from '../../ml/predictions.js';

// Show predictions for today
export function predictTodayCommand(): void {
  console.log();
  console.log(chalk.bold('Today\'s Predictions'));
  console.log();

  const prediction = predictWorkday(new Date());

  if (prediction.confidence === 0) {
    info('Not enough data for predictions yet. Keep tracking!');
    console.log();
    return;
  }

  console.log(`  Predicted Work:       ${chalk.cyan(prediction.predictedHours + 'h')}`);
  console.log(`  Confidence:           ${getConfidenceBar(prediction.confidence)}`);
  console.log(`  Peak Productivity:    ${chalk.cyan(formatHour(prediction.peakProductivityHour))}`);
  console.log(`  Expected Score:       ${chalk.cyan(prediction.estimatedProductivityScore + '%')}`);
  console.log();

  if (prediction.suggestedCategories.length > 0) {
    console.log(chalk.bold('  Suggested Categories:'));
    for (const cat of prediction.suggestedCategories) {
      const prob = Math.round(cat.probability * 100);
      console.log(`    ${chalk.dim('•')} ${cat.category} ${chalk.dim(`(${prob}% likely)`)}`);
    }
  }

  console.log();
}

// Show weekly predictions
export function predictWeekCommand(): void {
  console.log();
  console.log(chalk.bold('Weekly Predictions'));
  console.log();

  const predictions = predictWeek();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Calculate total
  let totalHours = 0;
  let avgConfidence = 0;

  for (const pred of predictions) {
    totalHours += pred.predictedHours;
    avgConfidence += pred.confidence;
  }
  avgConfidence = Math.round(avgConfidence / predictions.length);

  console.log(`  Total Expected:  ${chalk.cyan(Math.round(totalHours * 10) / 10 + 'h')}  ${chalk.dim(`(${avgConfidence}% confidence)`)}`);
  console.log();

  // Show each day
  for (const pred of predictions) {
    const date = new Date(pred.date);
    const dayName = days[date.getDay()];
    const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;

    const bar = getHoursBar(pred.predictedHours, 12);
    console.log(`  ${chalk.cyan(dayName)} ${chalk.dim(dateStr.padStart(5))}  ${bar} ${pred.predictedHours}h`);
  }

  console.log();
}

// Show productivity insights
export function insightsCommand(): void {
  console.log();
  console.log(chalk.bold('Productivity Insights'));
  console.log();

  const insights = getProductivityInsights();

  if (insights.length === 0) {
    info('Not enough data for insights yet. Keep tracking!');
    console.log();
    return;
  }

  // Sort by importance
  const sorted = insights.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.importance] - order[b.importance];
  });

  for (const insight of sorted) {
    const icon = getInsightIcon(insight.importance);
    const color = getInsightColor(insight.importance);

    console.log(`  ${icon} ${color(insight.title)}`);
    console.log(`    ${chalk.dim(insight.description)}`);
    console.log();
  }
}

// Suggest what to work on next
export function suggestCommand(): void {
  console.log();
  console.log(chalk.bold('Work Suggestion'));
  console.log();

  const suggestion = suggestNextCategory();

  if (!suggestion) {
    info('Not enough data to make suggestions yet.');
    console.log();
    console.log(`  Start tracking with: ${chalk.cyan('tt start <category>')}`);
    console.log();
    return;
  }

  console.log(`  Based on your patterns, you typically work on:`);
  console.log();
  console.log(`    ${chalk.cyan.bold(suggestion.category)}`);
  console.log(`    ${chalk.dim(`Confidence: ${suggestion.confidence}%`)}`);
  console.log();
  console.log(`  Start now with: ${chalk.cyan(`tt start ${suggestion.category}`)}`);
  console.log();
}

// Estimate time for a category
export function estimateCommand(category: string, options: { target?: string }): void {
  console.log();
  console.log(chalk.bold('Time Estimate'));
  console.log();

  const targetMinutes = options.target ? parseTargetDuration(options.target) : undefined;
  const estimate = estimateTimeNeeded(category, targetMinutes);

  if (estimate.confidence === 0) {
    info(`No history for "${category}" yet.`);
    console.log();
    return;
  }

  console.log(`  Category:            ${chalk.cyan(category)}`);
  console.log(`  Avg Session Length:  ${chalk.cyan(estimate.avgSessionLength + ' min')}`);

  if (targetMinutes) {
    console.log();
    console.log(`  To complete ${chalk.cyan(formatDuration(targetMinutes))} of ${category}:`);
    console.log(`    Suggested Sessions: ${chalk.cyan(estimate.suggestedSessions.toString())}`);
    console.log(`    Session Length:     ${chalk.dim(estimate.avgSessionLength + ' min each')}`);
  }

  console.log(`  Confidence:          ${getConfidenceBar(estimate.confidence)}`);
  console.log();
}

// Show focus time recommendations
export function focusRecsCommand(): void {
  console.log();
  console.log(chalk.bold('Focus Time Recommendations'));
  console.log();

  const recs = getFocusTimeRecommendations();

  console.log(chalk.bold('  Best Focus Hours:'));
  if (recs.bestFocusHours.length > 0) {
    console.log(`    ${recs.bestFocusHours.map(h => formatHour(h)).join(', ')}`);
  } else {
    console.log(`    ${chalk.dim('Not enough data')}`);
  }
  console.log();

  console.log(chalk.bold('  Optimal Session:'));
  console.log(`    ${chalk.cyan(recs.optimalSessionLength + ' minutes')} work, then break`);
  console.log(`    Take a break every ${chalk.cyan(recs.recommendedBreakInterval + ' minutes')}`);
  console.log();

  if (recs.distractionPeakHours.length > 0) {
    console.log(chalk.bold('  Distraction Peak Hours:'));
    console.log(`    ${chalk.yellow(recs.distractionPeakHours.map(h => formatHour(h)).join(', '))}`);
    console.log(`    ${chalk.dim('Consider blocking distractions during these times')}`);
    console.log();
  }
}

// Show work patterns
export function patternsCommand(): void {
  console.log();
  console.log(chalk.bold('Work Patterns'));
  console.log();

  const patterns = getTimePatterns(90);

  if (patterns.length === 0) {
    info('Not enough data for patterns yet. Keep tracking!');
    console.log();
    return;
  }

  // Group by day of week
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const byDay: Map<number, typeof patterns> = new Map();

  for (const p of patterns) {
    if (!byDay.has(p.dayOfWeek)) {
      byDay.set(p.dayOfWeek, []);
    }
    byDay.get(p.dayOfWeek)!.push(p);
  }

  // Show heatmap-style view
  console.log('  Hour:  ' + chalk.dim('06  08  10  12  14  16  18  20  22'));
  console.log();

  for (let d = 1; d <= 6; d++) { // Monday to Saturday
    const dayPatterns = byDay.get(d) || [];
    let line = `  ${days[d]}:  `;

    for (let h = 6; h <= 22; h += 2) {
      const hourPatterns = dayPatterns.filter(p => p.hour >= h && p.hour < h + 2);
      const freq = hourPatterns.reduce((sum, p) => sum + p.frequency, 0);

      if (freq === 0) {
        line += chalk.dim('░░');
      } else if (freq < 5) {
        line += chalk.blue('▒▒');
      } else if (freq < 10) {
        line += chalk.cyan('▓▓');
      } else {
        line += chalk.green('██');
      }
      line += '  ';
    }

    console.log(line);
  }

  // Sunday
  const sundayPatterns = byDay.get(0) || [];
  let sundayLine = `  ${days[0]}:  `;
  for (let h = 6; h <= 22; h += 2) {
    const hourPatterns = sundayPatterns.filter(p => p.hour >= h && p.hour < h + 2);
    const freq = hourPatterns.reduce((sum, p) => sum + p.frequency, 0);

    if (freq === 0) {
      sundayLine += chalk.dim('░░');
    } else if (freq < 5) {
      sundayLine += chalk.blue('▒▒');
    } else if (freq < 10) {
      sundayLine += chalk.cyan('▓▓');
    } else {
      sundayLine += chalk.green('██');
    }
    sundayLine += '  ';
  }
  console.log(sundayLine);

  console.log();
  console.log('  Legend: ' + chalk.dim('░░') + ' None  ' + chalk.blue('▒▒') + ' Low  ' + chalk.cyan('▓▓') + ' Medium  ' + chalk.green('██') + ' High');
  console.log();
}

// Helper functions
function getConfidenceBar(confidence: number): string {
  const filled = Math.round(confidence / 10);
  const empty = 10 - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  if (confidence >= 70) {
    return chalk.green(bar) + ` ${confidence}%`;
  } else if (confidence >= 40) {
    return chalk.yellow(bar) + ` ${confidence}%`;
  } else {
    return chalk.red(bar) + ` ${confidence}%`;
  }
}

function getHoursBar(hours: number, maxHours: number): string {
  const width = 20;
  const filled = Math.round((hours / maxHours) * width);
  const empty = width - filled;
  return chalk.cyan('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
}

function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function parseTargetDuration(target: string): number {
  const match = target.match(/^(\d+)(h|m)?$/i);
  if (!match) return 60;

  const value = parseInt(match[1], 10);
  const unit = match[2]?.toLowerCase();

  if (unit === 'h') return value * 60;
  if (unit === 'm') return value;
  if (value > 12) return value; // Assume minutes if > 12
  return value * 60; // Assume hours
}

function getInsightIcon(importance: 'high' | 'medium' | 'low'): string {
  switch (importance) {
    case 'high': return chalk.red('●');
    case 'medium': return chalk.yellow('●');
    case 'low': return chalk.green('●');
  }
}

function getInsightColor(importance: 'high' | 'medium' | 'low'): (s: string) => string {
  switch (importance) {
    case 'high': return chalk.red.bold;
    case 'medium': return chalk.yellow;
    case 'low': return chalk.green;
  }
}
