/**
 * Integration commands for GitHub and Jira
 */

import chalk from 'chalk';
import { success, error, info } from '../utils/format.js';
import {
  saveGitHubConfig,
  getGitHubConfig,
  clearGitHubConfig,
  fetchGitHubIssues,
  getGitHubIssue,
  postTimeComment,
  parseIssueReference,
  GitHubConfig,
} from '../../integrations/github.js';
import {
  saveJiraConfig,
  getJiraConfig,
  clearJiraConfig,
  getJiraIssue,
  searchJiraIssues,
  logWorkToJira,
  getMyJiraIssues,
  parseJiraKey,
  JiraConfig,
} from '../../integrations/jira.js';
import { getDatabase } from '../../storage/database.js';

// GitHub commands
export async function githubConfigCommand(options: {
  token?: string;
  owner?: string;
  repo?: string;
  clear?: boolean;
}): Promise<void> {
  console.log();

  if (options.clear) {
    clearGitHubConfig();
    success('GitHub configuration cleared');
    console.log();
    return;
  }

  const existingConfig = getGitHubConfig();

  if (!options.token && !options.owner && !options.repo) {
    // Show current config
    if (existingConfig) {
      console.log(chalk.bold('GitHub Configuration'));
      console.log();
      console.log(`  Owner: ${chalk.cyan(existingConfig.owner)}`);
      console.log(`  Repo:  ${chalk.cyan(existingConfig.repo)}`);
      console.log(`  Token: ${chalk.dim('********' + existingConfig.token.slice(-4))}`);
    } else {
      info('GitHub not configured');
      console.log();
      console.log('  Configure with:');
      console.log(`  ${chalk.dim('tt integrate github --token <token> --owner <owner> --repo <repo>')}`);
    }
    console.log();
    return;
  }

  // Build config from options + existing
  const config: GitHubConfig = {
    token: options.token || existingConfig?.token || '',
    owner: options.owner || existingConfig?.owner || '',
    repo: options.repo || existingConfig?.repo || '',
  };

  if (!config.token || !config.owner || !config.repo) {
    error('Missing required options: --token, --owner, and --repo are required');
    console.log();
    return;
  }

  // Validate by fetching repo info
  try {
    const issues = await fetchGitHubIssues(config, { state: 'open' });
    saveGitHubConfig(config);
    success(`GitHub configured for ${config.owner}/${config.repo}`);
    console.log(`  Found ${issues.length} open issues`);
  } catch (err) {
    error(`Failed to connect: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
  console.log();
}

export async function githubIssuesCommand(options: {
  state?: 'open' | 'closed' | 'all';
  labels?: string;
}): Promise<void> {
  console.log();

  const config = getGitHubConfig();
  if (!config) {
    error('GitHub not configured. Run: tt integrate github --token <token> --owner <owner> --repo <repo>');
    console.log();
    return;
  }

  try {
    const issues = await fetchGitHubIssues(config, options);

    if (issues.length === 0) {
      info('No issues found');
      console.log();
      return;
    }

    console.log(chalk.bold(`GitHub Issues (${config.owner}/${config.repo})`));
    console.log();

    for (const issue of issues.slice(0, 20)) {
      const stateIcon = issue.state === 'open' ? chalk.green('●') : chalk.red('●');
      const labels = issue.labels.length > 0 ? chalk.dim(` [${issue.labels.join(', ')}]`) : '';
      console.log(`  ${stateIcon} ${chalk.cyan('#' + issue.number)} ${issue.title}${labels}`);
    }

    if (issues.length > 20) {
      console.log(chalk.dim(`  ... and ${issues.length - 20} more`));
    }
  } catch (err) {
    error(`Failed to fetch issues: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
  console.log();
}

export async function githubLogCommand(
  issueNumber: string,
  options: { hours?: string; message?: string }
): Promise<void> {
  console.log();

  const config = getGitHubConfig();
  if (!config) {
    error('GitHub not configured');
    console.log();
    return;
  }

  const num = parseInt(issueNumber, 10);
  if (isNaN(num)) {
    error('Invalid issue number');
    console.log();
    return;
  }

  const hours = options.hours ? parseFloat(options.hours) : undefined;
  if (hours !== undefined && (isNaN(hours) || hours <= 0)) {
    error('Invalid hours value');
    console.log();
    return;
  }

  try {
    const issue = await getGitHubIssue(config, num);
    if (!issue) {
      error(`Issue #${num} not found`);
      console.log();
      return;
    }

    const logHours = hours || 0;
    const message = options.message || 'Time logged';

    await postTimeComment(config, num, logHours, message);
    success(`Logged ${logHours.toFixed(2)}h to #${num}: ${issue.title}`);
  } catch (err) {
    error(`Failed to log time: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
  console.log();
}

// Jira commands
export async function jiraConfigCommand(options: {
  domain?: string;
  email?: string;
  token?: string;
  clear?: boolean;
}): Promise<void> {
  console.log();

  if (options.clear) {
    clearJiraConfig();
    success('Jira configuration cleared');
    console.log();
    return;
  }

  const existingConfig = getJiraConfig();

  if (!options.domain && !options.email && !options.token) {
    // Show current config
    if (existingConfig) {
      console.log(chalk.bold('Jira Configuration'));
      console.log();
      console.log(`  Domain: ${chalk.cyan(existingConfig.domain)}`);
      console.log(`  Email:  ${chalk.cyan(existingConfig.email)}`);
      console.log(`  Token:  ${chalk.dim('********' + existingConfig.apiToken.slice(-4))}`);
    } else {
      info('Jira not configured');
      console.log();
      console.log('  Configure with:');
      console.log(`  ${chalk.dim('tt integrate jira --domain <domain> --email <email> --token <token>')}`);
    }
    console.log();
    return;
  }

  // Build config from options + existing
  const config: JiraConfig = {
    domain: options.domain || existingConfig?.domain || '',
    email: options.email || existingConfig?.email || '',
    apiToken: options.token || existingConfig?.apiToken || '',
  };

  if (!config.domain || !config.email || !config.apiToken) {
    error('Missing required options: --domain, --email, and --token are required');
    console.log();
    return;
  }

  // Validate by fetching current user's issues
  try {
    const issues = await getMyJiraIssues(config);
    saveJiraConfig(config);
    success(`Jira configured for ${config.domain}`);
    console.log(`  Found ${issues.length} assigned issues`);
  } catch (err) {
    error(`Failed to connect: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
  console.log();
}

export async function jiraIssuesCommand(options: {
  jql?: string;
  mine?: boolean;
}): Promise<void> {
  console.log();

  const config = getJiraConfig();
  if (!config) {
    error('Jira not configured. Run: tt integrate jira --domain <domain> --email <email> --token <token>');
    console.log();
    return;
  }

  try {
    let issues;
    if (options.jql) {
      issues = await searchJiraIssues(config, options.jql);
    } else {
      issues = await getMyJiraIssues(config);
    }

    if (issues.length === 0) {
      info('No issues found');
      console.log();
      return;
    }

    console.log(chalk.bold('Jira Issues'));
    console.log();

    for (const issue of issues.slice(0, 20)) {
      const statusColor = issue.status.toLowerCase().includes('done') ? chalk.green : chalk.blue;
      console.log(`  ${chalk.cyan(issue.key)} ${issue.summary}`);
      console.log(`    ${statusColor(issue.status)} • ${issue.issueType} • ${issue.project}`);
    }

    if (issues.length > 20) {
      console.log(chalk.dim(`  ... and ${issues.length - 20} more`));
    }
  } catch (err) {
    error(`Failed to fetch issues: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
  console.log();
}

export async function jiraLogCommand(
  issueKey: string,
  options: { hours?: string; message?: string }
): Promise<void> {
  console.log();

  const config = getJiraConfig();
  if (!config) {
    error('Jira not configured');
    console.log();
    return;
  }

  const key = parseJiraKey(issueKey);
  if (!key) {
    error('Invalid issue key (expected format: PROJECT-123)');
    console.log();
    return;
  }

  const hours = options.hours ? parseFloat(options.hours) : undefined;
  if (hours !== undefined && (isNaN(hours) || hours <= 0)) {
    error('Invalid hours value');
    console.log();
    return;
  }

  try {
    const issue = await getJiraIssue(config, key);
    if (!issue) {
      error(`Issue ${key} not found`);
      console.log();
      return;
    }

    const logHours = hours || 0;
    const seconds = Math.round(logHours * 3600);
    const message = options.message || 'Time logged via Timer Record';

    await logWorkToJira(config, key, seconds, message);
    success(`Logged ${logHours.toFixed(2)}h to ${key}: ${issue.summary}`);
  } catch (err) {
    error(`Failed to log time: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
  console.log();
}

// Status command - show all integrations
export function integrateStatusCommand(): void {
  console.log();
  console.log(chalk.bold('Integration Status'));
  console.log();

  const github = getGitHubConfig();
  const jira = getJiraConfig();

  console.log('  GitHub:');
  if (github) {
    console.log(`    ${chalk.green('●')} Connected to ${chalk.cyan(`${github.owner}/${github.repo}`)}`);
  } else {
    console.log(`    ${chalk.dim('○')} Not configured`);
  }

  console.log();
  console.log('  Jira:');
  if (jira) {
    console.log(`    ${chalk.green('●')} Connected to ${chalk.cyan(jira.domain)}`);
  } else {
    console.log(`    ${chalk.dim('○')} Not configured`);
  }

  console.log();
}
