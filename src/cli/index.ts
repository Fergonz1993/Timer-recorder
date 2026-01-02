import { Command } from 'commander';
import { startCommand } from './commands/start.js';
import { stopCommand } from './commands/stop.js';
import { statusCommand } from './commands/status.js';
import { listCategories, addCategory, removeCategory } from './commands/categories.js';
import { todayCommand } from './commands/today.js';
import { weekCommand } from './commands/week.js';
import { exportCsv, exportJson } from './commands/export.js';
import { logCommand } from './commands/log.js';
import { rulesList, rulesAdd, rulesRemove, rulesExamples } from './commands/rules.js';
import {
  daemonStart,
  daemonStop,
  daemonStatus,
  daemonLogs,
  daemonInstall,
  daemonUninstall,
  daemonStatusFull,
} from './commands/daemon.js';
import { detectCommand, detectWatch } from './commands/detect.js';
import {
  configListCommand,
  configGetCommand,
  configSetCommand,
  configResetCommand,
  configPathCommand,
} from './commands/config.js';
import {
  listCommand,
  editCommand,
  deleteCommand,
} from './commands/entries.js';
import {
  monthCommand,
  compareCommand,
  statsCommand,
} from './commands/analytics.js';
import {
  goalsSetCommand,
  goalsListCommand,
  goalsProgressCommand,
  goalsRemoveCommand,
} from './commands/goals.js';

