import { writeFileSync, existsSync, readFileSync } from 'fs';
import chalk from 'chalk';
import { getDatabase } from '../../storage/database.js';
import { success, error, info, formatDuration } from '../utils/format.js';
import * as path from 'path';
import * as os from 'os';

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

  // Get date range and validate
  let fromDate: string;
  let toDate: string;

  if (options.from && options.to) {
    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(options.from) || !dateRegex.test(options.to)) {
      throw new Error('Invalid date format. Expected YYYY-MM-DD');
    }
    
    const fromDateObj = new Date(options.from);
    const toDateObj = new Date(options.to);
    
    if (isNaN(fromDateObj.getTime()) || isNaN(toDateObj.getTime())) {
      throw new Error('Invalid date values');
    }
    
    if (fromDateObj > toDateObj) {
      throw new Error('Start date must be before or equal to end date');
    }
    
    fromDate = options.from;
    toDate = options.to;
  } else {
    const weekRange = getCurrentWeekRange();
    fromDate = weekRange.from;
    toDate = weekRange.to;
  }

  // Get entries with error handling
  let entries: {
    date: string;
    category: string;
    project: string | null;
    duration_seconds: number;
    notes: string | null;
  }[];
  
  try {
    entries = db.prepare(`
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
  } catch (err) {
    console.error(`Database query failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    process.exit(1);
  }

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
  let data: TeamExportData | null;

  try {
    data = generateTeamExportData({
      from: options.from,
      to: options.to,
      detailed: options.detailed,
    });
  } catch (err) {
    error(`Failed to generate team export data: ${err instanceof Error ? err.message : 'Unknown error'}`);
    console.log();
    process.exit(1);
  }

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

// ============================================================================
// Team Member Management
// ============================================================================

interface TeamMember {
  id: string;
  name: string;
  email?: string;
  role: 'admin' | 'member';
  joinedAt: string;
  lastActive?: string;
}

interface TeamConfig {
  name: string;
  members: TeamMember[];
  syncPath?: string;
  createdAt: string;
}

function getTeamConfigPath(): string {
  const db = getDatabase();
  const configDir = path.dirname(db.name);
  return path.join(configDir, 'team-config.json');
}

function loadTeamConfig(): TeamConfig | null {
  const configPath = getTeamConfigPath();
  if (!existsSync(configPath)) {
    return null;
  }
  try {
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as TeamConfig;
  } catch {
    return null;
  }
}

function saveTeamConfig(config: TeamConfig): void {
  const configPath = getTeamConfigPath();
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

// Initialize team
export function teamInitCommand(name: string, options: { syncPath?: string }): void {
  console.log();

  const existing = loadTeamConfig();
  if (existing) {
    error(`Team "${existing.name}" already exists. Use 'tt team reset' to start fresh.`);
    console.log();
    return;
  }

  const config: TeamConfig = {
    name,
    members: [{
      id: generateMemberId(),
      name: os.userInfo().username || 'Admin',
      role: 'admin',
      joinedAt: new Date().toISOString(),
    }],
    syncPath: options.syncPath,
    createdAt: new Date().toISOString(),
  };

  saveTeamConfig(config);

  success(`Team "${name}" created!`);
  console.log();
  console.log(`  You are the admin.`);
  if (options.syncPath) {
    console.log(`  Sync path: ${options.syncPath}`);
  }
  console.log();
  console.log(`  Add members with: ${chalk.cyan('tt team add <name> --email <email>')}`);
  console.log();
}

// Add team member
export function teamAddCommand(name: string, options: { email?: string; role?: string }): void {
  console.log();

  const config = loadTeamConfig();
  if (!config) {
    error('No team configured. Run: tt team init <name>');
    console.log();
    return;
  }

  const member: TeamMember = {
    id: generateMemberId(),
    name,
    email: options.email,
    role: options.role === 'admin' ? 'admin' : 'member',
    joinedAt: new Date().toISOString(),
  };

  config.members.push(member);
  saveTeamConfig(config);

  success(`Added ${name} to team "${config.name}"`);
  console.log();
}

// Remove team member
export function teamRemoveCommand(nameOrId: string): void {
  console.log();

  const config = loadTeamConfig();
  if (!config) {
    error('No team configured.');
    console.log();
    return;
  }

  const memberIndex = config.members.findIndex(
    m => m.name.toLowerCase() === nameOrId.toLowerCase() || m.id === nameOrId
  );

  if (memberIndex === -1) {
    error(`Member "${nameOrId}" not found`);
    console.log();
    return;
  }

  const removed = config.members.splice(memberIndex, 1)[0];
  saveTeamConfig(config);

  success(`Removed ${removed.name} from team`);
  console.log();
}

// List team members
export function teamListCommand(): void {
  console.log();

  const config = loadTeamConfig();
  if (!config) {
    info('No team configured.');
    console.log();
    console.log(`  Create a team with: ${chalk.cyan('tt team init <name>')}`);
    console.log();
    return;
  }

  console.log(chalk.bold(`Team: ${config.name}`));
  console.log(chalk.dim(`Created: ${new Date(config.createdAt).toLocaleDateString()}`));
  console.log();

  console.log(chalk.bold('Members:'));
  console.log();

  for (const member of config.members) {
    const roleIcon = member.role === 'admin' ? chalk.yellow('★') : chalk.dim('●');
    const emailPart = member.email ? chalk.dim(` <${member.email}>`) : '';
    console.log(`  ${roleIcon} ${member.name}${emailPart}`);
    console.log(`    ${chalk.dim(`ID: ${member.id.slice(0, 8)}... | Joined: ${new Date(member.joinedAt).toLocaleDateString()}`)}`);
  }

  console.log();
}

// Team summary - show aggregate stats
export function teamSummaryCommand(options: { from?: string; to?: string }): void {
  console.log();

  const config = loadTeamConfig();
  if (!config) {
    info('No team configured.');
    console.log();
    return;
  }

  console.log(chalk.bold(`Team Summary: ${config.name}`));
  console.log();

  // Get data for this user
  const data = generateTeamExportData({
    from: options.from,
    to: options.to,
    detailed: false,
  });

  if (!data) {
    info('No time entries found in the specified period');
    console.log();
    return;
  }

  console.log(`  ${chalk.bold('Period:')}        ${data.period}`);
  console.log(`  ${chalk.bold('Total Hours:')}   ${chalk.cyan(data.totalHours.toFixed(2))}`);
  console.log(`  ${chalk.bold('Team Size:')}     ${config.members.length} members`);
  console.log();

  // Top categories
  console.log(chalk.bold('Top Categories:'));
  const sortedCats = Object.entries(data.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5);
  for (const [cat, hours] of sortedCats) {
    const bar = getBar(hours, data.totalHours);
    console.log(`  ${cat.padEnd(20)} ${bar} ${hours.toFixed(1)}h`);
  }
  console.log();

  // Top projects
  console.log(chalk.bold('Top Projects:'));
  const sortedProjects = Object.entries(data.byProject).sort((a, b) => b[1] - a[1]).slice(0, 5);
  for (const [proj, hours] of sortedProjects) {
    const bar = getBar(hours, data.totalHours);
    console.log(`  ${proj.padEnd(20)} ${bar} ${hours.toFixed(1)}h`);
  }
  console.log();
}

// Team comparison - compare periods
export function teamCompareCommand(options: { periods?: string }): void {
  console.log();

  console.log(chalk.bold('Team Time Comparison'));
  console.log();

  const numPeriods = parseInt(options.periods || '4', 10);

  // Get weekly data for the last N weeks
  const weeks: Array<{ label: string; hours: number }> = [];
  const now = new Date();

  for (let i = 0; i < numPeriods; i++) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (7 * i) - now.getDay() + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const from = weekStart.toISOString().split('T')[0];
    const to = weekEnd.toISOString().split('T')[0];

    const data = generateTeamExportData({ from, to, detailed: false });
    const label = i === 0 ? 'This Week' : i === 1 ? 'Last Week' : `${i} weeks ago`;

    weeks.push({
      label,
      hours: data?.totalHours || 0,
    });
  }

  // Find max for scaling
  const maxHours = Math.max(...weeks.map(w => w.hours), 1);

  // Display
  for (const week of weeks.reverse()) {
    const bar = getBar(week.hours, maxHours, 30);
    console.log(`  ${week.label.padEnd(15)} ${bar} ${week.hours.toFixed(1)}h`);
  }

  // Calculate trend
  if (weeks.length >= 2) {
    const recent = weeks[weeks.length - 1].hours;
    const previous = weeks[weeks.length - 2].hours;
    const change = previous > 0 ? ((recent - previous) / previous) * 100 : 0;

    console.log();
    if (change > 10) {
      console.log(`  ${chalk.green('↑')} ${chalk.green(`${change.toFixed(0)}% increase`)} from last week`);
    } else if (change < -10) {
      console.log(`  ${chalk.red('↓')} ${chalk.red(`${Math.abs(change).toFixed(0)}% decrease`)} from last week`);
    } else {
      console.log(`  ${chalk.dim('→')} ${chalk.dim('Similar to last week')}`);
    }
  }

  console.log();
}

// Team leaderboard (simulated for single user - for actual teams via sync)
export function teamLeaderboardCommand(options: { metric?: string }): void {
  console.log();

  const config = loadTeamConfig();
  if (!config) {
    info('No team configured.');
    console.log();
    return;
  }

  console.log(chalk.bold('Team Leaderboard'));
  console.log(chalk.dim('This week'));
  console.log();

  // For now, just show current user's stats
  // In a full implementation, this would aggregate from sync files

  const weekRange = getCurrentWeekRange();
  const data = generateTeamExportData({
    from: weekRange.from,
    to: weekRange.to,
    detailed: false,
  });

  const username = os.userInfo().username || 'You';
  const hours = data?.totalHours || 0;
  const categories = data ? Object.keys(data.byCategory).length : 0;

  console.log(`  ${chalk.yellow('🥇')} ${username.padEnd(20)} ${hours.toFixed(1)}h  ${categories} categories`);
  console.log();

  if (config.members.length > 1) {
    console.log(chalk.dim('  Other members will appear here when sync is configured.'));
    console.log();
    console.log(`  Set up sync: ${chalk.cyan('tt sync enable --path <folder>')}`);
    console.log();
  }
}

// Team reset
export function teamResetCommand(options: { confirm?: boolean }): void {
  console.log();

  const config = loadTeamConfig();
  if (!config) {
    info('No team configured.');
    console.log();
    return;
  }

  if (!options.confirm) {
    error(`This will delete team "${config.name}" and all member data.`);
    console.log();
    console.log(`  Run with ${chalk.cyan('--confirm')} to proceed.`);
    console.log();
    return;
  }

  const configPath = getTeamConfigPath();
  writeFileSync(configPath, '');
  require('fs').unlinkSync(configPath);

  success(`Team "${config.name}" has been deleted.`);
  console.log();
}

// Helper functions
function generateMemberId(): string {
  return 'tm-' + Math.random().toString(36).substring(2, 15);
}

function getBar(value: number, max: number, width: number = 15): string {
  const filled = Math.round((value / max) * width);
  const empty = width - filled;
  return chalk.cyan('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
}
