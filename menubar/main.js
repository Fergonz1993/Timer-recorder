const { app, nativeImage, Tray, Menu, shell, ipcMain, globalShortcut, Notification } = require('electron');
const { menubar } = require('menubar');
const path = require('path');
const Database = require('better-sqlite3');
const os = require('os');
const { exec } = require('child_process');

// Database path
const dataDir = process.platform === 'darwin'
  ? path.join(os.homedir(), '.local', 'share', 'timer-record')
  : process.platform === 'win32'
    ? path.join(process.env.APPDATA || '', 'timer-record')
    : path.join(os.homedir(), '.local', 'share', 'timer-record');

const dbPath = path.join(dataDir, 'timer-record.db');

let db = null;
let mb = null;
let updateInterval = null;

function getDatabase() {
  if (!db) {
    try {
      db = new Database(dbPath, { readonly: true });
    } catch (err) {
      console.error('Failed to open database:', err);
      return null;
    }
  }
  return db;
}

function getActiveTimer() {
  const database = getDatabase();
  if (!database) return null;

  try {
    const entry = database.prepare(`
      SELECT te.*, c.name as category_name, c.color as category_color
      FROM time_entries te
      LEFT JOIN categories c ON te.category_id = c.id
      WHERE te.end_time IS NULL
      ORDER BY te.start_time DESC
      LIMIT 1
    `).get();

    return entry || null;
  } catch (err) {
    console.error('Failed to get active timer:', err);
    return null;
  }
}

function getTodayTotal() {
  const database = getDatabase();
  if (!database) return 0;

  try {
    const today = new Date().toISOString().split('T')[0];
    const result = database.prepare(`
      SELECT COALESCE(SUM(
        CASE
          WHEN end_time IS NULL THEN
            CAST((julianday('now') - julianday(start_time)) * 86400 AS INTEGER)
          ELSE duration_seconds
        END
      ), 0) as total
      FROM time_entries
      WHERE date(start_time) = date(?)
    `).get(today);

    return result?.total || 0;
  } catch (err) {
    console.error('Failed to get today total:', err);
    return 0;
  }
}