export function createCLI(): Command {
  const program = new Command();

  program
    .name('tt')
    .description('CLI work time tracker with auto-detection')
    .version('1.0.0');

  // Start timer
  program
    .command('start [category]')
    .description('Start a timer for a category')
    .option('-n, --notes <notes>', 'Add notes to the entry')
    .action((category, options) => {
      startCommand(category, options);
    });

  // Stop timer
  program
    .command('stop')
    .description('Stop the current timer')
    .action(() => {
      stopCommand();
    });

  // Log manual time entry
  program
    .command('log')
    .description('Log a manual time entry')
    .requiredOption('-c, --category <category>', 'Category name')
    .requiredOption('-d, --duration <duration>', 'Duration (e.g., "2h", "30m", "1h30m")')
    .option('-a, --at <time>', 'Start time (e.g., "2pm", "yesterday 14:30")')
    .option('-n, --notes <notes>', 'Add notes')
    .action((options) => {
      logCommand(options);
    });

  // List recent entries
  program
    .command('list')
    .description('Show recent time entries with IDs')
    .option('-n, --limit <number>', 'Number of entries to show', '20')
    .action((options) => {
      listCommand(options);
    });

  // Edit entry
  program
    .command('edit <id>')
    .description('Edit a time entry')
    .option('-c, --category <category>', 'Change category')
    .option('-d, --duration <duration>', 'Change duration (e.g., "2h", "30m")')
    .option('-s, --start <time>', 'Change start time')
    .option('-e, --end <time>', 'Change end time')
    .option('-n, --notes <notes>', 'Change notes')
    .action((id, options) => {
      editCommand(id, options);
    });

  // Delete entry
  program
    .command('delete <id>')
    .description('Delete a time entry')
    .option('-f, --force', 'Skip confirmation')
    .action((id, options) => {
      deleteCommand(id, options);
    });

  // Status
  program
    .command('status')
    .description('Show current tracking status')
    .action(() => {
      statusCommand();
    });

  // Today's summary
  program
    .command('today')
    .description("Show today's time breakdown")
    .action(() => {
      todayCommand();
    });

  // Weekly summary
  program
    .command('week')
    .description('Show weekly summary with charts')
    .option('-p, --previous <weeks>', 'Show previous week (1 = last week)', '0')
    .action((options) => {
      weekCommand({ weeksAgo: parseInt(options.previous, 10) });
    });

  // Monthly summary
  program
    .command('month')
    .description('Show monthly summary with charts')
    .option('-p, --previous <months>', 'Show previous month (1 = last month)', '0')
    .action((options) => {
      monthCommand({ monthsAgo: parseInt(options.previous, 10) });
    });

  // Period comparison
  program
    .command('compare')
    .description('Compare time periods (week-over-week or month-over-month)')
    .option('-t, --type <type>', 'Comparison type (week/month)', 'week')
    .option('-n, --periods <number>', 'Number of periods to compare', '4')
    .action((options) => {
      compareCommand(options);
    });

  // Overall statistics
  program
    .command('stats')
    .description('Show overall statistics (averages, streaks, productivity)')
    .action(() => {
      statsCommand();
    });

  // Goals management
  const goals = program
    .command('goals')
    .description('Manage time tracking goals');

  goals
    .command('set <category> <target>')
    .description('Set a goal (e.g., "programming 40h/week")')
    .action((category, target) => {
      goalsSetCommand(category, target);
    });

  goals
    .command('list')
    .description('List all goals')
    .action(() => {
      goalsListCommand();
    });

  goals
    .command('progress')
    .description('Show progress toward goals')
    .action(() => {
      goalsProgressCommand();
    });

  goals
    .command('remove <category>')
    .description('Remove a goal')
    .option('-p, --period <period>', 'Goal period (daily/weekly/monthly)', 'weekly')
    .action((category, options) => {
      goalsRemoveCommand(category, options);
    });

  // Default: show progress if no subcommand
  goals.action(() => {
    goalsProgressCommand();
  });

  // Export commands
  const exportCmd = program
    .command('export')
    .description('Export time entries');

  exportCmd
    .command('csv')
    .description('Export to CSV format')
    .option('--from <date>', 'Start date (YYYY-MM-DD)')
    .option('--to <date>', 'End date (YYYY-MM-DD)')
    .option('--week', 'Export current week')
    .option('--today', 'Export today only')
    .option('-o, --output <file>', 'Output file path')
    .action((options) => {
      exportCsv(options);
    });

  exportCmd
    .command('json')
    .description('Export to JSON format')
    .option('--from <date>', 'Start date (YYYY-MM-DD)')
    .option('--to <date>', 'End date (YYYY-MM-DD)')
    .option('--week', 'Export current week')
    .option('--today', 'Export today only')
    .option('-o, --output <file>', 'Output file path')
    .action((options) => {
      exportJson(options);
    });

  // Categories management
  const categories = program
    .command('categories')
    .description('Manage categories');

  categories
    .command('list')
    .description('List all categories')
    .action(() => {
      listCategories();
    });

  categories
    .command('add <name>')
    .description('Add a new category')
    .option('-c, --color <color>', 'Hex color code (e.g., #61AFEF)')
    .option('-d, --description <description>', 'Category description')
    .option('-u, --unproductive', 'Mark as unproductive')
    .action((name, options) => {
      addCategory(name, options);
    });

  categories
    .command('remove <name>')
    .description('Remove a category')
    .action((name) => {
      removeCategory(name);
    });

  // Default: show categories if no subcommand
  categories.action(() => {
    listCategories();
  });

  // Rules management
  const rules = program
    .command('rules')
    .description('Manage auto-categorization rules');

  rules
    .command('list')
    .description('List all custom rules')
    .action(() => {
      rulesList();
    });

  rules
    .command('add')
    .description('Add a new categorization rule')
    .requiredOption('-c, --category <category>', 'Category to assign')
    .option('-a, --app <pattern>', 'App name pattern')
    .option('-b, --bundle <id>', 'App bundle ID')
    .option('-w, --window <pattern>', 'Window title pattern')
    .option('-p, --priority <number>', 'Rule priority (higher = checked first)')
    .action((options) => {
      rulesAdd(options);
    });

  rules
    .command('remove <id>')
    .description('Remove a rule by ID')
    .action((id) => {
      rulesRemove(id);
    });

  rules
    .command('examples')
    .description('Show example rule commands')
    .action(() => {
      rulesExamples();
    });

  // Default: show rules list if no subcommand
  rules.action(() => {
    rulesList();
  });

  // Daemon management
  const daemon = program
    .command('daemon')
    .description('Control background auto-tracking daemon');

  daemon
    .command('start')
    .description('Start the background tracker')
    .action(() => {
      daemonStart();
    });

  daemon
    .command('stop')
    .description('Stop the background tracker')
    .action(() => {
      daemonStop();
    });

  daemon
    .command('status')
    .description('Check daemon status')
    .action(() => {
      daemonStatus();
    });

  daemon
    .command('logs')
    .description('Show recent daemon logs')
    .option('-n, --lines <number>', 'Number of lines to show', '20')
    .action((options) => {
      daemonLogs(parseInt(options.lines, 10));
    });

  daemon
    .command('install')
    .description('Install as system service (auto-start on login)')
    .action(() => {
      daemonInstall();
    });

  daemon
    .command('uninstall')
    .description('Remove system service')
    .action(() => {
      daemonUninstall();
    });

  // Default: show daemon status if no subcommand
  daemon.action(() => {
    daemonStatusFull();
  });

  // Configuration management
  const config = program
    .command('config')
    .description('Manage configuration settings');

  config
    .command('list')
    .description('Show all configuration values')
    .action(() => {
      configListCommand();
    });

  config
    .command('get <key>')
    .description('Get a configuration value')
    .action((key) => {
      configGetCommand(key);
    });

  config
    .command('set <key> <value>')
    .description('Set a configuration value')
    .action((key, value) => {
      configSetCommand(key, value);
    });

  config
    .command('reset')
    .description('Reset configuration to defaults')
    .action(() => {
      configResetCommand();
    });

  config
    .command('path')
    .description('Show configuration file path')
    .action(() => {
      configPathCommand();
    });

  // Default: show config list if no subcommand
  config.action(() => {
    configListCommand();
  });

  // Detection debug command
  program
    .command('detect')
    .description('Show current detected app and category')
    .option('-w, --watch', 'Continuously watch for changes')
    .action((options) => {
      if (options.watch) {
        detectWatch();
      } else {
        detectCommand();
      }
    });

  // Default action: show status
  program.action(() => {
    statusCommand();
  });

  return program;
}
