import { writeFileSync } from 'fs';
import chalk from 'chalk';
import { getDatabase } from '../../storage/database.js';
import { success, error, info, formatDuration } from '../utils/format.js';

interface TeamEntry {
  date: string;
  category: string;
  project: string | null;
  hours: number;
  notes: string | null;
}

interface TeamExportData {
  period: string;
  totalHours: number;
  entries: TeamEntry[];
  byCategory: Record<string, number>;
  byProject: Record<string, number>;
  byDate: Record<string, number>;
}

// Get date range for current week
function getCurrentWeekRange(): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    from: monday.toISOString().split('T')[0],
    to: sunday.toISOString().split('T')[0],
  };
}

// Generate team export data
function generateTeamExportData(options: {
  from?: string;
  to?: string;
  detailed?: boolean;
}): TeamExportData | null {
  const db = getDatabase();

  // Get date range
  let fromDate: string;
  let toDate: string;

  if (options.from && options.to) {
    fromDate = options.from;
    toDate = options.to;
  } else {
    const weekRange = getCurrentWeekRange();
    fromDate = weekRange.from;
    toDate = weekRange.to;
  }

  // Get entries
  const entries = db.prepare(`
    SELECT
      date(e.start_time) as date,
      COALESCE(c.name, 'uncategorized') as category,
      p.name as project,
      e.duration_seconds,
      e.notes
    FROM time_entries e
    LEFT JOIN categories c ON e.category_id = c.id
    LEFT JOIN projects p ON e.project_id = p.id
    WHERE date(e.start_time) BETWEEN ? AND ?
    AND e.duration_seconds IS NOT NULL
    ORDER BY e.start_time
  `).all(fromDate, toDate) as {
    date: string;
    category: string;
    project: string | null;
    duration_seconds: number;
    notes: string | null;
  }[];

  if (entries.length === 0) {
    return null;
  }

  const teamEntries: TeamEntry[] = entries.map(e => ({
    date: e.date,
    category: e.category,
    project: e.project,
    hours: e.duration_seconds / 3600,
    notes: e.notes,
  }));

  const totalHours = teamEntries.reduce((sum, e) => sum + e.hours, 0);

  // Group by category
  const byCategory: Record<string, number> = {};
  for (const e of teamEntries) {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.hours;
  }

  // Group by project
  const byProject: Record<string, number> = {};
  for (const e of teamEntries) {
    const proj = e.project || 'No Project';
    byProject[proj] = (byProject[proj] || 0) + e.hours;
  }

  // Group by date
  const byDate: Record<string, number> = {};
  for (const e of teamEntries) {
    byDate[e.date] = (byDate[e.date] || 0) + e.hours;
  }

  return {
    period: `${fromDate} to ${toDate}`,
    totalHours,
    entries: teamEntries,
    byCategory,
    byProject,
    byDate,
  };
}

// Generate text report
function generateTextReport(data: TeamExportData, detailed: boolean): string {
  let output = '═'.repeat(60) + '\n';
  output += '                    TEAM TIME REPORT\n';
  output += '═'.repeat(60) + '\n\n';

  output += `Period:       ${data.period}\n`;
  output += `Total Hours:  ${data.totalHours.toFixed(2)}\n\n`;

  // By category
  output += '─'.repeat(60) + '\n';
  output += 'BY CATEGORY\n';
  output += '─'.repeat(60) + '\n';
  for (const [category, hours] of Object.entries(data.byCategory).sort((a, b) => b[1] - a[1])) {
    output += `  ${category.padEnd(30)} ${hours.toFixed(2).padStart(8)} hours\n`;
  }

  // By project
  output += '\n' + '─'.repeat(60) + '\n';
  output += 'BY PROJECT\n';
  output += '─'.repeat(60) + '\n';
  for (const [project, hours] of Object.entries(data.byProject).sort((a, b) => b[1] - a[1])) {
    output += `  ${project.padEnd(30)} ${hours.toFixed(2).padStart(8)} hours\n`;
  }

  // By date
  output += '\n' + '─'.repeat(60) + '\n';
  output += 'BY DATE\n';
  output += '─'.repeat(60) + '\n';
  for (const [date, hours] of Object.entries(data.byDate).sort()) {
    output += `  ${date.padEnd(30)} ${hours.toFixed(2).padStart(8)} hours\n`;
  }

  // Detailed entries
  if (detailed) {
    output += '\n' + '─'.repeat(60) + '\n';
    output += 'DETAILED ENTRIES\n';
    output += '─'.repeat(60) + '\n';
    for (const entry of data.entries) {
      output += `  ${entry.date}  ${entry.category.slice(0, 15).padEnd(16)}  ${entry.hours.toFixed(2).padStart(6)} hours`;
      if (entry.project) {
        output += `  [${entry.project}]`;
      }
      if (entry.notes) {
        output += `  "${entry.notes.slice(0, 30)}"`;
      }
      output += '\n';
    }
  }

  output += '\n' + '═'.repeat(60) + '\n';
  return output;
}