function getCategories() {
  const database = getDatabase();
  if (!database) return [];

  try {
    return database.prepare(`
      SELECT id, name, color FROM categories ORDER BY name
    `).all();
  } catch (err) {
    console.error('Failed to get categories:', err);
    return [];
  }
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

// Run CLI command helper
function runTTCommand(command) {
  const ttPath = path.join(__dirname, '..', 'dist', 'bin', 'tt.js');
  return new Promise((resolve, reject) => {
    exec(`node "${ttPath}" ${command}`, (error, stdout, stderr) => {
      if (error) {
        reject(stderr || error.message);
      } else {
        resolve(stdout);
      }
    });
  });
}

// Show notification
function showNotification(title, body) {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
}

// Toggle timer (start/stop)
async function toggleTimer() {
  const activeTimer = getActiveTimer();

  if (activeTimer) {
    // Stop the timer
    try {
      await runTTCommand('stop');
      const duration = formatDuration(
        Math.floor((new Date() - new Date(activeTimer.start_time.replace(' ', 'T') + 'Z')) / 1000)
      );
      showNotification('Timer Stopped', `${activeTimer.category_name}: ${duration}`);
    } catch (err) {
      console.error('Failed to stop timer:', err);
    }
  } else {
    // Start with last used category or default
    const database = getDatabase();
    if (database) {
      try {
        const lastEntry = database.prepare(`
          SELECT c.name as category_name
          FROM time_entries te
          JOIN categories c ON te.category_id = c.id
          ORDER BY te.start_time DESC
          LIMIT 1
        `).get();

        const category = lastEntry?.category_name || 'programming';
        await runTTCommand(`start ${category}`);
        showNotification('Timer Started', `Category: ${category}`);
      } catch (err) {
        console.error('Failed to start timer:', err);
      }
    }
  }

  updateTrayTitle();
}

// Register global shortcuts
function registerShortcuts() {
  // Cmd+Shift+T (macOS) or Ctrl+Shift+T (Windows/Linux) - Toggle timer
  const toggleAccelerator = process.platform === 'darwin' ? 'Command+Shift+T' : 'Control+Shift+T';
  const toggleResult = globalShortcut.register(toggleAccelerator, toggleTimer);
  if (!toggleResult) {
    console.warn('Failed to register toggle shortcut:', toggleAccelerator);
  } else {
    console.log('Registered shortcut:', toggleAccelerator, '- Toggle timer');
  }

  // Cmd+Shift+R (macOS) or Ctrl+Shift+R - Show menubar window
  const showAccelerator = process.platform === 'darwin' ? 'Command+Shift+R' : 'Control+Shift+R';
  const showResult = globalShortcut.register(showAccelerator, () => {
    if (mb && mb.window) {
      if (mb.window.isVisible()) {
        mb.hideWindow();
      } else {
        mb.showWindow();
      }
    }
  });
  if (!showResult) {
    console.warn('Failed to register show shortcut:', showAccelerator);
  } else {
    console.log('Registered shortcut:', showAccelerator, '- Show/hide window');
  }
}

function updateTrayTitle() {
  if (!mb || !mb.tray) return;

  const activeTimer = getActiveTimer();

  if (activeTimer) {
    const startTime = new Date(activeTimer.start_time.replace(' ', 'T') + 'Z');
    const now = new Date();
    const elapsed = Math.floor((now - startTime) / 1000);
    const duration = formatDuration(elapsed);

    mb.tray.setTitle(` ${duration}`);
    mb.tray.setToolTip(`${activeTimer.category_name}: ${duration}`);
  } else {
    mb.tray.setTitle('');
    mb.tray.setToolTip('Timer Record - No active timer');
  }
}

function createTrayIcon() {
  // Create a simple circle icon (16x16)
  const size = 16;
  const canvas = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="6" fill="none" stroke="white" stroke-width="2"/>
      <circle cx="8" cy="8" r="3" fill="white"/>
    </svg>
  `;

  // For now, use a template image approach
  return nativeImage.createFromPath(path.join(__dirname, 'build', 'iconTemplate.png'));
}

app.whenReady().then(() => {
  // Create a simple tray icon if template doesn't exist
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(path.join(__dirname, 'build', 'iconTemplate.png'));
    if (trayIcon.isEmpty()) {
      // Create a simple 16x16 icon programmatically
      trayIcon = nativeImage.createFromBuffer(Buffer.alloc(16 * 16 * 4, 255));
    }
  } catch {
    trayIcon = nativeImage.createFromBuffer(Buffer.alloc(16 * 16 * 4, 255));
  }

  mb = menubar({
    index: `file://${path.join(__dirname, 'index.html')}`,
    icon: trayIcon,
    preloadWindow: true,
    showDockIcon: false,
    browserWindow: {
      width: 320,
      height: 400,
      resizable: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true
      }
    }
  });

  mb.on('ready', () => {
    console.log('Timer Record menubar is ready');

    // Register global shortcuts
    registerShortcuts();

    // Update tray title every second
    updateTrayTitle();
    updateInterval = setInterval(updateTrayTitle, 1000);

    // Right-click context menu
    mb.tray.on('right-click', () => {
      const activeTimer = getActiveTimer();
      const toggleLabel = activeTimer ? 'Stop Timer' : 'Start Timer';
      const toggleShortcut = process.platform === 'darwin' ? 'Cmd+Shift+T' : 'Ctrl+Shift+T';

      const contextMenu = Menu.buildFromTemplate([
        {
          label: `${toggleLabel} (${toggleShortcut})`,
          click: toggleTimer
        },
        { type: 'separator' },
        {
          label: 'Open Dashboard',
          accelerator: process.platform === 'darwin' ? 'Cmd+Shift+D' : 'Ctrl+Shift+D',
          click: () => shell.openExternal('http://localhost:3000')
        },
        { type: 'separator' },
        {
          label: 'Shortcuts',
          submenu: [
            { label: `${toggleShortcut} - Toggle Timer`, enabled: false },
            { label: `${process.platform === 'darwin' ? 'Cmd' : 'Ctrl'}+Shift+R - Show/Hide`, enabled: false }
          ]
        },
        { type: 'separator' },
        {
          label: 'Quit Timer Record',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => app.quit()
        }
      ]);
      mb.tray.popUpContextMenu(contextMenu);
    });
  });

  // IPC handlers
  ipcMain.handle('get-status', () => {
    const activeTimer = getActiveTimer();
    const todayTotal = getTodayTotal();
    const categories = getCategories();

    let elapsed = 0;
    if (activeTimer) {
      const startTime = new Date(activeTimer.start_time.replace(' ', 'T') + 'Z');
      elapsed = Math.floor((new Date() - startTime) / 1000);
    }

    return {
      activeTimer,
      elapsed,
      todayTotal,
      categories
    };
  });

  ipcMain.handle('run-command', async (event, command) => {
    const { exec } = require('child_process');
    const ttPath = path.join(__dirname, '..', 'dist', 'bin', 'tt.js');

    return new Promise((resolve, reject) => {
      exec(`node "${ttPath}" ${command}`, (error, stdout, stderr) => {
        if (error) {
          reject(stderr || error.message);
        } else {
          resolve(stdout);
        }
      });
    });
  });

  ipcMain.handle('open-dashboard', () => {
    shell.openExternal('http://localhost:3000');
  });
});

app.on('window-all-closed', () => {
  // Keep running in menubar
});

app.on('before-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll();

  if (updateInterval) {
    clearInterval(updateInterval);
  }
  if (db) {
    db.close();
  }
});
