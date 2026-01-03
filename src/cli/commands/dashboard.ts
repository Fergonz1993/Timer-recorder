import chalk from 'chalk';
import { startDashboard, stopDashboard, isDashboardRunning } from '../../dashboard/server.js';
import { loadConfig } from '../../config/settings.js';
import { success, error, info, warn } from '../utils/format.js';

// Start dashboard server
export function dashboardStart(options?: { port?: string }): void {
  // Check privacy lockdown
  const config = loadConfig();
  if (config.privacy_lockdown === true || config.dashboard_enabled === false) {
    console.log();
    warn('Dashboard is disabled in privacy lockdown mode');
    console.log(chalk.dim('  Run "tt privacy lockdown disable" to enable dashboard'));
    console.log();
    return;
  }

  const status = isDashboardRunning();
  if (status.running) {
    error('Dashboard already running');
    console.log(chalk.dim(`\nAccess at: http://localhost:${status.port}`));
    return;
  }

  const port = options?.port ? parseInt(options.port, 10) : 3000;
  if (isNaN(port) || port < 1 || port > 65535) {
    error('Invalid port number');
    return;
  }

  try {
    // startDashboard now returns a Promise
    startDashboard(port).then(({ port: actualPort }) => {
      console.log();
      success('Dashboard started');
      console.log();
      console.log(`  URL: ${chalk.cyan(`http://localhost:${actualPort}`)}`);
      console.log();
      info('Stop with: tt dashboard stop');
      console.log();
    }).catch((err) => {
      error(`Failed to start dashboard: ${err instanceof Error ? err.message : 'Unknown error'}`);
      process.exit(1);
    });
  } catch (err) {
    error(`Failed to start dashboard: ${(err as Error).message}`);
    process.exit(1);
  }
}

// Stop dashboard server
export function dashboardStop(): void {
  const stopped = stopDashboard();
  console.log();
  if (stopped) {
    success('Dashboard stopped');
  } else {
    info('Dashboard is not running');
  }
  console.log();
}

// Show dashboard status
export function dashboardStatus(): void {
  const status = isDashboardRunning();

  console.log();
  console.log(chalk.bold('Dashboard Status'));
  console.log();

  if (status.running) {
    console.log(`  Status: ${chalk.green('running')}`);
    console.log(`  URL:    ${chalk.cyan(`http://localhost:${status.port}`)}`);
    console.log();
    info('Stop with: tt dashboard stop');
  } else {
    console.log(`  Status: ${chalk.dim('stopped')}`);
    console.log();
    info('Start with: tt dashboard start');
  }
  console.log();
}

// Open dashboard in browser (just shows URL for now)
export function dashboardOpen(): void {
  // Check privacy lockdown
  const config = loadConfig();
  if (config.privacy_lockdown === true || config.dashboard_enabled === false) {
    console.log();
    warn('Dashboard is disabled in privacy lockdown mode');
    console.log(chalk.dim('  Run "tt privacy lockdown disable" to enable dashboard'));
    console.log();
    return;
  }

  const status = isDashboardRunning();

  if (!status.running) {
    // Auto-start if not running
    try {
      startDashboard(3000);
      // Re-query status to get the actual port after startup
      const newStatus = isDashboardRunning();
      if (!newStatus.running) {
        error('Failed to start dashboard server');
        process.exit(1);
      }
      const port = newStatus.port || 3000;
      console.log();
      info(`Open in browser: http://localhost:${port}`);
      console.log();
      return;
    } catch (err) {
      error(`Failed to start dashboard: ${err instanceof Error ? err.message : 'Unknown error'}`);
      process.exit(1);
    }
  }

  const port = status.port || 3000;
  console.log();
  info(`Open in browser: http://localhost:${port}`);
  console.log();
}
