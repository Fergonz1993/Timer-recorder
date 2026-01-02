import chalk from 'chalk';
import { existsSync, appendFileSync, writeFileSync, mkdirSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { success, info } from '../utils/format.js';

// Generate bash completion script
export function generateBashCompletions(): string {
  return `# Timer Record (tt) Bash Completion
# Add this to your ~/.bashrc or ~/.bash_completion

_tt_completions() {
  local cur prev commands
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  commands="start stop status log list edit delete note search today week month compare stats goals project tag pomodoro notify focus template export categories rules daemon config detect dashboard undo history"

  case "\${prev}" in
    start)
      local categories=\$(tt categories list 2>/dev/null | grep -v "^$" | awk '{print \$1}')
      COMPREPLY=( \$(compgen -W "\${categories}" -- \${cur}) )
      return 0
      ;;
    project)
      COMPREPLY=( \$(compgen -W "list add remove show edit default clients" -- \${cur}) )
      return 0
      ;;
    tag)
      COMPREPLY=( \$(compgen -W "list add remove edit attach detach show summary" -- \${cur}) )
      return 0
      ;;
    pomodoro|pomo)
      COMPREPLY=( \$(compgen -W "start stop status pause resume next skip config" -- \${cur}) )
      return 0
      ;;
    goals)
      COMPREPLY=( \$(compgen -W "set list progress remove" -- \${cur}) )
      return 0
      ;;
    template)
      COMPREPLY=( \$(compgen -W "list add remove use favorite edit show" -- \${cur}) )
      return 0
      ;;
    focus)
      COMPREPLY=( \$(compgen -W "start status end config" -- \${cur}) )
      return 0
      ;;
    notify)
      COMPREPLY=( \$(compgen -W "status enable disable config test" -- \${cur}) )
      return 0
      ;;
    export)
      COMPREPLY=( \$(compgen -W "csv json" -- \${cur}) )
      return 0
      ;;
    dashboard)
      COMPREPLY=( \$(compgen -W "start stop status open" -- \${cur}) )
      return 0
      ;;
    daemon)
      COMPREPLY=( \$(compgen -W "start stop status logs install uninstall" -- \${cur}) )
      return 0
      ;;
    config)
      COMPREPLY=( \$(compgen -W "list get set reset path" -- \${cur}) )
      return 0
      ;;
    categories)
      COMPREPLY=( \$(compgen -W "list add remove" -- \${cur}) )
      return 0
      ;;
    rules)
      COMPREPLY=( \$(compgen -W "list add remove examples" -- \${cur}) )
      return 0
      ;;
    tt)
      COMPREPLY=( \$(compgen -W "\${commands}" -- \${cur}) )
      return 0
      ;;
    *)
      ;;
  esac

  COMPREPLY=( \$(compgen -W "\${commands}" -- \${cur}) )
}

complete -F _tt_completions tt
`;
}

// Generate zsh completion script
export function generateZshCompletions(): string {
  return `#compdef tt
# Timer Record (tt) Zsh Completion
# Add this to your ~/.zshrc or put in fpath

_tt() {
  local -a commands
  commands=(
    'start:Start a timer'
    'stop:Stop current timer'
    'status:Show current status'
    'log:Log manual entry'
    'list:List recent entries'
    'edit:Edit an entry'
    'delete:Delete an entry'
    'note:Add note to timer'
    'search:Search entries'
    'today:Today summary'
    'week:Week summary'
    'month:Month summary'
    'compare:Compare periods'
    'stats:Show statistics'
    'goals:Manage goals'
    'project:Manage projects'
    'tag:Manage tags'
    'pomodoro:Pomodoro timer'
    'notify:Manage notifications'
    'focus:Focus mode'
    'template:Manage templates'
    'export:Export data'
    'categories:Manage categories'
    'rules:Manage rules'
    'daemon:Control daemon'
    'config:Configuration'
    'detect:Detect current app'
    'dashboard:Web dashboard'
    'undo:Undo last action'
    'history:Show undo history'
  )

  _arguments -C \\
    '1: :->command' \\
    '*:: :->args'

  case $state in
    command)
      _describe 'command' commands
      ;;
    args)
      case $words[1] in
        start)
          _values 'category' \$(tt categories list 2>/dev/null | grep -v "^$" | awk '{print \$1}')
          ;;
        project)
          _values 'subcommand' list add remove show edit default clients
          ;;
        tag)
          _values 'subcommand' list add remove edit attach detach show summary
          ;;
        pomodoro|pomo)
          _values 'subcommand' start stop status pause resume next skip config
          ;;
        goals)
          _values 'subcommand' set list progress remove
          ;;
        template)
          _values 'subcommand' list add remove use favorite edit show
          ;;
        focus)
          _values 'subcommand' start status end config
          ;;
        notify)
          _values 'subcommand' status enable disable config test
          ;;
        export)
          _values 'format' csv json
          ;;
        dashboard)
          _values 'subcommand' start stop status open
          ;;
        daemon)
          _values 'subcommand' start stop status logs install uninstall
          ;;
        config)
          _values 'subcommand' list get set reset path
          ;;
        categories)
          _values 'subcommand' list add remove
          ;;
        rules)
          _values 'subcommand' list add remove examples
          ;;
      esac
      ;;
  esac
}

_tt
`;
}

// Generate fish completion script
export function generateFishCompletions(): string {
  return `# Timer Record (tt) Fish Completion
# Add this to ~/.config/fish/completions/tt.fish

# Main commands
complete -c tt -f -n "__fish_use_subcommand" -a "start" -d "Start a timer"
complete -c tt -f -n "__fish_use_subcommand" -a "stop" -d "Stop current timer"
complete -c tt -f -n "__fish_use_subcommand" -a "status" -d "Show current status"
complete -c tt -f -n "__fish_use_subcommand" -a "log" -d "Log manual entry"
complete -c tt -f -n "__fish_use_subcommand" -a "list" -d "List recent entries"
complete -c tt -f -n "__fish_use_subcommand" -a "edit" -d "Edit an entry"
complete -c tt -f -n "__fish_use_subcommand" -a "delete" -d "Delete an entry"
complete -c tt -f -n "__fish_use_subcommand" -a "note" -d "Add note to timer"
complete -c tt -f -n "__fish_use_subcommand" -a "search" -d "Search entries"
complete -c tt -f -n "__fish_use_subcommand" -a "today" -d "Today summary"
complete -c tt -f -n "__fish_use_subcommand" -a "week" -d "Week summary"
complete -c tt -f -n "__fish_use_subcommand" -a "month" -d "Month summary"
complete -c tt -f -n "__fish_use_subcommand" -a "compare" -d "Compare periods"
complete -c tt -f -n "__fish_use_subcommand" -a "stats" -d "Show statistics"
complete -c tt -f -n "__fish_use_subcommand" -a "goals" -d "Manage goals"
complete -c tt -f -n "__fish_use_subcommand" -a "project" -d "Manage projects"
complete -c tt -f -n "__fish_use_subcommand" -a "tag" -d "Manage tags"
complete -c tt -f -n "__fish_use_subcommand" -a "pomodoro" -d "Pomodoro timer"
complete -c tt -f -n "__fish_use_subcommand" -a "pomo" -d "Pomodoro timer (alias)"
complete -c tt -f -n "__fish_use_subcommand" -a "notify" -d "Manage notifications"
complete -c tt -f -n "__fish_use_subcommand" -a "focus" -d "Focus mode"
complete -c tt -f -n "__fish_use_subcommand" -a "template" -d "Manage templates"
complete -c tt -f -n "__fish_use_subcommand" -a "export" -d "Export data"
complete -c tt -f -n "__fish_use_subcommand" -a "categories" -d "Manage categories"
complete -c tt -f -n "__fish_use_subcommand" -a "rules" -d "Manage rules"
complete -c tt -f -n "__fish_use_subcommand" -a "daemon" -d "Control daemon"
complete -c tt -f -n "__fish_use_subcommand" -a "config" -d "Configuration"
complete -c tt -f -n "__fish_use_subcommand" -a "detect" -d "Detect current app"
complete -c tt -f -n "__fish_use_subcommand" -a "dashboard" -d "Web dashboard"
complete -c tt -f -n "__fish_use_subcommand" -a "undo" -d "Undo last action"
complete -c tt -f -n "__fish_use_subcommand" -a "history" -d "Show undo history"

# Project subcommands
complete -c tt -f -n "__fish_seen_subcommand_from project" -a "list add remove show edit default clients"

# Tag subcommands
complete -c tt -f -n "__fish_seen_subcommand_from tag" -a "list add remove edit attach detach show summary"

# Pomodoro subcommands
complete -c tt -f -n "__fish_seen_subcommand_from pomodoro pomo" -a "start stop status pause resume next skip config"

# Goals subcommands
complete -c tt -f -n "__fish_seen_subcommand_from goals" -a "set list progress remove"

# Template subcommands
complete -c tt -f -n "__fish_seen_subcommand_from template" -a "list add remove use favorite edit show"

# Focus subcommands
complete -c tt -f -n "__fish_seen_subcommand_from focus" -a "start status end config"

# Notify subcommands
complete -c tt -f -n "__fish_seen_subcommand_from notify" -a "status enable disable config test"

# Export subcommands
complete -c tt -f -n "__fish_seen_subcommand_from export" -a "csv json"

# Dashboard subcommands
complete -c tt -f -n "__fish_seen_subcommand_from dashboard" -a "start stop status open"

# Daemon subcommands
complete -c tt -f -n "__fish_seen_subcommand_from daemon" -a "start stop status logs install uninstall"

# Config subcommands
complete -c tt -f -n "__fish_seen_subcommand_from config" -a "list get set reset path"

# Categories subcommands
complete -c tt -f -n "__fish_seen_subcommand_from categories" -a "list add remove"

# Rules subcommands
complete -c tt -f -n "__fish_seen_subcommand_from rules" -a "list add remove examples"
`;
}

// Show completions command
export function completionsCommand(options?: { shell?: string }): void {
  const shell = options?.shell || 'bash';

  console.log();

  switch (shell.toLowerCase()) {
    case 'bash':
      console.log(generateBashCompletions());
      break;
    case 'zsh':
      console.log(generateZshCompletions());
      break;
    case 'fish':
      console.log(generateFishCompletions());
      break;
    default:
      console.log(chalk.bold('Shell Completions'));
      console.log();
      console.log('Generate completions for your shell:');
      console.log();
      console.log('  Bash:  tt completions --shell bash >> ~/.bashrc');
      console.log('  Zsh:   tt completions --shell zsh >> ~/.zshrc');
      console.log('  Fish:  tt completions --shell fish > ~/.config/fish/completions/tt.fish');
      console.log();
  }
}

// Install completions to shell config
export function completionsInstallCommand(shell: string): void {
  const home = homedir();

  switch (shell.toLowerCase()) {
    case 'bash': {
      const bashrc = join(home, '.bashrc');
      const completionsFile = join(home, '.config', 'timer-record', 'tt-completions.bash');
      const completionsDir = dirname(completionsFile);

      // Create completions directory
      if (!existsSync(completionsDir)) {
        mkdirSync(completionsDir, { recursive: true });
      }

      // Write completions file
      writeFileSync(completionsFile, generateBashCompletions());

      // Add source line to bashrc if not already present
      const sourceLine = `\n# Timer Record completions\nsource "${completionsFile}"\n`;
      const bashrcContent = existsSync(bashrc) ? readFileSync(bashrc, 'utf-8') : '';

      if (!bashrcContent.includes('tt-completions.bash')) {
        appendFileSync(bashrc, sourceLine);
        success(`Added completions to ${bashrc}`);
      } else {
        info('Completions already installed in .bashrc');
      }

      success(`Completions file created at ${completionsFile}`);
      info('Restart your shell or run: source ~/.bashrc');
      break;
    }
    case 'zsh': {
      const zshrc = join(home, '.zshrc');
      const completionsFile = join(home, '.config', 'timer-record', '_tt');
      const completionsDir = dirname(completionsFile);

      // Create completions directory
      if (!existsSync(completionsDir)) {
        mkdirSync(completionsDir, { recursive: true });
      }

      // Write completions file
      writeFileSync(completionsFile, generateZshCompletions());

      // Add fpath and source to zshrc
      const fpathLine = `\n# Timer Record completions\nfpath=(${completionsDir} $fpath)\nautoload -Uz compinit && compinit\n`;
      const zshrcContent = existsSync(zshrc) ? readFileSync(zshrc, 'utf-8') : '';

      if (!zshrcContent.includes('timer-record')) {
        appendFileSync(zshrc, fpathLine);
        success(`Added completions to ${zshrc}`);
      } else {
        info('Completions already installed in .zshrc');
      }

      success(`Completions file created at ${completionsFile}`);
      info('Restart your shell or run: source ~/.zshrc');
      break;
    }
    case 'fish': {
      const completionsFile = join(home, '.config', 'fish', 'completions', 'tt.fish');
      const completionsDir = dirname(completionsFile);

      // Create completions directory
      if (!existsSync(completionsDir)) {
        mkdirSync(completionsDir, { recursive: true });
      }

      // Write completions file
      writeFileSync(completionsFile, generateFishCompletions());

      success(`Completions installed to ${completionsFile}`);
      info('Completions will be available in new fish shells');
      break;
    }
    default:
      console.log('Supported shells: bash, zsh, fish');
      console.log();
      console.log('Usage: tt completions install <shell>');
  }
}
