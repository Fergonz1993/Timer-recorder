import { Command } from 'commander';
import chalk from 'chalk';
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
  configEditCommand,
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
import {
  listProjects,
  addProject,
  removeProject,
  setDefault,
  clearDefault,
  showProject,
  editProject,
  listClients,
} from './commands/projects.js';
import {
  listTags,
  addTag,
  removeTag,
  editTag,
  attachTag,
  detachTag,
  showEntryTags,
  showTagSummary,
} from './commands/tags.js';
import { noteCommand } from './commands/note.js';
import { searchCommand } from './commands/search.js';
import {
  pomodoroStart,
  pomodoroStatus,
  pomodoroPause,
  pomodoroResume,
  pomodoroNext,
  pomodoroStop,
  pomodoroSkip,
  pomodoroConfig,
} from './commands/pomodoro.js';
import {
  notificationsStatus,
  notificationsEnable,
  notificationsDisable,
  notificationsConfigure,
  notificationsTest,
} from './commands/notifications.js';
import {
  focusStart,
  focusStatus,
  focusEnd,
  focusConfig,
} from './commands/focus.js';
import {
  listTemplates,
  addTemplate,
  removeTemplate,
  useTemplate,
  favoriteTemplate,
  editTemplate,
  showTemplate,
} from './commands/templates.js';
import {
  dashboardStart,
  dashboardStop,
  dashboardStatus,
  dashboardOpen,
} from './commands/dashboard.js';
import {
  undoCommand,
  redoCommand,
  undoHistoryCommand,
  undoClearCommand,
} from './commands/undo.js';
import { completionsCommand, completionsInstallCommand } from './commands/completions.js';
import { importJson, importCsv, importHelp } from './commands/import.js';
import {
  invoiceCommand,
  invoicePreview,
  invoiceCreateCommand,
  invoiceListCommand,
  invoiceShowCommand,
  invoiceExportCommand,
  invoiceDeleteCommand,
} from './commands/invoice.js';
import { scoreCommand, scoreTodayCommand, scoreWeekCommand } from './commands/score.js';
import { teamExportCommand } from './commands/team.js';
import {
  webhooksListCommand,
  webhooksAddCommand,
  webhooksDeleteCommand,
  webhooksLogsCommand,
} from './commands/webhooks.js';

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
    .option('-p, --project <project>', 'Assign to a project')
    .option('-t, --tags <tags>', 'Add tags (comma-separated)')
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
    .option('-p, --project <project>', 'Assign to a project')
    .option('-t, --tags <tags>', 'Add tags (comma-separated)')
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

  // Add note to timer
  program
    .command('note <text>')
    .description('Add note to active timer or specific entry')
    .option('-e, --entry <id>', 'Add note to specific entry by ID')
    .action((text, options) => {
      noteCommand(text, options);
    });

  // Search entries
  program
    .command('search <query>')
    .description('Search entries by note content')
    .option('-n, --limit <number>', 'Maximum results to show', '20')
    .action((query, options) => {
      searchCommand(query, options);
    });

  // Today's summary
  program
    .command('today')
    .description("Show today's time breakdown")
    .option('-p, --project <project>', 'Filter by project')
    .option('--tag <tag>', 'Filter by tag')
    .option('--tags <tags>', 'Filter by tags (comma-separated)')
    .action((options) => {
      todayCommand(options);
    });

  // Weekly summary
  program
    .command('week')
    .description('Show weekly summary with charts')
    .option('--previous <weeks>', 'Show previous week (1 = last week)', '0')
    .option('-p, --project <project>', 'Filter by project')
    .option('--tag <tag>', 'Filter by tag')
    .option('--tags <tags>', 'Filter by tags (comma-separated)')
    .action((options) => {
      weekCommand(options);
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

  // Projects management
  const projects = program
    .command('project')
    .alias('projects')
    .description('Manage projects');

  projects
    .command('list')
    .description('List all projects')
    .option('-a, --all', 'Include archived projects')
    .option('--client <client>', 'Filter by client')
    .action((options) => {
      listProjects(options);
    });

  projects
    .command('add <name>')
    .description('Add a new project')
    .option('--client <client>', 'Client name')
    .option('-c, --color <color>', 'Hex color code (e.g., #61AFEF)')
    .option('-d, --description <description>', 'Project description')
    .option('-r, --rate <rate>', 'Hourly rate')
    .option('-b, --billable', 'Mark as billable')
    .action((name, options) => {
      addProject(name, options);
    });

  projects
    .command('remove <name>')
    .description('Archive or delete a project')
    .option('-f, --force', 'Permanently delete')
    .action((name, options) => {
      removeProject(name, options);
    });

  projects
    .command('show <name>')
    .description('Show project details')
    .action((name) => {
      showProject(name);
    });

  projects
    .command('edit <name>')
    .description('Edit a project')
    .option('--rename <name>', 'Rename project')
    .option('--client <client>', 'Change client')
    .option('-c, --color <color>', 'Change color')
    .option('-d, --description <description>', 'Change description')
    .option('-r, --rate <rate>', 'Change hourly rate')
    .option('-b, --billable', 'Mark as billable')
    .option('--not-billable', 'Mark as not billable')
    .action((name, options) => {
      editProject(name, options);
    });

  projects
    .command('default [name]')
    .description('Set or clear default project')
    .action((name) => {
      if (name) {
        setDefault(name);
      } else {
        clearDefault();
      }
    });

  projects
    .command('clients')
    .description('List all clients')
    .action(() => {
      listClients();
    });

  // Default: show projects list if no subcommand
  projects.action(() => {
    listProjects();
  });

  // Tags management
  const tags = program
    .command('tag')
    .alias('tags')
    .description('Manage tags');

  tags
    .command('list')
    .description('List all tags')
    .option('-u, --usage', 'Show usage counts')
    .action((options) => {
      listTags(options);
    });

  tags
    .command('add <name>')
    .description('Add a new tag')
    .option('-c, --color <color>', 'Hex color code (e.g., #61AFEF)')
    .action((name, options) => {
      addTag(name, options);
    });

  tags
    .command('remove <name>')
    .description('Remove a tag')
    .action((name) => {
      removeTag(name);
    });

  tags
    .command('edit <name>')
    .description('Edit a tag')
    .option('--rename <name>', 'Rename tag')
    .option('-c, --color <color>', 'Change color')
    .action((name, options) => {
      editTag(name, options);
    });

  tags
    .command('attach <entryId> <tagName>')
    .description('Attach a tag to an entry')
    .action((entryId, tagName) => {
      attachTag(entryId, tagName);
    });

  tags
    .command('detach <entryId> <tagName>')
    .description('Detach a tag from an entry')
    .action((entryId, tagName) => {
      detachTag(entryId, tagName);
    });

  tags
    .command('show <entryId>')
    .description('Show tags for an entry')
    .action((entryId) => {
      showEntryTags(entryId);
    });

  tags
    .command('summary')
    .description('Show tag summary')
    .option('--from <date>', 'Start date (YYYY-MM-DD)')
    .option('--to <date>', 'End date (YYYY-MM-DD)')
    .action((options) => {
      showTagSummary(options);
    });

  // Default: show tags list if no subcommand
  tags.action(() => {
    listTags();
  });

  // Pomodoro timer
  const pomodoro = program
    .command('pomodoro')
    .alias('pomo')
    .description('Pomodoro timer for focused work sessions');

  pomodoro
    .command('start')
    .description('Start a pomodoro session')
    .option('-c, --category <category>', 'Category to track')
    .option('-n, --notes <notes>', 'Session notes')
    .option('-w, --work <minutes>', 'Work duration in minutes')
    .option('-b, --break <minutes>', 'Break duration in minutes')
    .option('-p, --project <project>', 'Project to track')
    .action((options) => {
      pomodoroStart(options);
    });

  pomodoro
    .command('status')
    .description('Show current pomodoro status')
    .action(() => {
      pomodoroStatus();
    });

  pomodoro
    .command('pause')
    .description('Pause the current pomodoro')
    .action(() => {
      pomodoroPause();
    });

  pomodoro
    .command('resume')
    .description('Resume a paused pomodoro')
    .action(() => {
      pomodoroResume();
    });

  pomodoro
    .command('next')
    .description('Move to next phase (work/break)')
    .action(() => {
      pomodoroNext();
    });

  pomodoro
    .command('stop')
    .description('Stop the pomodoro session')
    .action(() => {
      pomodoroStop();
    });

  pomodoro
    .command('skip')
    .description('Skip current phase')
    .action(() => {
      pomodoroSkip();
    });

  pomodoro
    .command('config')
    .description('Configure pomodoro settings')
    .option('-w, --work <minutes>', 'Work duration in minutes')
    .option('-b, --break <minutes>', 'Break duration in minutes')
    .option('-l, --long-break <minutes>', 'Long break duration in minutes')
    .option('-s, --sessions <count>', 'Sessions until long break')
    .option('--auto-break', 'Auto-start breaks')
    .option('--no-auto-break', 'Disable auto-start breaks')
    .option('--auto-work', 'Auto-start work after break')
    .option('--no-auto-work', 'Disable auto-start work')
    .action((options) => {
      pomodoroConfig({
        work: options.work,
        break: options.break,
        longBreak: options.longBreak,
        sessions: options.sessions,
        autoBreak: options.autoBreak,
        autoWork: options.autoWork,
      });
    });

  // Default: show pomodoro status if no subcommand
  pomodoro.action(() => {
    pomodoroStatus();
  });

  // Notifications management
  const notify = program
    .command('notify')
    .alias('notifications')
    .description('Manage desktop notifications');

  notify
    .command('status')
    .description('Show notification settings')
    .action(() => {
      notificationsStatus();
    });

  notify
    .command('enable')
    .description('Enable notifications')
    .action(() => {
      notificationsEnable();
    });

  notify
    .command('disable')
    .description('Disable notifications')
    .action(() => {
      notificationsDisable();
    });

  notify
    .command('config')
    .description('Configure notification settings')
    .option('--sound', 'Enable sound')
    .option('--no-sound', 'Disable sound')
    .option('--goals', 'Enable goal reminders')
    .option('--no-goals', 'Disable goal reminders')
    .option('--pomodoro', 'Enable pomodoro alerts')
    .option('--no-pomodoro', 'Disable pomodoro alerts')
    .option('--idle', 'Enable idle reminders')
    .option('--no-idle', 'Disable idle reminders')
    .option('--idle-minutes <minutes>', 'Idle threshold in minutes')
    .action((options) => {
      notificationsConfigure({
        sound: options.sound,
        goals: options.goals,
        pomodoro: options.pomodoro,
        idle: options.idle,
        idleMinutes: options.idleMinutes,
      });
    });

  notify
    .command('test')
    .description('Send a test notification')
    .action(() => {
      notificationsTest();
    });

  // Default: show notification status if no subcommand
  notify.action(() => {
    notificationsStatus();
  });

  // Focus mode
  const focus = program
    .command('focus')
    .description('Distraction-free focus mode');

  focus
    .command('start [category]')
    .description('Start focus mode')
    .option('-d, --duration <duration>', 'Focus duration (e.g., "60", "1h", "90m")')
    .option('-n, --notes <notes>', 'Session notes')
    .action((category, options) => {
      focusStart({ category, ...options });
    });

  focus
    .command('status')
    .description('Show focus mode status')
    .action(() => {
      focusStatus();
    });

  focus
    .command('end')
    .alias('stop')
    .description('End focus session')
    .action(() => {
      focusEnd();
    });

  focus
    .command('config')
    .description('Configure focus mode settings')
    .option('-d, --duration <minutes>', 'Default focus duration')
    .option('--show-timer', 'Show timer during focus')
    .option('--no-show-timer', 'Hide timer during focus')
    .option('--auto-stop', 'Auto-stop when duration reached')
    .option('--no-auto-stop', 'Continue after duration')
    .action((options) => {
      focusConfig({
        duration: options.duration,
        showTimer: options.showTimer,
        autoStop: options.autoStop,
      });
    });

  // Default: show focus status if no subcommand
  focus.action(() => {
    focusStatus();
  });

  // Templates management
  const template = program
    .command('template')
    .alias('templates')
    .description('Manage timer templates');

  template
    .command('list')
    .description('List all templates')
    .option('-f, --favorites', 'Show only favorites')
    .action((options) => {
      listTemplates(options);
    });

  template
    .command('add <name>')
    .description('Create a new template')
    .requiredOption('-c, --category <category>', 'Category for the template')
    .option('-p, --project <project>', 'Project for the template')
    .option('-t, --tags <tags>', 'Tags (comma-separated)')
    .option('-n, --notes <notes>', 'Default notes')
    .action((name, options) => {
      addTemplate(name, options);
    });

  template
    .command('remove <name>')
    .description('Remove a template')
    .action((name) => {
      removeTemplate(name);
    });

  template
    .command('use <name>')
    .description('Start timer from template')
    .action((name) => {
      useTemplate(name);
    });

  template
    .command('favorite <name>')
    .description('Toggle favorite status')
    .action((name) => {
      favoriteTemplate(name);
    });

  template
    .command('edit <name>')
    .description('Edit a template')
    .option('--rename <newName>', 'Rename the template')
    .option('-c, --category <category>', 'Change category')
    .option('-p, --project <project>', 'Change project')
    .option('-t, --tags <tags>', 'Change tags')
    .option('-n, --notes <notes>', 'Change notes')
    .option('--clear-project', 'Remove project')
    .option('--clear-tags', 'Remove tags')
    .option('--clear-notes', 'Remove notes')
    .action((name, options) => {
      editTemplate(name, options);
    });

  template
    .command('show <name>')
    .description('Show template details')
    .action((name) => {
      showTemplate(name);
    });

  // Default: show templates list if no subcommand
  template.action(() => {
    listTemplates();
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
    .command('reset [key]')
    .description('Reset configuration to defaults (optionally just one key)')
    .action((key) => {
      configResetCommand(key);
    });

  config
    .command('path')
    .description('Show configuration file path')
    .action(() => {
      configPathCommand();
    });

  config
    .command('edit')
    .description('Open configuration file in editor')
    .action(() => {
      configEditCommand();
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

  // Dashboard commands
  const dashboard = program
    .command('dashboard')
    .alias('dash')
    .description('Web dashboard for time tracking');

  dashboard
    .command('start')
    .description('Start the dashboard server')
    .option('-p, --port <port>', 'Port number (default: 3000)')
    .action((options) => {
      dashboardStart(options);
    });

  dashboard
    .command('stop')
    .description('Stop the dashboard server')
    .action(() => {
      dashboardStop();
    });

  dashboard
    .command('status')
    .description('Show dashboard server status')
    .action(() => {
      dashboardStatus();
    });

  dashboard
    .command('open')
    .description('Open dashboard in browser')
    .action(() => {
      dashboardOpen();
    });

  // Default: show dashboard status if no subcommand
  dashboard.action(() => {
    dashboardStatus();
  });

  // Undo command
  program
    .command('undo')
    .description('Undo the last action')
    .action(() => {
      undoCommand();
    });

  // Redo command
  program
    .command('redo')
    .description('Redo the last undone action')
    .action(() => {
      redoCommand();
    });

  // Undo history
  program
    .command('history')
    .description('Show undo history')
    .option('-n, --limit <number>', 'Number of entries to show', '10')
    .action((options) => {
      undoHistoryCommand(options);
    });

  // Clear undo history
  program
    .command('undo-clear')
    .description('Clear undo history')
    .action(() => {
      undoClearCommand();
    });

  // Shell completions
  const completions = program
    .command('completions [shell]')
    .description('Generate shell completions')
    .option('-s, --shell <shell>', 'Shell type (bash, zsh, fish)')
    .action((shell, options) => {
      completionsCommand({ shell: shell || options.shell });
    });

  completions
    .command('install <shell>')
    .description('Install completions to shell config file')
    .action((shell) => {
      completionsInstallCommand(shell);
    });

  // Import commands
  const importCmd = program
    .command('import')
    .description('Import time entries');

  importCmd
    .command('json <file>')
    .description('Import from JSON file')
    .option('--dry-run', 'Preview without importing')
    .action((file, options) => {
      importJson(file, options);
    });

  importCmd
    .command('csv <file>')
    .description('Import from CSV file')
    .option('--dry-run', 'Preview without importing')
    .action((file, options) => {
      importCsv(file, options);
    });

  // Default: show import help if no subcommand
  importCmd.action(() => {
    importHelp();
  });

  // Invoice command group
  const invoiceCmd = program
    .command('invoice')
    .description('Manage invoices');

  invoiceCmd
    .command('create')
    .description('Create a new invoice')
    .option('-p, --project <project>', 'Project to invoice')
    .option('--from <date>', 'Start date (YYYY-MM-DD)')
    .option('--to <date>', 'End date (YYYY-MM-DD)')
    .option('--month <month>', 'Invoice for a month (YYYY-MM)')
    .option('-r, --rate <rate>', 'Hourly rate')
    .action((options) => {
      invoiceCreateCommand(options);
    });

  invoiceCmd
    .command('list')
    .description('List all invoices')
    .action(() => {
      invoiceListCommand();
    });

  invoiceCmd
    .command('show <id>')
    .description('Show invoice details')
    .action((id) => {
      invoiceShowCommand(id);
    });

  invoiceCmd
    .command('export <id>')
    .description('Export invoice to file')
    .option('-f, --format <format>', 'Format (html or text)', 'html')
    .option('-o, --output <file>', 'Output file path')
    .action((id, options) => {
      invoiceExportCommand(id, options);
    });

  invoiceCmd
    .command('delete <id>')
    .description('Delete an invoice')
    .action((id) => {
      invoiceDeleteCommand(id);
    });

  invoiceCmd
    .command('preview')
    .description('Preview invoice summary')
    .option('-p, --project <project>', 'Project to preview')
    .option('--from <date>', 'Start date (YYYY-MM-DD)')
    .option('--to <date>', 'End date (YYYY-MM-DD)')
    .action((options) => {
      invoicePreview(options);
    });

  // Default action for invoice command (no subcommand)
  invoiceCmd.action(() => {
    invoiceListCommand();
  });

  // Productivity score command
  const score = program
    .command('score')
    .description('Show productivity score');

  score
    .command('today')
    .description("Show today's productivity score")
    .action(() => {
      scoreTodayCommand();
    });

  score
    .command('week')
    .description('Show weekly productivity score')
    .action(() => {
      scoreWeekCommand();
    });

  // Default: show today's score if no subcommand
  score.action(() => {
    scoreCommand();
  });

  // Team export command
  const team = program
    .command('team')
    .description('Team collaboration features');

  team
    .command('export')
    .description('Export time data for team sharing')
    .option('--from <date>', 'Start date (YYYY-MM-DD)')
    .option('--to <date>', 'End date (YYYY-MM-DD)')
    .option('-f, --format <format>', 'Format (text, json, html)', 'text')
    .option('-o, --output <file>', 'Output file path')
    .option('-d, --detailed', 'Include individual entries')
    .action((options) => {
      teamExportCommand(options);
    });

  // Default: show export help
  team.action(() => {
    console.log();
    console.log(chalk.bold('Team Commands'));
    console.log();
    console.log('  tt team export            Export time data for team sharing');
    console.log('  tt team export --help     Show export options');
    console.log();
  });

  // Webhook commands
  const webhook = program
    .command('webhook')
    .description('Manage webhooks for integrations');

  webhook
    .command('list')
    .description('List all webhooks')
    .action(() => {
      webhooksListCommand();
    });

  webhook
    .command('add <name> <url>')
    .description('Add a new webhook')
    .option('-e, --events <events>', 'Event types (comma-separated)', '*')
    .option('-s, --secret <secret>', 'Webhook secret')
    .action((name, url, options) => {
      webhooksAddCommand(name, url, options);
    });

  webhook
    .command('delete <nameOrId>')
    .description('Delete a webhook')
    .action((nameOrId) => {
      webhooksDeleteCommand(nameOrId);
    });

  webhook
    .command('logs')
    .description('Show webhook logs')
    .option('-n, --limit <number>', 'Number of logs to show', '20')
    .option('-w, --webhook-id <id>', 'Filter by webhook ID')
    .action((options) => {
      webhooksLogsCommand(options);
    });

  // Default: show webhook list
  webhook.action(() => {
    webhooksListCommand();
  });

  // Default action: show status
  program.action(() => {
    statusCommand();
  });

  return program;
}
