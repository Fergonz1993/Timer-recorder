# Contributing to Timer Record

Thank you for your interest in contributing to Timer Record! This guide will help you get started.

## Development Setup

### Prerequisites

- macOS (required for window detection features)
- Node.js 18+
- npm or yarn

### Installation

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

### Development Workflow

```bash
# Build in watch mode
npm run dev

# Run the CLI
npm run tt <command>

# Run tests
npm test

# Run tests once
npm run test:run

# Run tests with coverage
npm run test:coverage

# Lint
npm run lint
```

## Project Structure

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed architecture documentation.

Key directories:
- `src/cli/commands/` - CLI command implementations
- `src/storage/repositories/` - Database access layer
- `src/categorization/` - App categorization logic
- `tests/` - Test files

## Code Style

### TypeScript

- Use strict TypeScript (`"strict": true`)
- Prefer explicit types over `any`
- Use interfaces for object shapes
- Export types from `src/types/index.ts`

### Naming Conventions

- **Files**: kebab-case (`tracker-service.ts`)
- **Classes**: PascalCase (`TrackerService`)
- **Functions**: camelCase (`getActiveEntry`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_CONFIG`)

### Error Handling

- Use custom error classes from `src/errors/index.ts`
- Provide helpful error messages
- Include context in errors when useful

```typescript
import { CategoryNotFoundError } from '../errors/index.js';

if (!category) {
  throw new CategoryNotFoundError(categoryName);
}
```

## Adding a New Command

1. Create a new file in `src/cli/commands/`:

```typescript
// src/cli/commands/mycommand.ts
import { success, error } from '../utils/format.js';

export function myCommand(options: { flag?: boolean }): void {
  // Implementation
  success('Done!');
}
```

1. Register in `src/cli/index.ts`:

```typescript
import { myCommand } from './commands/mycommand.js';

program
  .command('mycommand')
  .description('Description here')
  .option('-f, --flag', 'Flag description')
  .action((options) => {
    myCommand(options);
  });
```

1. Add tests in `tests/unit/mycommand.test.ts`

## Adding Database Changes

1. Add a new migration in `src/storage/database.ts`:

```typescript
{
  name: '004_my_migration',
  sql: `
    CREATE TABLE IF NOT EXISTS my_table (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL
    );
  `,
},
```

1. Update types in `src/types/index.ts`

1. Add repository functions in `src/storage/repositories/`

## Testing

### Writing Tests

- Place unit tests in `tests/unit/`
- Use descriptive test names
- Test edge cases

```typescript
import { describe, it, expect } from 'vitest';

describe('myFunction', () => {
  it('should handle normal input', () => {
    expect(myFunction('input')).toBe('expected');
  });

  it('should handle edge case', () => {
    expect(myFunction('')).toBe('default');
  });
});
```

### Running Tests

```bash
# Interactive watch mode
npm test

# Single run
npm run test:run

# With coverage
npm run test:coverage
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Add/update tests
5. Ensure tests pass (`npm run test:run`)
6. Ensure build passes (`npm run build`)
7. Commit with a descriptive message
8. Push and create a Pull Request

### Commit Messages

Use clear, descriptive commit messages:

```text
Add goals progress visualization

- Add progress bar rendering
- Show percentage complete
- Color code based on progress
```

### PR Description

Include:
- Summary of changes
- Test plan (how you tested)
- Screenshots for UI changes

## Questions?

- Open an issue for bugs or feature requests
- Check existing issues before creating new ones

Thank you for contributing!
