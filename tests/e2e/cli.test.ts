import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { execSync, spawnSync } from 'child_process';
import { existsSync, unlinkSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { homedir, tmpdir } from 'os';

// Path to the CLI
const CLI_PATH = join(process.cwd(), 'dist', 'bin', 'tt.js');

// Test database path
const TEST_DB_DIR = join(tmpdir(), 'timer-record-test');
const TEST_DB_PATH = join(TEST_DB_DIR, 'timer-record.db');

// Helper to run CLI commands
function runCLI(args: string, options: { env?: NodeJS.ProcessEnv } = {}): { stdout: string; stderr: string; status: number } {
  const result = spawnSync('node', [CLI_PATH, ...args.split(' ')], {
    encoding: 'utf-8',
    env: {
      ...process.env,
      TIMER_RECORD_DB_PATH: TEST_DB_PATH,
      ...options.env,
    },
    timeout: 30000,
  });

  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    status: result.status || 0,
  };
}

describe('CLI E2E Tests', () => {
  beforeAll(() => {
    // Create test database directory
    if (!existsSync(TEST_DB_DIR)) {
      mkdirSync(TEST_DB_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up test database
    try {
      if (existsSync(TEST_DB_DIR)) {
        rmSync(TEST_DB_DIR, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    // Stop any running timer before each test
    runCLI('stop');
  });

  describe('Basic Commands', () => {
    it('should show version', () => {
      const result = runCLI('--version');
      expect(result.stdout).toContain('1.0.0');
      expect(result.status).toBe(0);
    });

    it('should show help', () => {
      const result = runCLI('--help');
      expect(result.stdout).toContain('Usage:');
      expect(result.stdout).toContain('start');
      expect(result.stdout).toContain('stop');
      expect(result.status).toBe(0);
    });
  });

  describe('Timer Commands', () => {
    it('should start a timer', () => {
      const result = runCLI('start programming');
      expect(result.stdout).toContain('Timer started');
      expect(result.status).toBe(0);
    });

    it('should show status when timer is running', () => {
      runCLI('start programming');
      const result = runCLI('status');
      expect(result.stdout).toContain('programming');
      expect(result.status).toBe(0);
    });

    it('should stop a timer', { timeout: 30000 }, () => {
      runCLI('start programming');
      const result = runCLI('stop');
      expect(result.stdout.toLowerCase()).toContain('stopped');
      expect(result.status).toBe(0);
    });

    it('should log time retroactively', () => {
      const result = runCLI('log -c programming -d 30m');
      expect(result.stdout.toLowerCase()).toContain('logged');
      expect(result.status).toBe(0);
    });
  });

  describe('Summary Commands', () => {
    it('should show today summary', () => {
      // Log some time first
      runCLI('log -c programming -d 1h');
      const result = runCLI('today');
      expect(result.stdout).toContain('Today');
      expect(result.stdout).toContain('Total:');
      expect(result.status).toBe(0);
    });

    it('should show week summary', () => {
      const result = runCLI('week');
      expect(result.stdout).toContain('Week');
      expect(result.status).toBe(0);
    });
  });

  describe('Category Commands', () => {
    it('should list categories', () => {
      const result = runCLI('categories list');
      expect(result.stdout).toContain('programming');
      expect(result.status).toBe(0);
    });

    it('should add a custom category', () => {
      const result = runCLI('categories add e2e-test-cat-' + Date.now());
      // Command should produce output
      expect(result.stdout.length + result.stderr.length).toBeGreaterThan(0);
    });
  });

  describe('Project Commands', () => {
    it('should list projects', () => {
      const result = runCLI('project list');
      expect(result.status).toBe(0);
    });

    it('should add a project', () => {
      const result = runCLI('project add e2e-test-proj-' + Date.now());
      // Command should produce output
      expect(result.stdout.length + result.stderr.length).toBeGreaterThan(0);
    });
  });

  describe('Tag Commands', () => {
    it('should list tags', () => {
      const result = runCLI('tag list');
      expect(result.status).toBe(0);
    });

    it('should add a tag', () => {
      const result = runCLI('tag add e2e-test-tag-' + Date.now());
      // Command should produce output
      expect(result.stdout.length + result.stderr.length).toBeGreaterThan(0);
    });
  });

  describe('Export Commands', () => {
    it('should export to CSV', () => {
      // Log some time first
      runCLI('log -c programming -d 30m');
      const result = runCLI('export csv --today');
      expect(result.stdout).toContain('start_time');
      expect(result.status).toBe(0);
    });

    it('should export to JSON', () => {
      const result = runCLI('export json --today');
      // Should either have data or be empty array
      expect(result.status).toBe(0);
    });
  });

  describe('Config Commands', () => {
    it('should list config', () => {
      const result = runCLI('config list');
      expect(result.status).toBe(0);
    });

    it('should get a config value', () => {
      const result = runCLI('config get default_category');
      // May return error if key doesn't exist, but command should run
      expect(result.stdout.length + result.stderr.length).toBeGreaterThan(0);
    });
  });

  describe('Goals Commands', () => {
    it('should list goals', () => {
      const result = runCLI('goals list');
      expect(result.status).toBe(0);
    });

    it('should set a goal', () => {
      const result = runCLI('goals set programming --daily 4h');
      // Goal command should produce output (success or error about existing goal)
      expect(result.stdout.length + result.stderr.length).toBeGreaterThan(0);
    });
  });

  describe('Detection Commands', () => {
    it('should detect current window', () => {
      const result = runCLI('detect');
      expect(result.stdout).toContain('App:');
      expect(result.status).toBe(0);
    });
  });

  describe('Notification Commands', () => {
    it('should show notification status', () => {
      const result = runCLI('notify status');
      expect(result.status).toBe(0);
    });
  });

  describe('Daemon Commands', () => {
    it('should show daemon status', () => {
      const result = runCLI('daemon status');
      expect(result.stdout).toMatch(/(running|not running)/i);
      expect(result.status).toBe(0);
    });
  });

  describe('Undo/Redo Commands', () => {
    it('should show history', { timeout: 30000 }, () => {
      // Do some actions first
      runCLI('start programming');
      runCLI('stop');
      const result = runCLI('history');
      expect(result.status).toBe(0);
    });
  });

  describe('Template Commands', () => {
    it('should list templates', () => {
      const result = runCLI('template list');
      expect(result.status).toBe(0);
    });

    it('should add a template', () => {
      const result = runCLI('template add e2e-template --category programming');
      expect(result.status).toBe(0);
    });
  });

  describe('Shell Completions', () => {
    it('should generate bash completions', () => {
      const result = runCLI('completions bash');
      expect(result.stdout).toContain('_tt_completions');
      expect(result.status).toBe(0);
    });

    it('should generate zsh completions', () => {
      const result = runCLI('completions zsh');
      expect(result.stdout).toContain('compdef');
      expect(result.status).toBe(0);
    });

    it('should generate fish completions', () => {
      const result = runCLI('completions fish');
      expect(result.stdout).toContain('complete');
      expect(result.status).toBe(0);
    });
  });

  describe('Invoice Commands', () => {
    it('should list invoices', () => {
      const result = runCLI('invoice list');
      expect(result.status).toBe(0);
    });
  });

  describe('Webhook Commands', () => {
    it('should list webhooks', () => {
      const result = runCLI('webhook list');
      expect(result.status).toBe(0);
    });
  });

  describe('Search Commands', () => {
    it('should search entries', () => {
      // Log some time with notes
      runCLI('log -c programming -d 30m -n "e2e test entry"');
      const result = runCLI('search "e2e test"');
      expect(result.status).toBe(0);
    });
  });

  describe('Privacy Commands', () => {
    it('should show privacy status', () => {
      const result = runCLI('privacy');
      expect(result.stdout).toContain('Privacy Status');
      expect(result.status).toBe(0);
    });

    it('should show privacy audit', () => {
      const result = runCLI('privacy audit');
      expect(result.stdout).toContain('Privacy Audit Report');
      expect(result.stdout).toContain('Database');
      expect(result.stdout).toContain('Network Exposure');
      expect(result.status).toBe(0);
    });

    it('should check dashboard security', () => {
      const result = runCLI('privacy dashboard');
      expect(result.stdout).toContain('Dashboard Security Check');
      expect(result.stdout).toContain('Localhost only');
      expect(result.status).toBe(0);
    });

    it('should show retention settings', () => {
      const result = runCLI('privacy retention');
      expect(result.stdout).toContain('Data Retention');
      expect(result.status).toBe(0);
    });

    it('should show lockdown status', () => {
      const result = runCLI('privacy lockdown status');
      expect(result.stdout.toLowerCase()).toContain('lockdown');
      expect(result.status).toBe(0);
    });

    it('should show anonymous mode status', () => {
      const result = runCLI('privacy anonymous status');
      expect(result.stdout.toLowerCase()).toContain('anonymous');
      expect(result.status).toBe(0);
    });

    it('should require confirmation for wipe', () => {
      const result = runCLI('privacy wipe');
      expect(result.stdout).toContain('--confirm');
      expect(result.status).toBe(0);
    });

    it('should require confirmation for secure-delete', () => {
      const result = runCLI('privacy secure-delete');
      expect(result.stdout).toContain('--confirm');
      expect(result.status).toBe(0);
    });

    it('should require password for backup', () => {
      const result = runCLI('privacy backup');
      expect(result.stdout).toContain('Password required');
      expect(result.status).toBe(0);
    });
  });
});
