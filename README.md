# Timer Record

A powerful CLI work time tracker with automatic activity detection for macOS.

```
$ tt today

Today's Summary
Wednesday, December 31, 2025

  Total: 9h 05m

─────────────────────────────────────────────────────────────────────
 Category               Time         %
─────────────────────────────────────────────────────────────────────
   programming          5h 05m       55.9%    ███████████░░░░░░░░░
─────────────────────────────────────────────────────────────────────
   debugging            2h 30m       27.5%    ██████░░░░░░░░░░░░░░
─────────────────────────────────────────────────────────────────────
   testing              1h 30m       16.5%    ███░░░░░░░░░░░░░░░░░
─────────────────────────────────────────────────────────────────────
```

## Features

- **Manual time tracking** - Start/stop timers or log time retroactively
- **Automatic tracking** - Background daemon detects active apps and categorizes time
- **Smart categorization** - Auto-detects VS Code, Xcode, browsers, Slack, and more
- **Beautiful reports** - ASCII charts, progress bars, and hourly heatmaps
- **Export data** - CSV and JSON export for analysis
- **Custom rules** - Define your own app-to-category mappings
- **macOS integration** - Install as a LaunchAgent for auto-start on login

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/timer-record.git
cd timer-record

# Install dependencies
npm install

# Build
npm run build

# Link globally (optional)
npm link
```

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

## Commands

### Timer Commands

```bash
# Start a timer for a category
tt start <category>
tt start programming
tt start programming --notes "Working on auth feature"

# Stop the current timer
tt stop

# Check current status
tt status

# Log time retroactively
tt log -c programming -d 2h
tt log -c debugging -d 30m -a "2pm" -n "Fixed login bug"
```

### Reports

```bash
# Today's breakdown
tt today

# Weekly summary with ASCII chart
tt week
tt week --heatmap  # Show hourly activity heatmap
```

### Export

```bash
# Export to CSV
tt export csv
tt export csv --today
tt export csv --from 2025-01-01 --to 2025-01-31

# Export to JSON
tt export json
tt export json --today
```

### Categories

```bash
# List all categories
tt categories list

# Add a custom category
tt categories add design --color "#FF6B6B" --description "UI/UX work"

# Remove a category
tt categories remove design
```

### Auto-categorization Rules

```bash
# List current rules
tt rules list

# Add a rule for an app
tt rules add --app "Figma" -c design
tt rules add --app "Chrome" --title "Jira" -c project-management

# Show example commands
tt rules examples

# Remove a rule
tt rules remove <id>
```

### Background Daemon

The daemon runs in the background and automatically tracks which apps you use.

```bash
# Start the daemon
tt daemon start

# Check if daemon is running
tt daemon status

# View tracking logs
tt daemon logs
tt daemon logs -n 50  # Last 50 lines

# Stop the daemon
tt daemon stop

# Install as system service (auto-start on login)
tt daemon install

# Remove system service
tt daemon uninstall
```

### Detection

```bash
# See what app/window is currently detected
tt detect

# Output:
# App:       Cursor
# Bundle:    com.todesktop.230313mzl4w4u92
# Window:    timer-record - README.md
# Category:  programming
```

## Default Categories

| Category           | Color | Description                        |
|--------------------|-------|------------------------------------|
| programming        | Blue  | General coding and development     |
| debugging          | Red   | Bug fixing and troubleshooting     |
| testing            | Green | Writing and running tests          |
| code-review        | Purple| PR reviews and reading code        |
| research           | Cyan  | Documentation, Stack Overflow      |
| meetings           | Yellow| Zoom, calendar                     |
| communication      | Orange| Slack, Teams, email                |
| excel-modeling     | Teal  | Excel and financial models         |
| business-logic     | Blue  | Feature development, core logic    |
| presentations      | Pink  | PowerPoint and Keynote             |
| financial-analysis | Green | Analysis work                      |
| data-entry         | Gray  | Manual data entry work             |

## Auto-Detection Patterns

Timer Record automatically recognizes these apps:

| App Type | Examples | Category |
|----------|----------|----------|
| Code Editors | VS Code, Xcode, Cursor, IntelliJ, Sublime | programming |
| Terminals | Terminal, iTerm, Warp, Hyper | programming |
| Terminals (debugging) | gdb, lldb, pdb in title | debugging |
| Terminals (testing) | jest, pytest, mocha in title | testing |
| Spreadsheets | Excel, Numbers, Google Sheets | excel-modeling |
| Communication | Slack, Teams, Discord | communication |
| Meetings | Zoom, Google Meet, FaceTime | meetings |
| Browsers + GitHub PR | Chrome with "Pull Request" | code-review |
| Browsers + Docs | MDN, Stack Overflow | research |

## Data Storage

All data is stored locally in SQLite:

```
~/.local/share/timer-record/timer-record.db
```

Daemon logs are stored at:

```
/tmp/timer-record.log
```

## Requirements

- macOS (uses AppleScript for window detection)
- Node.js 18+
- Accessibility permissions (for window title detection)

### Granting Accessibility Permissions

The daemon needs accessibility permissions to detect window titles:

1. Open **System Settings** > **Privacy & Security** > **Accessibility**
2. Click the **+** button
3. Add your Terminal app (Terminal, iTerm, Warp, etc.)
4. Toggle it **ON**

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Watch mode
npm run dev

# Run the CLI
npm run tt <command>
```

## License

MIT
