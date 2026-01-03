# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Timer Record (`tt`) is a CLI work time tracker with automatic activity detection, goals, invoicing, and privacy features. Supports macOS, Linux, and Windows.

## Common Commands

```bash
# Build TypeScript
npm run build

# Watch mode for development
npm run dev

# Run CLI
node dist/bin/tt.js <command>
npm run tt <command>

# Run all tests
npm test

# Run tests once (no watch)
npm run test:run

# Run tests with coverage
npm run test:coverage

# Run a single test file
npx vitest run tests/unit/format.test.ts

# Run tests matching a pattern
npx vitest run -t "format duration"
```

## Architecture

### Directory Structure

- `src/cli/` - CLI commands using Commander.js. Each command file exports action handlers.
- `src/cli/index.ts` - Main CLI entrypoint, registers all commands with Commander.js
- `src/core/` - Business logic (timer, notifications, undo system)
- `src/storage/` - SQLite database layer using better-sqlite3
  - `database.ts` - Connection management and migrations
  - `repositories/` - Data access for each entity (entries, categories, goals, etc.)
- `src/detection/` - Platform-specific window detection (macOS, Linux, Windows)
- `src/daemon/` - Background auto-tracking service with platform-specific installers
- `src/categorization/` - Auto-categorization rules and pattern matching
- `src/types/index.ts` - TypeScript interfaces for all entities
- `src/config/` - Settings and path management

### Data Flow

1. CLI commands in `src/cli/commands/` receive user input
2. Commands call core functions (e.g., `startTimer()` in `src/core/timer.ts`)
3. Core functions interact with repositories in `src/storage/repositories/`
4. Repositories use `getDatabase()` from `src/storage/database.ts` for SQLite access
5. Webhooks are triggered asynchronously for timer events

### Database

SQLite database stored at `~/.local/share/timer-record/timer-record.db`. Schema is managed via migrations in `src/storage/database.ts`. Key tables:
- `time_entries` - Timer sessions with start/end times
- `categories` - Work categories (programming, debugging, etc.)
- `projects` - Project organization with client and billing info
- `tags` / `entry_tags` - Many-to-many tagging system
- `goals` - Time tracking targets (daily/weekly/monthly)
- `pomodoro_sessions` - Pomodoro timer state

### Platform Detection

Detection modules in `src/detection/` use platform APIs to get active window info:
- macOS: AppleScript via Accessibility API
- Linux: xdotool / X11
- Windows: PowerShell

## Testing

Tests use Vitest. Setup file at `tests/setup.ts` creates isolated test databases.

- Unit tests: `tests/unit/`
- E2E tests: `tests/e2e/` - Runs actual CLI commands

## Key Patterns

- All database operations go through repository functions, not direct SQL
- Timer start/stop push to undo stack via `pushUndoAction()`
- Webhooks fire asynchronously and log internally (never block main flow)
- Privacy lockdown mode disables all network features (webhooks, dashboard)
- Dashboard binds to localhost only for security
