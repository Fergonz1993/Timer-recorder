# Timer Record

A powerful CLI work time tracker with automatic activity detection, goals, invoicing, and more.

**Supports macOS and Linux** | **410 Features** | **100% Test Coverage**

```
$ tt today

Today's Summary
Friday, January 2, 2026

  Total: 9h 05m

─────────────────────────────────────────────────────────────────────
 Category               Time         %
─────────────────────────────────────────────────────────────────────
 ● programming          5h 05m       55.9%    ███████████░░░░░░░░░
─────────────────────────────────────────────────────────────────────
   debugging            2h 30m       27.5%    ██████░░░░░░░░░░░░░░
─────────────────────────────────────────────────────────────────────
   testing              1h 30m       16.5%    ███░░░░░░░░░░░░░░░░░
─────────────────────────────────────────────────────────────────────
```

## Features

### Core Tracking
- **Manual time tracking** - Start/stop timers or log time retroactively
- **Automatic tracking** - Background daemon detects active apps and categorizes time
- **Smart categorization** - Auto-detects VS Code, Xcode, browsers, Slack, and more
- **Projects & Tags** - Organize time by projects with tag filtering
- **Search** - Full-text search across all entries

### Productivity
- **Pomodoro Timer** - Built-in Pomodoro technique with customizable durations
- **Goals** - Set daily/weekly/monthly time targets per category
- **Focus Mode** - Blocks distractions with Do Not Disturb integration
- **Templates** - Save and reuse common timer configurations
- **Undo/Redo** - Full history with unlimited undo/redo

### Reporting & Export
- **Beautiful reports** - ASCII charts, progress bars, and hourly heatmaps
- **Export data** - CSV and JSON export for analysis
- **Team Export** - Export formatted reports (text, JSON, HTML)
- **Web Dashboard** - Real-time dashboard at localhost:3000
- **Compare periods** - Compare productivity across different time ranges

### Business
- **Invoices** - Create, manage, and export invoices from tracked time
- **Webhooks** - Trigger external services on timer events
- **Desktop Notifications** - Get notified on goal completion, Pomodoro breaks

### Platform Support
- **macOS** - Accessibility API, launchd, native notifications
- **Linux** - X11/xdotool, systemd, notify-send
- **Windows** - PowerShell detection, Task Scheduler, toast notifications
- **Shell Completions** - bash, zsh, fish

## Installation

```bash
# Clone the repository
git clone https://github.com/Fergonz1993/Timer-recorder.git
cd Timer-recorder

# Install dependencies
npm install

# Build
npm run build

# Link globally (optional)
npm link
```

### Linux Requirements

```bash
# Install xdotool for window detection
sudo apt install xdotool        # Ubuntu/Debian
sudo dnf install xdotool        # Fedora
sudo pacman -S xdotool          # Arch

# Install notify-send for notifications (usually pre-installed)
sudo apt install libnotify-bin  # Ubuntu/Debian
```

### Windows Requirements

- Windows 10 or later
- PowerShell (included with Windows)
- Node.js 18+ installed and in PATH

Window detection uses PowerShell to query the active window. No additional software required.

### macOS Requirements

Grant Accessibility permissions:
1. Open **System Settings** > **Privacy & Security** > **Accessibility**
2. Add your Terminal app (Terminal, iTerm, Warp, etc.)
3. Toggle it **ON**

## Quick Start

```bash
# Start tracking time manually
tt start programming

# Check status
tt status

# Stop the timer
tt stop

# View today's summary
tt today

# Or let the daemon track automatically
tt daemon start
```

## Commands Reference

### Timer Commands

```bash
# Start a timer
tt start <category>
tt start programming --project "my-app" --tags "frontend,react"
tt start coding --notes "Working on auth feature"

# Stop the current timer
tt stop

# Check current status
tt status

# Log time retroactively
tt log -c programming -d 2h
tt log -c debugging -d 30m -a "2pm" -n "Fixed login bug"

# Add notes to current timer
tt note "Switched to refactoring"
tt note "Fixed bug" --entry 123  # Add to specific entry
```

### Reports

