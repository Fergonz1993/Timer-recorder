# Repository Guidelines

## Project Structure & Module Organization

- `src/` contains the TypeScript source. Key areas: `src/cli/commands/` for CLI commands, `src/core/` for timer logic, `src/storage/` for SQLite repositories and migrations, `src/categorization/` for app rules, and `src/daemon/` + `src/detection/` for background tracking.
- `tests/` holds Vitest suites (mostly `tests/unit/*.test.ts`).
- `docs/` includes `ARCHITECTURE.md` and API docs; start there for system context.
- `menubar/` is the Electron menubar app.
- `dist/` and `coverage/` are build artifacts; do not edit by hand.

## Build, Test, and Development Commands

```bash
npm install           # install dependencies
npm run build         # compile TypeScript to dist/
npm run dev           # watch mode compiler
npm run tt status     # run CLI via node dist/bin/tt.js
npm test              # Vitest watch mode
npm run test:run      # one-shot test run
npm run test:coverage # coverage report
npm run lint          # ESLint on src/
```

Menubar app:

```bash
npm run menubar:install
npm run menubar
```

## Coding Style & Naming Conventions

- TypeScript is strict; avoid `any` and prefer explicit types and interfaces.
- Use ESM import specifiers with `.js` extensions in TS (e.g., `import { foo } from './foo.js'`).
- Naming: files `kebab-case.ts`, classes `PascalCase`, functions `camelCase`, constants `UPPER_SNAKE_CASE`.
- Reuse custom errors from `src/errors/index.ts` and keep messages actionable.

## Testing Guidelines

- Framework: Vitest. Place unit tests in `tests/unit/` with `*.test.ts` naming.
- Cover edge cases and regressions for timer state and database writes.
- Run `npm run test:run` and `npm run build` before opening a PR.

## Commit & Pull Request Guidelines

- Commit messages are imperative, sentence-style (e.g., `Add Windows support`, `Fix ML predictions`).
- Prefer small, scoped commits; include a short body when the change is multi-step.
- PRs should include a concise summary, a test plan, and screenshots for UI/menubar changes.

## Configuration & Data Notes

- Local data lives in `~/.local/share/timer-record/` with config in `~/.config/timer-record/`.
- Avoid committing local databases or config; use `docs/ARCHITECTURE.md` for schema context.

## Agent-Specific Instructions

- If you are an automated agent, follow `CLAUDE_AGENT_INSTRUCTIONS.md` and `app_spec.txt` for required workflow and validation steps.
