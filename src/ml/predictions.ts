/**
 * ML Predictions Engine
 *
 * Analyzes historical time tracking data to provide:
 * - Work pattern predictions
 * - Productivity forecasts
 * - Anomaly detection
 * - Smart suggestions
 */

import { getDatabase } from '../storage/database.js';

export interface TimePattern {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  hour: number; // 0-23
  avgDuration: number; // Average session duration in minutes
  frequency: number; // How often this pattern occurs
  topCategory: string;
  productivity: number; // 0-100 score
}

export interface WorkdayPrediction {
  date: string;
  predictedHours: number;
  confidence: number;
  suggestedCategories: Array<{ category: string; probability: number }>;
  peakProductivityHour: number;
  estimatedProductivityScore: number;
}

export interface ProductivityInsight {
  type: 'peak_hours' | 'weak_days' | 'category_efficiency' | 'burnout_risk' | 'streak';
  title: string;
  description: string;
  data: Record<string, unknown>;
  importance: 'high' | 'medium' | 'low';
}

export interface AnomalyResult {
  isAnomaly: boolean;
  type?: 'unusually_long' | 'unusually_short' | 'unusual_time' | 'unusual_category';
  description?: string;
  zscore?: number;
}

// Get time patterns from historical data
export function getTimePatterns(daysBack: number = 90): TimePattern[] {
  const db = getDatabase();
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  const patterns: Map<string, TimePattern> = new Map();

  // Get all entries from the period
  const entries = db.prepare(`
    SELECT
      te.id,
      te.start_time,
      te.end_time,
      te.duration_seconds / 60.0 as duration_minutes,
      c.name as category_name,
      c.is_productive
    FROM time_entries te
    LEFT JOIN categories c ON te.category_id = c.id
    WHERE te.start_time >= ?
      AND te.end_time IS NOT NULL
    ORDER BY te.start_time
  `).all(since.toISOString()) as Array<{
    id: number;
    start_time: string;
    end_time: string;
    duration_minutes: number;
    category_name: string;
    is_productive: number;
  }>;

  for (const entry of entries) {
    const start = new Date(entry.start_time);
    const dayOfWeek = start.getDay();
    const hour = start.getHours();
    const key = `${dayOfWeek}-${hour}`;

    if (!patterns.has(key)) {
      patterns.set(key, {
        dayOfWeek,
        hour,
        avgDuration: 0,
        frequency: 0,
        topCategory: '',
        productivity: 0,
      });
    }

    const pattern = patterns.get(key)!;
    // Running average
    pattern.avgDuration = (pattern.avgDuration * pattern.frequency + entry.duration_minutes) / (pattern.frequency + 1);
    pattern.frequency += 1;
    pattern.productivity = (pattern.productivity * (pattern.frequency - 1) + (entry.is_productive ? 100 : 0)) / pattern.frequency;

    // Track top category (simple mode)
    if (!pattern.topCategory || entry.category_name) {
      pattern.topCategory = entry.category_name || pattern.topCategory;
    }
  }

  return Array.from(patterns.values()).sort((a, b) => b.frequency - a.frequency);
}

// Predict work for upcoming days
export function predictWorkday(date: Date = new Date()): WorkdayPrediction {
  const patterns = getTimePatterns(90);
  const dayOfWeek = date.getDay();

  // Filter patterns for this day of week
  const dayPatterns = patterns.filter(p => p.dayOfWeek === dayOfWeek);

  if (dayPatterns.length === 0) {
    // No data for this day
    return {
      date: date.toISOString().split('T')[0],
      predictedHours: 0,
      confidence: 0,
      suggestedCategories: [],
      peakProductivityHour: 10, // Default
      estimatedProductivityScore: 0,
    };
  }

  // Calculate predicted hours
  const totalMinutes = dayPatterns.reduce((sum, p) => sum + p.avgDuration * (p.frequency / 10), 0);
  const totalFrequency = dayPatterns.reduce((sum, p) => sum + p.frequency, 0);

  // Find peak productivity hour
  const peakPattern = dayPatterns.reduce((peak, p) =>
    p.productivity > peak.productivity ? p : peak,
    dayPatterns[0]
  );

  // Get suggested categories
  const categoryMap: Map<string, number> = new Map();
  for (const p of dayPatterns) {
    if (p.topCategory) {
      categoryMap.set(p.topCategory, (categoryMap.get(p.topCategory) || 0) + p.frequency);
    }
  }

  const sortedCategories = Array.from(categoryMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const totalCatFreq = sortedCategories.reduce((sum, [_, f]) => sum + f, 0);

  return {
    date: date.toISOString().split('T')[0],
    predictedHours: Math.round(totalMinutes / 60 * 10) / 10,
    confidence: Math.min(100, Math.round(totalFrequency * 2)),
    suggestedCategories: sortedCategories.map(([cat, freq]) => ({
      category: cat,
      probability: Math.round((freq / totalCatFreq) * 100) / 100,
    })),
    peakProductivityHour: peakPattern?.hour || 10,
    estimatedProductivityScore: Math.round(
      dayPatterns.reduce((sum, p) => sum + p.productivity * p.frequency, 0) / totalFrequency
    ),
  };
}

// Get weekly predictions
export function predictWeek(): WorkdayPrediction[] {
  const predictions: WorkdayPrediction[] = [];
  const today = new Date();

  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    predictions.push(predictWorkday(date));
  }

  return predictions;
}

