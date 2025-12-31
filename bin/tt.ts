#!/usr/bin/env node

import { createCLI } from '../src/cli/index.js';
import { getDatabase, closeDatabase } from '../src/storage/database.js';

// Initialize database on startup
getDatabase();

// Create and run CLI
const program = createCLI();

// Handle graceful shutdown
process.on('exit', () => {
  closeDatabase();
});

process.on('SIGINT', () => {
  closeDatabase();
  process.exit(0);
});

// Run the CLI
program.parse();
