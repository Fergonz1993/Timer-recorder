#!/usr/bin/env node

import { getTracker } from './tracker-service.js';
import { closeDatabase } from '../storage/database.js';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { getSocketPath } from '../config/paths.js';

// PID file for daemon management
const PID_FILE = '/tmp/timer-record.pid';

function writePidFile(): void {
  writeFileSync(PID_FILE, process.pid.toString());
}

function removePidFile(): void {
  try {
    if (existsSync(PID_FILE)) {
      unlinkSync(PID_FILE);
    }
  } catch {
    // Ignore
  }
}

// Graceful shutdown
function shutdown(signal: string): void {
  console.log(`\nReceived ${signal}, shutting down...`);
  const tracker = getTracker();
  tracker.stop();
  closeDatabase();
  removePidFile();
  process.exit(0);
}

// Main daemon function
function main(): void {
  console.log('Timer Record Daemon');
  console.log('==================');

  // Write PID file
  writePidFile();

  // Set up signal handlers
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('exit', removePidFile);

  // Start the tracker
  const tracker = getTracker();
  const started = tracker.start();

  if (!started) {
    console.error('Failed to start tracker');
    removePidFile();
    process.exit(1);
  }

  console.log('Daemon running. Press Ctrl+C to stop.');
  console.log(`PID: ${process.pid}`);
  console.log(`PID file: ${PID_FILE}`);
}

main();
