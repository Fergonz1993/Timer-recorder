# ⏱️ Timer Record

[![npm version](https://img.shields.io/npm/v/timer-record.svg)](https://www.npmjs.com/package/timer-record)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey.svg)]()

**A powerful CLI work time tracker with automatic activity detection, ML predictions, team sync, and enterprise encryption.**

```
$ tt today

Today's Summary
Saturday, January 4, 2026

  Total: 6h 45m

─────────────────────────────────────────────────────────────────────
 Category               Time         %
─────────────────────────────────────────────────────────────────────
 ● programming          4h 30m       66.7%    █████████████░░░░░░░
─────────────────────────────────────────────────────────────────────
   debugging            1h 15m       18.5%    ████░░░░░░░░░░░░░░░░
─────────────────────────────────────────────────────────────────────
   meetings             1h 00m       14.8%    ███░░░░░░░░░░░░░░░░░
─────────────────────────────────────────────────────────────────────
```

## 🚀 Quick Install

```bash
# Install globally via npm
npm install -g timer-record

# Or with yarn
yarn global add timer-record

# Start tracking immediately
tt start programming
```

## ✨ Features

### Core Tracking
- **Manual & Automatic Tracking** - Start/stop timers or let the daemon detect apps
- **Smart Categorization** - Auto-detects VS Code, Xcode, browsers, Slack, and 50+ apps
- **Projects & Tags** - Organize with projects, clients, and custom tags
- **Pomodoro Timer** - Built-in technique with customizable work/break durations
- **Goals** - Daily/weekly/monthly targets with progress tracking
- **Undo/Redo** - Full history with unlimited undo

### 📊 Analytics & ML Predictions
- **Beautiful Reports** - ASCII charts, progress bars, hourly heatmaps
- **ML Predictions** - Predict work hours, peak productivity, and patterns
- **Insights** - Burnout detection, weak days, productivity trends
- **Compare Periods** - Week-over-week, month-over-month analysis

### 💼 Business & Team
- **Invoicing** - Create professional HTML/PDF invoices from tracked time
- **Team Dashboard** - Member management, leaderboards, comparisons
- **GitHub/Jira Integration** - Log time directly to issues
- **Webhooks** - Trigger external services on timer events

### 🔒 Privacy & Security
- **100% Local** - All data stored locally in SQLite
- **E2E Encryption** - AES-256-GCM encryption for enterprise
- **Privacy Lockdown** - Disable all network features
- **Encrypted Backups** - Secure your data with password protection

### 🔄 Multi-Device Sync
- **File-based Sync** - Works with iCloud, Dropbox, Google Drive
- **Conflict Resolution** - Automatic merge with newest/local/remote strategies
- **Server Sync** - Self-hosted server option (coming soon)

### 🖥️ Desktop Integration
- **Menubar App** - Electron widget with global shortcuts
- **Desktop Notifications** - Goals, Pomodoro, idle reminders
- **Shell Completions** - bash, zsh, fish support
- **System Service** - Auto-start on login

## 📖 Quick Start

```bash
# Start a timer
tt start programming

# Check status
tt status

# Stop the timer
tt stop

# View today's summary
tt today

# View weekly report
tt week

# Start Pomodoro
tt pomodoro start

# Enable auto-tracking daemon
tt daemon start
```

## 🔧 Commands Overview

### Timer
```bash
tt start <category>              # Start tracking
tt stop                          # Stop current timer
tt status                        # Show current status
tt log -c coding -d 2h           # Log time retroactively
```

### Reports
```bash
tt today                         # Today's breakdown
tt week                          # Weekly summary
tt month                         # Monthly summary
tt stats                         # Overall statistics
```

### ML Predictions
```bash
tt predict today                 # Today's predictions
tt predict week                  # Weekly forecast
tt predict insights              # Productivity insights
tt predict patterns              # Work patterns heatmap
tt predict suggest               # Smart category suggestion
```

### Projects & Tags
```bash
tt project list                  # List projects
tt project add "my-app"          # Create project
tt tag list                      # List tags
tt tag add frontend              # Create tag
```

### Goals
```bash
tt goals set programming 4h/day  # Set daily goal
tt goals progress                # View progress
```

### Pomodoro
```bash
tt pomodoro start                # Start session
tt pomo status                   # Check timer
tt pomo pause                    # Pause
tt pomo skip                     # Skip break
```

### Team
```bash
tt team init "My Team"           # Create team
tt team add "John" --email j@x   # Add member
tt team summary                  # Team stats
tt team leaderboard              # Rankings
tt team export --format html     # Export report
```

### Integrations
```bash
tt integrate status              # Show integrations

# GitHub
tt integrate github config --token <token> --owner <owner> --repo <repo>
tt integrate github issues       # List issues
tt integrate github log 123 --hours 2  # Log time to issue

# Jira
tt integrate jira config --domain x.atlassian.net --email x --token <token>
tt integrate jira issues         # List issues
tt integrate jira log PROJ-123 --hours 1.5  # Log worklog
```

### Sync
```bash
tt sync enable --path ~/Dropbox/TimerRecord  # Enable sync
tt sync now                      # Sync immediately
tt sync status                   # Check sync status
```

### Encryption
```bash
tt encrypt init                  # Initialize with password
tt encrypt unlock                # Unlock encryption
tt encrypt lock                  # Lock (clear key)
tt encrypt change-password       # Change password
```

### Privacy
```bash
tt privacy audit                 # See what data exists
tt privacy lockdown enable       # Disable network features
tt privacy backup --password x   # Encrypted backup
tt privacy wipe --confirm        # Delete all data
```

### Dashboard
```bash
tt dashboard start               # Start web dashboard
tt dashboard open                # Open in browser (localhost:3000)
```

### Daemon
```bash
tt daemon start                  # Start auto-tracking
tt daemon install                # Auto-start on login
tt daemon logs                   # View logs
```

## 🖥️ Platform Support

| Platform | Detection | Notifications | Service |
|----------|-----------|---------------|---------|
| **macOS** | Accessibility API | Native | launchd |
| **Linux** | xdotool/X11 | notify-send | systemd |
| **Windows** | PowerShell | Toast | Task Scheduler |

### macOS Setup
```bash
# Grant Accessibility permissions
System Settings > Privacy & Security > Accessibility > Add Terminal
```

### Linux Setup
```bash
sudo apt install xdotool libnotify-bin  # Ubuntu/Debian
sudo dnf install xdotool libnotify      # Fedora
```

## 📊 Default Categories

| Category | Description |
|----------|-------------|
| `programming` | Coding & development |
| `debugging` | Bug fixing |
| `testing` | Writing/running tests |
| `code-review` | PR reviews |
| `research` | Documentation, learning |
| `meetings` | Zoom, calendar |
| `communication` | Slack, email |

## 🗂️ Data Storage

```
~/.local/share/timer-record/
├── timer-record.db      # SQLite database
└── team-config.json     # Team configuration

~/.config/timer-record/
└── config.json          # User settings
```

## 🔌 REST API

When the dashboard is running, a REST API is available:

```bash
GET /api/status          # Server status
GET /api/data            # Dashboard data (timer, today, week)
```

See [docs/api.md](docs/api.md) for full API documentation.

## 🛠️ Development

```bash
# Clone
git clone https://github.com/Fergonz1993/Timer-recorder.git
cd Timer-recorder

# Install
npm install

# Build
npm run build

# Watch mode
npm run dev

# Run tests
npm test

# Run CLI
npm run tt status
```

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

## 📄 License

MIT © [Fernando Gonzalez](https://github.com/Fergonz1993)

---

<p align="center">
  Made with ❤️ for developers who value their time
</p>
