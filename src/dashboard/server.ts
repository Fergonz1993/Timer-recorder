import { createServer, IncomingMessage, ServerResponse } from 'http';
import { getDatabase } from '../storage/database.js';
import { getTimerStatus, getActiveDuration } from '../core/timer.js';
import { getTodayTotalSeconds, getCategorySummary } from '../storage/repositories/entries.js';
import { getAllCategories } from '../storage/repositories/categories.js';

let server: ReturnType<typeof createServer> | null = null;
let serverPort: number | null = null;

interface DashboardData {
  activeTimer: {
    running: boolean;
    category: string | null;
    duration: number;
    startTime: string | null;
  };
  today: {
    totalSeconds: number;
    categories: { name: string; seconds: number; color: string | null }[];
  };
  week: {
    days: { date: string; seconds: number }[];
  };
}

// Get dashboard data
function getDashboardData(): DashboardData {
  const active = getTimerStatus();
  const todayTotal = getTodayTotalSeconds();
  const todayDate = new Date().toISOString().split('T')[0];
  const categorySummary = getCategorySummary(todayDate, todayDate);

  // Get week data
  const weekDays: { date: string; seconds: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const db = getDatabase();
    const result = db.prepare(`
      SELECT COALESCE(SUM(duration_seconds), 0) as total
      FROM time_entries
      WHERE date(start_time) = ?
    `).get(dateStr) as { total: number };
    weekDays.push({ date: dateStr, seconds: result.total });
  }

  return {
    activeTimer: {
      running: !!active,
      category: active?.category_name || null,
      duration: active ? getActiveDuration() : 0,
      startTime: active?.start_time || null,
    },
    today: {
      totalSeconds: todayTotal + (active ? getActiveDuration() : 0),
      categories: categorySummary.map(c => ({
        name: c.category,
        seconds: c.total_seconds,
        color: c.color,
      })),
    },
    week: {
      days: weekDays,
    },
  };
}

// Generate HTML page
function generateHTML(data: DashboardData): string {
  const formatDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const categoriesHTML = data.today.categories.map(c => `
    <div class="category-row">
      <span class="category-name" style="color: ${c.color || '#888'}">${c.name}</span>
      <span class="category-time">${formatDuration(c.seconds)}</span>
    </div>
  `).join('');

  const weekChartHTML = data.week.days.map(d => {
    const maxSeconds = Math.max(...data.week.days.map(x => x.seconds), 1);
    const height = Math.max(5, (d.seconds / maxSeconds) * 100);
    const dayName = new Date(d.date).toLocaleDateString('en', { weekday: 'short' });
    return `
      <div class="chart-bar-container">
        <div class="chart-bar" style="height: ${height}%" title="${formatDuration(d.seconds)}"></div>
        <span class="chart-label">${dayName}</span>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Timer Record Dashboard</title>
  <meta http-equiv="refresh" content="30">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e;
      color: #eee;
      padding: 20px;
      min-height: 100vh;
    }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { margin-bottom: 20px; color: #61AFEF; }
    .card {
      background: #16213e;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .card h2 {
      font-size: 14px;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 15px;
    }
    .timer-status {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .timer-status .indicator {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: ${data.activeTimer.running ? '#98C379' : '#666'};
      animation: ${data.activeTimer.running ? 'pulse 2s infinite' : 'none'};
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .timer-time {
      font-size: 48px;
      font-weight: 700;
      color: #fff;
    }
    .timer-category {
      font-size: 18px;
      color: #61AFEF;
    }
    .today-total {
      font-size: 36px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 15px;
    }
    .category-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #2a2a4a;
    }
    .category-row:last-child { border-bottom: none; }
    .chart-container {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      height: 120px;
      padding-top: 20px;
    }
    .chart-bar-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex: 1;
    }
    .chart-bar {
      width: 30px;
      background: linear-gradient(to top, #61AFEF, #98C379);
      border-radius: 4px 4px 0 0;
      min-height: 5px;
    }
    .chart-label {
      font-size: 12px;
      color: #888;
      margin-top: 8px;
    }
    .footer {
      text-align: center;
      color: #666;
      font-size: 12px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>⏱️ Timer Record</h1>

    <div class="card">
      <h2>Current Timer</h2>
      <div class="timer-status">
        <div class="indicator"></div>
        <div>
          <div class="timer-time">${formatDuration(data.activeTimer.duration)}</div>
          <div class="timer-category">${data.activeTimer.running ? data.activeTimer.category || 'uncategorized' : 'Not tracking'}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Today</h2>
      <div class="today-total">${formatDuration(data.today.totalSeconds)}</div>
      ${categoriesHTML || '<p style="color: #666">No time tracked today</p>'}
    </div>

    <div class="card">
      <h2>This Week</h2>
      <div class="chart-container">
        ${weekChartHTML}
      </div>
    </div>

    <p class="footer">Auto-refreshes every 30 seconds</p>
  </div>
</body>
</html>`;
}

// Handle HTTP requests
function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  const url = req.url || '/';

  if (url === '/' || url === '/index.html') {
    const data = getDashboardData();
    const html = generateHTML(data);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  } else if (url === '/api/data') {
    const data = getDashboardData();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  } else if (url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'running', port: serverPort }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
}

// Start the dashboard server
export function startDashboard(port: number = 3000): { port: number } {
  if (server) {
    return { port: serverPort! };
  }

  server = createServer(handleRequest);
  server.listen(port, () => {
    serverPort = port;
  });

  return { port };
}

// Stop the dashboard server
export function stopDashboard(): boolean {
  if (server) {
    server.close();
    server = null;
    serverPort = null;
    return true;
  }
  return false;
}

// Check if dashboard is running
export function isDashboardRunning(): { running: boolean; port: number | null } {
  return {
    running: server !== null,
    port: serverPort,
  };
}