```bash
# Today's breakdown
tt today
tt today --project myproject
tt today --tag frontend

# Weekly summary
tt week
tt week --heatmap  # Show hourly activity heatmap

# Monthly summary
tt month

# Compare periods
tt compare --period week  # Compare this week vs last week

# Statistics
tt stats
tt stats --category programming
```

### Projects

```bash
# List projects
tt project list

# Add a project
tt project add "my-app" --description "Main application"

# Set default project
tt project default my-app

# Archive a project
tt project archive old-project

# View project details
tt project show my-app
```

### Tags

```bash
# List tags
tt tag list

# Add a tag
tt tag add frontend --color "#61DAFB"

# Attach tags to entry
tt tag attach 123 frontend,react

# View tag summary
tt tag summary frontend
```

### Goals

```bash
# Set a goal
tt goals set programming --daily 4h
tt goals set coding --weekly 20h
tt goals set learning --monthly 40h

# View goal progress
tt goals list
tt goals progress

# Remove a goal
tt goals remove programming --daily
```

### Pomodoro Timer

```bash
# Start a pomodoro session
tt pomodoro start
tt pomo start programming  # With category

# Check pomodoro status
tt pomo status

# Pause/resume
tt pomo pause
tt pomo resume

# Skip break
tt pomo skip

# Configure durations
tt pomo config --work 25 --break 5 --long-break 15
```

### Focus Mode

```bash
# Start focus mode (enables DND)
tt focus start
tt focus start --duration 2h

# Check focus status
tt focus status

# End focus mode
tt focus end

# Configure focus settings
tt focus config --block-notifications true
```

### Templates

```bash
# List templates
tt template list

# Create a template
tt template add morning-coding --category programming --project work --tags "focus"

# Use a template
tt template use morning-coding

# Set as favorite
tt template favorite morning-coding

# Edit a template
tt template edit morning-coding --notes "Deep work session"
```

### Export

```bash
# Export to CSV
tt export csv
tt export csv --today
tt export csv --from 2025-01-01 --to 2025-01-31

# Export to JSON
tt export json
tt export json --project my-app
```

### Invoices

```bash
# Create an invoice
tt invoice create --project my-app --from 2025-01-01 --to 2025-01-31 --rate 150

# List invoices
tt invoice list

# Show invoice details
tt invoice show INV-001

# Export invoice
tt invoice export INV-001 --format json

# Delete invoice
tt invoice delete INV-001
```

### Team Export

```bash
# Export team report
tt team export --from 2025-01-01 --to 2025-01-31

# Different formats
tt team export --format json
tt team export --format html
```

### Webhooks

```bash
# List webhooks
tt webhook list

# Add a webhook
tt webhook add "Slack Notify" https://hooks.slack.com/... --events timer.start,timer.stop

# View webhook logs
tt webhook logs
tt webhook logs --limit 50

# Delete a webhook
tt webhook delete 1
```

Webhook events:
- `timer.start` - When a timer starts
- `timer.stop` - When a timer stops
- `goal.reached` - When a goal is achieved

### Notifications

```bash
# Check notification status
tt notify status

# Enable/disable notifications
tt notify enable
tt notify disable

# Send test notification
tt notify test

# Configure notifications
tt notify config --sound true --goals true --pomodoro true
```

### Web Dashboard

```bash
# Start the dashboard
tt dashboard start

# Open in browser
tt dashboard open  # Opens http://localhost:3000

# Check status
tt dashboard status

# Stop the dashboard
tt dashboard stop
```

### Background Daemon

```bash
# Start the daemon
tt daemon start

# Check if daemon is running
tt daemon status

# View tracking logs
tt daemon logs
tt daemon logs -n 50

# Stop the daemon
tt daemon stop

# Install as system service (auto-start on login)
tt daemon install   # Uses launchd on macOS, systemd on Linux

# Remove system service
tt daemon uninstall
```

### Detection

```bash
# See what app/window is currently detected
tt detect

# Watch mode (continuous monitoring)
tt detect --watch
```

### Categories & Rules

```bash
# List categories
tt categories list

# Add a category
tt categories add design --color "#FF6B6B" --description "UI/UX work"

# List auto-categorization rules
tt rules list

# Add a rule
tt rules add --app "Figma" -c design
tt rules add --app "Chrome" --title "Jira" -c project-management

# Show examples
tt rules examples
```

### Configuration