// Detect anomalies in work patterns
export function detectAnomaly(durationMinutes: number, startTime: Date, categoryName?: string): AnomalyResult {
  const patterns = getTimePatterns(90);
  const hour = startTime.getHours();
  const dayOfWeek = startTime.getDay();

  // Calculate mean and standard deviation of durations
  let totalDuration = 0;
  let count = 0;
  const durations: number[] = [];

  for (const p of patterns) {
    totalDuration += p.avgDuration * p.frequency;
    count += p.frequency;
    for (let i = 0; i < p.frequency; i++) {
      durations.push(p.avgDuration);
    }
  }

  if (durations.length < 10) {
    return { isAnomaly: false };
  }

  const mean = totalDuration / count;
  const variance = durations.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / durations.length;
  const stdDev = Math.sqrt(variance);

  const zscore = (durationMinutes - mean) / stdDev;

  // Unusually long (> 2 standard deviations)
  if (zscore > 2) {
    return {
      isAnomaly: true,
      type: 'unusually_long',
      description: `This session (${Math.round(durationMinutes)} min) is significantly longer than your average (${Math.round(mean)} min)`,
      zscore,
    };
  }

  // Unusually short (< -1.5 standard deviations and less than 5 minutes)
  if (zscore < -1.5 && durationMinutes < 5) {
    return {
      isAnomaly: true,
      type: 'unusually_short',
      description: `This session (${Math.round(durationMinutes)} min) is unusually short`,
      zscore,
    };
  }

  // Check for unusual time
  const matchingPatterns = patterns.filter(p => p.dayOfWeek === dayOfWeek && p.hour === hour);
  if (matchingPatterns.length === 0 && patterns.length > 20) {
    return {
      isAnomaly: true,
      type: 'unusual_time',
      description: `You rarely work at ${hour}:00 on ${getDayName(dayOfWeek)}s`,
    };
  }

  return { isAnomaly: false };
}