// Generate JSON export
function generateJsonExport(data: TeamExportData, detailed: boolean): string {
  const exportData: Record<string, unknown> = {
    period: data.period,
    totalHours: data.totalHours,
    byCategory: data.byCategory,
    byProject: data.byProject,
    byDate: data.byDate,
  };

  if (detailed) {
    exportData.entries = data.entries;
  }

  return JSON.stringify(exportData, null, 2);
}

// Generate HTML report
function generateHtmlReport(data: TeamExportData, detailed: boolean): string {
  const categoryRows = Object.entries(data.byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, hours]) => `<tr><td>${cat}</td><td class="number">${hours.toFixed(2)}</td></tr>`)
    .join('');

  const projectRows = Object.entries(data.byProject)
    .sort((a, b) => b[1] - a[1])
    .map(([proj, hours]) => `<tr><td>${proj}</td><td class="number">${hours.toFixed(2)}</td></tr>`)
    .join('');

  const dateRows = Object.entries(data.byDate)
    .sort()
    .map(([date, hours]) => `<tr><td>${date}</td><td class="number">${hours.toFixed(2)}</td></tr>`)
    .join('');

  let entriesSection = '';
  if (detailed) {
    const entryRows = data.entries
      .map(e => `<tr><td>${e.date}</td><td>${e.category}</td><td>${e.project || ''}</td><td class="number">${e.hours.toFixed(2)}</td><td>${e.notes || ''}</td></tr>`)
      .join('');
    entriesSection = `
    <h2>Detailed Entries</h2>
    <table>
      <thead><tr><th>Date</th><th>Category</th><th>Project</th><th class="number">Hours</th><th>Notes</th></tr></thead>
      <tbody>${entryRows}</tbody>
    </table>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Team Time Report</title>
  <style>
    body { font-family: -apple-system, sans-serif; padding: 40px; max-width: 1000px; margin: 0 auto; }
    h1 { color: #333; border-bottom: 2px solid #61AFEF; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 30px; }
    .header { margin-bottom: 30px; }
    .header p { margin: 5px 0; color: #666; }
    .summary { display: flex; gap: 20px; margin-bottom: 30px; }
    .summary-card { background: #f5f5f5; padding: 20px; border-radius: 8px; flex: 1; }
    .summary-card h3 { margin: 0 0 10px 0; color: #666; font-size: 14px; }
    .summary-card .value { font-size: 24px; font-weight: bold; color: #333; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; }
    .number { text-align: right; }
    .footer { margin-top: 40px; text-align: center; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Team Time Report</h1>
  <div class="header">
    <p><strong>Period:</strong> ${data.period}</p>
  </div>
  <div class="summary">
    <div class="summary-card">
      <h3>Total Hours</h3>
      <div class="value">${data.totalHours.toFixed(2)}</div>
    </div>
    <div class="summary-card">
      <h3>Categories</h3>
      <div class="value">${Object.keys(data.byCategory).length}</div>
    </div>
    <div class="summary-card">
      <h3>Projects</h3>
      <div class="value">${Object.keys(data.byProject).length}</div>
    </div>
  </div>

  <h2>By Category</h2>
  <table>
    <thead><tr><th>Category</th><th class="number">Hours</th></tr></thead>
    <tbody>${categoryRows}</tbody>
  </table>

  <h2>By Project</h2>
  <table>
    <thead><tr><th>Project</th><th class="number">Hours</th></tr></thead>
    <tbody>${projectRows}</tbody>
  </table>

  <h2>By Date</h2>
  <table>
    <thead><tr><th>Date</th><th class="number">Hours</th></tr></thead>
    <tbody>${dateRows}</tbody>
  </table>

  ${entriesSection}

  <div class="footer">Generated by Timer Record</div>
</body>
</html>`;
}

// Team export command
export function teamExportCommand(options: {
  from?: string;
  to?: string;
  format?: string;
  output?: string;
  detailed?: boolean;
}): void {
  const data = generateTeamExportData({
    from: options.from,
    to: options.to,
    detailed: options.detailed,
  });

  if (!data) {
    console.log();
    info('No time entries found in the specified period');
    console.log();
    return;
  }

  const format = options.format || 'text';
  let content: string;
  let ext: string;

  switch (format) {
    case 'json':
      content = generateJsonExport(data, options.detailed || false);
      ext = 'json';
      break;
    case 'html':
      content = generateHtmlReport(data, options.detailed || false);
      ext = 'html';
      break;
    default:
      content = generateTextReport(data, options.detailed || false);
      ext = 'txt';
  }

  if (options.output) {
    writeFileSync(options.output, content);
    console.log();
    success(`Team export saved to ${options.output}`);
    console.log();
  } else {
    console.log();
    if (format === 'json') {
      console.log(content);
    } else if (format === 'html') {
      success('Generated HTML report');
      info('Use -o <file> to save to a file');
    } else {
      console.log(content);
    }
    console.log();
  }
}