```bash
# List all settings
tt config list

# Get a setting
tt config get default_category

# Set a setting
tt config set default_category programming
tt config set pomodoro_work_minutes 30

# Reset to defaults
tt config reset

# Show config file path
tt config path
```

### Shell Completions

```bash
# Generate completions
tt completions bash > ~/.bash_completion.d/tt
tt completions zsh > ~/.zsh/completions/_tt
tt completions fish > ~/.config/fish/completions/tt.fish

# Install completions (interactive)
tt completions install
```

### Undo/Redo

```bash
# Undo last action
tt undo

# Redo last undone action
tt redo

# View action history
tt history
tt history --limit 20
```

### Search

```bash
# Search entries
tt search "bug fix"
tt search "auth" --category programming
tt search "meeting" --from 2025-01-01
```

## Default Categories

| Category           | Color  | Description                    |
|--------------------|--------|--------------------------------|
| programming        | Blue   | General coding and development |
| debugging          | Red    | Bug fixing and troubleshooting |
| testing            | Green  | Writing and running tests      |
| code-review        | Purple | PR reviews and reading code    |
| research           | Cyan   | Documentation, Stack Overflow  |
| meetings           | Yellow | Zoom, calendar                 |
| communication      | Orange | Slack, Teams, email            |
| excel-modeling     | Teal   | Excel and financial models     |

## Auto-Detection Patterns

| App Type           | Examples                              | Category      |
|--------------------|---------------------------------------|---------------|
| Code Editors       | VS Code, Xcode, Cursor, IntelliJ      | programming   |
| Terminals          | Terminal, iTerm, Warp, Hyper          | programming   |
| Terminals (debug)  | gdb, lldb, pdb in title               | debugging     |
| Terminals (test)   | jest, pytest, mocha in title          | testing       |
| Spreadsheets       | Excel, Numbers, Google Sheets         | excel-modeling|
| Communication      | Slack, Teams, Discord                 | communication |
| Meetings           | Zoom, Google Meet, FaceTime           | meetings      |
| Browsers + GitHub  | Chrome with "Pull Request"            | code-review   |
| Browsers + Docs    | MDN, Stack Overflow                   | research      |

## Privacy & Security

Timer Record is designed to be **100% local and private**. No data is ever sent to external servers by default.

### Privacy Audit

```bash
# See what data exists and where
tt privacy audit

# Check overall privacy status
tt privacy
```

### Privacy Controls

```bash
# Enable privacy lockdown (disables all network features)
tt privacy lockdown enable

# Enable anonymous mode (don't store app/window names)
tt privacy anonymous enable

# Set data retention (auto-delete old entries)
tt privacy retention --days 90
tt privacy retention --cleanup  # Run cleanup now
```

### Data Export & Backup

```bash
# Export all your data (GDPR-style)
tt privacy export

# Create encrypted backup
tt privacy backup --password "your-secret-password"

# Restore from encrypted backup
tt privacy restore backup.encrypted --password "your-secret-password"
```

### Secure Deletion

```bash
# Securely delete database (overwrites before deletion)
tt privacy secure-delete --confirm

# Complete data wipe (removes everything)
tt privacy wipe --confirm
tt privacy wipe --confirm --keep-config  # Preserve settings
```

### Security Features

- **Localhost-only dashboard** - Web dashboard binds to 127.0.0.1
- **No external resources** - Dashboard uses inline CSS, no external scripts/fonts
- **No telemetry** - Zero tracking or analytics
- **Encrypted backups** - AES-256-GCM encryption with scrypt key derivation
- **Secure deletion** - Multi-pass overwrite before file deletion

## Data Storage

All data is stored locally in SQLite:
```
~/.local/share/timer-record/timer-record.db
```

Configuration:
```
~/.config/timer-record/config.json
```

Daemon logs:
```
/tmp/timer-record.log
```

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Watch mode
npm run dev

# Run tests
npm test

# Run the CLI
node dist/bin/tt.js <command>
```

## Tech Stack

- **TypeScript** - Type-safe development
- **Node.js** - Runtime environment
- **SQLite** (better-sqlite3) - Local database
- **Commander.js** - CLI framework
- **Chalk** - Terminal styling
- **cli-table3** - ASCII tables

## License

MIT

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
