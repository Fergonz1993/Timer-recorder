import { getActiveWindow, checkAccessibilityPermission } from '../detection/macos.js';
import { getIdleTime } from '../detection/idle.js';
import { categorize, getCategoryIdByName } from '../categorization/rules.js';
import { createEntry, getActiveEntry, stopActiveEntry } from '../storage/repositories/entries.js';
import { getDatabase } from '../storage/database.js';
import { loadConfig, DEFAULT_CONFIG } from '../config/settings.js';
import type { WindowInfo, ActiveSession, Config } from '../types/index.js';

export type TrackerConfig = Pick<Config, 'pollInterval' | 'idleThreshold' | 'minEntryDuration'>;

export class TrackerService {
  private config: TrackerConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastWindowInfo: WindowInfo | null = null;
  private currentEntryId: number | null = null;

  constructor(config: Partial<TrackerConfig> = {}) {
    // Load config from file, then apply any overrides
    const fileConfig = loadConfig();
    this.config = {
      pollInterval: config.pollInterval ?? fileConfig.pollInterval ?? DEFAULT_CONFIG.pollInterval,
      idleThreshold: config.idleThreshold ?? fileConfig.idleThreshold ?? DEFAULT_CONFIG.idleThreshold,
      minEntryDuration: config.minEntryDuration ?? fileConfig.minEntryDuration ?? DEFAULT_CONFIG.minEntryDuration,
    };
  }

  // Start the tracking service
  start(): boolean {
    if (this.isRunning) {
      console.log('Tracker already running');
      return false;
    }

    // Check accessibility permission
    if (!checkAccessibilityPermission()) {
      console.error('Accessibility permission not granted');
      return false;
    }

    // Initialize database
    getDatabase();

    this.isRunning = true;
    console.log(`Tracker started (polling every ${this.config.pollInterval}s)`);

    // Initial tick
    this.tick();

    // Start polling loop
    this.intervalId = setInterval(() => {
      this.tick();
    }, this.config.pollInterval * 1000);

    return true;
  }

  // Stop the tracking service
  stop(): void {
    if (!this.isRunning) {
      console.log('Tracker not running');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Finalize current entry
    this.finalizeCurrentEntry();

    this.isRunning = false;
    console.log('Tracker stopped');
  }

  // Main tick function
  private tick(): void {
    try {
      // Check idle time
      const idleTime = getIdleTime();
      if (idleTime > this.config.idleThreshold) {
        // User is idle - finalize current entry
        if (this.currentEntryId) {
          this.finalizeCurrentEntry();
        }
        return;
      }

      // Get current window info
      const windowInfo = getActiveWindow();

      // Check if context changed
      if (this.isSameContext(windowInfo)) {
        return; // Same context, continue current entry
      }

      // Context changed - finalize old entry and start new one
      this.finalizeCurrentEntry();
      this.startNewEntry(windowInfo);
    } catch (error) {
      console.error('Tick error:', error);
    }
  }

  // Check if window info is same context as current
  private isSameContext(info: WindowInfo): boolean {
    if (!this.lastWindowInfo) return false;

    // Same app is considered same context
    // (could be made more granular with window title)
    return (
      this.lastWindowInfo.appName === info.appName &&
      this.lastWindowInfo.appBundleId === info.appBundleId
    );
  }

  // Start a new tracking entry
  private startNewEntry(info: WindowInfo): void {
    // Categorize the window
    const categoryName = categorize(info);
    const categoryId = categoryName ? getCategoryIdByName(categoryName) : null;

    const entry = createEntry({
      categoryId,
      appName: info.appName,
      appBundleId: info.appBundleId,
      windowTitle: info.windowTitle,
      isManual: false,
    });

    this.currentEntryId = entry.id;
    this.lastWindowInfo = info;

    console.log(
      `[${new Date().toLocaleTimeString()}] Tracking: ${info.appName} → ${categoryName || 'uncategorized'}`
    );
  }

  // Finalize current entry
  private finalizeCurrentEntry(): void {
    if (!this.currentEntryId) return;

    const entry = stopActiveEntry();

    if (entry && entry.duration_seconds !== null) {
      // Delete if too short
      if (entry.duration_seconds < this.config.minEntryDuration) {
        const db = getDatabase();
        db.prepare('DELETE FROM time_entries WHERE id = ?').run(entry.id);
        console.log(`Discarded short entry (${entry.duration_seconds}s)`);
      }
    }

    this.currentEntryId = null;
    this.lastWindowInfo = null;
  }

  // Get current status
  getStatus(): {
    running: boolean;
    currentEntry: ActiveSession | null;
    config: TrackerConfig;
  } {
    const active = this.isRunning ? getActiveEntry() || null : null;
    return {
      running: this.isRunning,
      currentEntry: active,
      config: this.config,
    };
  }
}

// Singleton instance for daemon
let trackerInstance: TrackerService | null = null;

export function getTracker(config?: Partial<TrackerConfig>): TrackerService {
  if (!trackerInstance) {
    trackerInstance = new TrackerService(config);
  }
  return trackerInstance;
}
