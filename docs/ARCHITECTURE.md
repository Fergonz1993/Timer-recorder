# Timer Record Architecture

## Overview

Timer Record is a CLI-based work time tracker for macOS with automatic activity detection. It's built with TypeScript and uses SQLite for local data persistence.

## System Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                         CLI Layer                           │
│  (Commander.js commands, formatting, user interaction)      │
├─────────────────────────────────────────────────────────────┤
│                        Core Layer                           │
│  (Timer logic, categorization, config management)           │
├─────────────────────────────────────────────────────────────┤
│                      Storage Layer                          │
│  (SQLite database, repositories, migrations)                │
├─────────────────────────────────────────────────────────────┤
│                     Detection Layer                         │
│  (macOS AppleScript, idle detection)                        │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```text
src/
├── bin/
│   └── tt.ts                 # CLI entry point
├── cli/
│   ├── commands/             # Individual CLI commands
│   │   ├── analytics.ts      # month, compare, stats
│   │   ├── categories.ts     # category management
│   │   ├── config.ts         # configuration
│   │   ├── daemon.ts         # background tracker
│   │   ├── detect.ts         # detection debug
│   │   ├── entries.ts        # list, edit, delete
│   │   ├── export.ts         # CSV/JSON export
│   │   ├── goals.ts          # goals management
│   │   ├── log.ts            # manual time logging
│   │   ├── rules.ts          # categorization rules
│   │   ├── start.ts          # start timer
│   │   ├── status.ts         # current status
│   │   ├── stop.ts           # stop timer
│   │   ├── today.ts          # daily summary
│   │   └── week.ts           # weekly summary
│   ├── utils/
│   │   ├── error-handler.ts  # CLI error handling
│   │   └── format.ts         # Output formatting
│   └── index.ts              # Command registration
├── config/
│   ├── paths.ts              # XDG-compliant paths
│   └── settings.ts           # Config file management
├── core/
│   └── timer.ts              # Timer business logic
├── categorization/
│   ├── patterns.ts           # Default app patterns
│   └── rules.ts              # Rule matching logic
├── daemon/
│   ├── index.ts              # Daemon entry point
│   ├── launchd.ts            # macOS LaunchAgent
│   └── tracker-service.ts    # Background tracking
├── detection/
│   ├── idle.ts               # Idle time detection
│   └── macos.ts              # AppleScript window detection
├── errors/
│   └── index.ts              # Custom error types
├── storage/
│   ├── database.ts           # SQLite setup & migrations
│   └── repositories/
│       ├── categories.ts     # Category CRUD
│       ├── entries.ts        # Entry queries
│       └── goals.ts          # Goals CRUD
├── types/
│   └── index.ts              # TypeScript interfaces
└── utils/
    └── logger.ts             # Logging utilities
```

## Data Flow

### Manual Time Tracking

```text
User runs "tt start programming"
         │
         ▼
┌─────────────────┐
│   CLI Parser    │ (Commander.js)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Start Command  │ (src/cli/commands/start.ts)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Timer Core     │ (src/core/timer.ts)
│  - Stop active  │
│  - Create entry │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Repository    │ (src/storage/repositories/entries.ts)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    SQLite DB    │ (~/.local/share/timer-record/)
└─────────────────┘
```

### Automatic Detection (Daemon)

```text
┌─────────────────┐
│  Daemon Start   │ (tt daemon start)
└────────┬────────┘
         │
         ▼
┌─────────────────┐     Every 5 seconds
│ Tracker Service │ ◄──────────────────┐
└────────┬────────┘                    │
         │                             │
         ▼                             │
┌─────────────────┐                    │
│ Idle Detection  │ (ioreg HID idle)   │
└────────┬────────┘                    │
         │ Not idle?                   │
         ▼                             │
┌─────────────────┐                    │
│ Window Detection│ (AppleScript)      │
└────────┬────────┘                    │
         │                             │
         ▼                             │
┌─────────────────┐                    │
│ Categorization  │ (pattern matching) │
└────────┬────────┘                    │
         │ Context changed?            │
         ▼                             │
┌─────────────────┐                    │
│ Save Entry      │────────────────────┘
└─────────────────┘
```

## Database Schema

### Tables

### categories
- `id` INTEGER PRIMARY KEY
- `name` TEXT UNIQUE
- `color` TEXT (hex)
- `description` TEXT
- `is_productive` INTEGER (boolean)
- `created_at`, `updated_at` TEXT

### time_entries
- `id` INTEGER PRIMARY KEY
- `category_id` INTEGER (FK)
- `app_name`, `app_bundle_id`, `window_title` TEXT
- `start_time`, `end_time` TEXT
- `duration_seconds` INTEGER
- `is_manual` INTEGER (boolean)
- `notes` TEXT
- `created_at` TEXT

### goals
- `id` INTEGER PRIMARY KEY
- `category_id` INTEGER (FK)
- `target_seconds` INTEGER
- `period` TEXT ('daily', 'weekly', 'monthly')
- `is_active` INTEGER (boolean)
- `created_at`, `updated_at` TEXT

### categorization_rules
- `id` INTEGER PRIMARY KEY
- `app_name_pattern`, `app_bundle_id`, `window_title_pattern` TEXT
- `category_id` INTEGER (FK)
- `priority` INTEGER

### settings
- `key` TEXT PRIMARY KEY
- `value` TEXT

## Configuration

Configuration is stored in `~/.config/timer-record/config.json`:

```json
{
  "pollInterval": 5,
  "idleThreshold": 300,
  "minEntryDuration": 30,
  "defaultCategory": null
}
```

## Key Design Decisions

1. **SQLite over JSON**: Provides ACID transactions, efficient queries, and handles concurrent access (daemon + CLI)

2. **AppleScript for detection**: Native macOS integration without requiring special permissions for basic app detection

3. **Categorization rules with priority**: User-defined rules override built-in patterns

4. **XDG-compliant paths**: Data in `~/.local/share/`, config in `~/.config/`

5. **ESM modules**: Modern JavaScript with native ES modules

6. **Daemon as separate process**: Runs independently, survives terminal closure

## Extension Points

- Add new commands in `src/cli/commands/`
- Add categorization patterns in `src/categorization/patterns.ts`
- Add custom error types in `src/errors/index.ts`
- Add database migrations in `src/storage/database.ts`