// Get productivity insights
export function getProductivityInsights(): ProductivityInsight[] {
  const db = getDatabase();
  const insights: ProductivityInsight[] = [];

  // Get data for the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Peak hours analysis
  const hourlyStats = db.prepare(`
    SELECT
      CAST(strftime('%H', start_time) AS INTEGER) as hour,
      SUM(duration_seconds / 60.0) as total_minutes,
      COUNT(*) as session_count,
      AVG(duration_seconds / 60.0) as avg_duration
    FROM time_entries
    WHERE start_time >= ? AND end_time IS NOT NULL
    GROUP BY hour
    ORDER BY total_minutes DESC
  `).all(thirtyDaysAgo.toISOString()) as Array<{
    hour: number;
    total_minutes: number;
    session_count: number;
    avg_duration: number;
  }>;

  if (hourlyStats.length > 0) {
    const peakHours = hourlyStats.slice(0, 3);
    insights.push({
      type: 'peak_hours',
      title: 'Peak Productivity Hours',
      description: `You are most productive between ${peakHours.map(h => `${h.hour}:00`).join(', ')}. Consider scheduling important work during these times.`,
      data: { peakHours: peakHours.map(h => ({ hour: h.hour, minutes: h.total_minutes })) },
      importance: 'high',
    });
  }

  // Weak days analysis
  const dailyStats = db.prepare(`
    SELECT
      CAST(strftime('%w', start_time) AS INTEGER) as day_of_week,
      SUM(duration_seconds / 60.0) as total_minutes,
      COUNT(DISTINCT date(start_time)) as days_worked
    FROM time_entries
    WHERE start_time >= ? AND end_time IS NOT NULL
    GROUP BY day_of_week
    ORDER BY total_minutes / CASE WHEN days_worked > 0 THEN days_worked ELSE 1 END ASC
  `).all(thirtyDaysAgo.toISOString()) as Array<{
    day_of_week: number;
    total_minutes: number;
    days_worked: number;
  }>;

  if (dailyStats.length > 0) {
    const weakestDay = dailyStats[0];
    const avgMinutes = weakestDay.total_minutes / (weakestDay.days_worked || 1);
    if (avgMinutes < 120) { // Less than 2 hours average
      insights.push({
        type: 'weak_days',
        title: 'Low Productivity Day',
        description: `${getDayName(weakestDay.day_of_week)}s tend to be your least productive days (avg ${Math.round(avgMinutes / 60 * 10) / 10}h). Consider restructuring this day.`,
        data: { dayOfWeek: weakestDay.day_of_week, avgHours: avgMinutes / 60 },
        importance: 'medium',
      });
    }
  }

  // Category efficiency
  const categoryStats = db.prepare(`
    SELECT
      c.name as category_name,
      c.is_productive,
      SUM(te.duration_seconds / 60.0) as total_minutes,
      AVG(te.duration_seconds / 60.0) as avg_session
    FROM time_entries te
    JOIN categories c ON te.category_id = c.id
    WHERE te.start_time >= ? AND te.end_time IS NOT NULL
    GROUP BY te.category_id
    ORDER BY total_minutes DESC
  `).all(thirtyDaysAgo.toISOString()) as Array<{
    category_name: string;
    is_productive: number;
    total_minutes: number;
    avg_session: number;
  }>;

  // Find unproductive categories taking too much time
  const unproductiveTime = categoryStats
    .filter(c => !c.is_productive)
    .reduce((sum, c) => sum + c.total_minutes, 0);
  const totalTime = categoryStats.reduce((sum, c) => sum + c.total_minutes, 0);

  if (totalTime > 0 && unproductiveTime / totalTime > 0.3) {
    insights.push({
      type: 'category_efficiency',
      title: 'Unproductive Time Alert',
      description: `${Math.round(unproductiveTime / totalTime * 100)}% of your time is spent on unproductive activities. Consider setting limits.`,
      data: { unproductivePercent: unproductiveTime / totalTime * 100, categories: categoryStats.filter(c => !c.is_productive) },
      importance: 'high',
    });
  }

  // Burnout risk - working too many hours
  const weeklyHours = db.prepare(`
    SELECT
      strftime('%Y-%W', start_time) as week,
      SUM(duration_seconds / 60.0) / 60.0 as hours
    FROM time_entries
    WHERE start_time >= ? AND end_time IS NOT NULL
    GROUP BY week
    ORDER BY week DESC
    LIMIT 4
  `).all(thirtyDaysAgo.toISOString()) as Array<{ week: string; hours: number }>;

  const overworkedWeeks = weeklyHours.filter(w => w.hours > 50);
  if (overworkedWeeks.length >= 2) {
    insights.push({
      type: 'burnout_risk',
      title: 'Burnout Risk Warning',
      description: `You've worked over 50 hours for ${overworkedWeeks.length} weeks recently. Consider taking breaks.`,
      data: { overworkedWeeks },
      importance: 'high',
    });
  }

  // Streak detection
  const streakDays = db.prepare(`
    SELECT DISTINCT date(start_time) as work_date
    FROM time_entries
    WHERE start_time >= ? AND end_time IS NOT NULL
    ORDER BY work_date DESC
  `).all(thirtyDaysAgo.toISOString()) as Array<{ work_date: string }>;

  // Calculate current streak
  let streak = 0;
  const today = new Date().toISOString().split('T')[0];
  const dates = streakDays.map(d => d.work_date);

  if (dates.includes(today) || dates[0] === today) {
    streak = 1;
    const checkDate = new Date();
    for (let i = 1; i < dates.length; i++) {
      checkDate.setDate(checkDate.getDate() - 1);
      if (dates.includes(checkDate.toISOString().split('T')[0])) {
        streak++;
      } else {
        break;
      }
    }
  }

  if (streak >= 7) {
    insights.push({
      type: 'streak',
      title: 'Impressive Work Streak!',
      description: `You've tracked time for ${streak} consecutive days. Keep up the consistency!`,
      data: { streakDays: streak },
      importance: 'low',
    });
  }

  return insights;
}

// Suggest next category based on time and patterns
export function suggestNextCategory(): { category: string; confidence: number } | null {
  const now = new Date();
  const patterns = getTimePatterns(30);
  const currentHour = now.getHours();
  const dayOfWeek = now.getDay();

  const matchingPatterns = patterns.filter(
    p => p.dayOfWeek === dayOfWeek && Math.abs(p.hour - currentHour) <= 1
  );

  if (matchingPatterns.length === 0) {
    return null;
  }

  // Find most frequent category at this time
  const categoryFreq: Map<string, number> = new Map();
  for (const p of matchingPatterns) {
    if (p.topCategory) {
      categoryFreq.set(p.topCategory, (categoryFreq.get(p.topCategory) || 0) + p.frequency);
    }
  }

  if (categoryFreq.size === 0) {
    return null;
  }

  const sorted = Array.from(categoryFreq.entries()).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((sum, [_, f]) => sum + f, 0);

  return {
    category: sorted[0][0],
    confidence: Math.round((sorted[0][1] / total) * 100),
  };
}

// Estimate time needed for a category based on history
export function estimateTimeNeeded(categoryName: string, targetMinutes?: number): {
  estimatedMinutes: number;
  avgSessionLength: number;
  suggestedSessions: number;
  confidence: number;
} {
  const db = getDatabase();

  const stats = db.prepare(`
    SELECT
      AVG(duration_seconds / 60.0) as avg_duration,
      COUNT(*) as session_count,
      SUM(duration_seconds / 60.0) as total_minutes
    FROM time_entries te
    JOIN categories c ON te.category_id = c.id
    WHERE c.name = ? AND te.end_time IS NOT NULL
  `).get(categoryName) as { avg_duration: number; session_count: number; total_minutes: number } | undefined;

  if (!stats || stats.session_count < 3) {
    return {
      estimatedMinutes: targetMinutes || 60,
      avgSessionLength: 30,
      suggestedSessions: targetMinutes ? Math.ceil(targetMinutes / 30) : 2,
      confidence: 0,
    };
  }

  const avgSession = stats.avg_duration;
  const target = targetMinutes || stats.total_minutes / stats.session_count * 2; // Default to 2x average session

  return {
    estimatedMinutes: Math.round(target),
    avgSessionLength: Math.round(avgSession),
    suggestedSessions: Math.ceil(target / avgSession),
    confidence: Math.min(100, Math.round(stats.session_count * 3)),
  };
}

// Get focus time recommendations
export function getFocusTimeRecommendations(): {
  bestFocusHours: number[];
  optimalSessionLength: number;
  recommendedBreakInterval: number;
  distractionPeakHours: number[];
} {
  const patterns = getTimePatterns(60);

  // Find hours with highest productivity and longest average sessions
  const productiveHours = patterns
    .filter(p => p.productivity > 70 && p.avgDuration > 25)
    .sort((a, b) => b.avgDuration * b.productivity - a.avgDuration * a.productivity)
    .slice(0, 5)
    .map(p => p.hour);

  // Calculate optimal session length
  const productivePatterns = patterns.filter(p => p.productivity > 50);
  const avgSessionLength = productivePatterns.length > 0
    ? productivePatterns.reduce((sum, p) => sum + p.avgDuration * p.frequency, 0) /
      productivePatterns.reduce((sum, p) => sum + p.frequency, 0)
    : 45;

  // Find distraction peak hours (low productivity, short sessions)
  const distractionHours = patterns
    .filter(p => p.productivity < 50 || p.avgDuration < 15)
    .sort((a, b) => a.productivity - b.productivity)
    .slice(0, 3)
    .map(p => p.hour);

  return {
    bestFocusHours: productiveHours.length > 0 ? productiveHours : [9, 10, 14, 15],
    optimalSessionLength: Math.round(avgSessionLength),
    recommendedBreakInterval: Math.min(90, Math.round(avgSessionLength * 1.5)),
    distractionPeakHours: distractionHours,
  };
}

// Helper: Get day name
function getDayName(day: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[day] || 'Unknown';
}
