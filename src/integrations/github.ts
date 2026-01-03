/**
 * GitHub Issues Integration
 * Allows linking time entries to GitHub issues and syncing data
 */

import { getDatabase } from '../storage/database.js';

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  state: 'open' | 'closed';
  labels: string[];
  assignee: string | null;
  url: string;
}

// Store config in settings table
export function saveGitHubConfig(config: GitHubConfig): void {
  const db = getDatabase();
  db.prepare(`
    INSERT OR REPLACE INTO settings (key, value)
    VALUES ('github_token', ?), ('github_owner', ?), ('github_repo', ?)
  `).run(config.token, config.owner, config.repo);
}

export function getGitHubConfig(): GitHubConfig | null {
  const db = getDatabase();
  const token = db.prepare(`SELECT value FROM settings WHERE key = 'github_token'`).get() as { value: string } | undefined;
  const owner = db.prepare(`SELECT value FROM settings WHERE key = 'github_owner'`).get() as { value: string } | undefined;
  const repo = db.prepare(`SELECT value FROM settings WHERE key = 'github_repo'`).get() as { value: string } | undefined;

  if (!token?.value || !owner?.value || !repo?.value) {
    return null;
  }

  return {
    token: token.value,
    owner: owner.value,
    repo: repo.value,
  };
}

export function clearGitHubConfig(): void {
  const db = getDatabase();
  db.prepare(`DELETE FROM settings WHERE key IN ('github_token', 'github_owner', 'github_repo')`).run();
}

// Fetch issues from GitHub
export async function fetchGitHubIssues(
  config: GitHubConfig,
  options: { state?: 'open' | 'closed' | 'all'; labels?: string } = {}
): Promise<GitHubIssue[]> {
  const { state = 'open', labels } = options;

  let url = `https://api.github.com/repos/${config.owner}/${config.repo}/issues?state=${state}&per_page=100`;
  if (labels) {
    url += `&labels=${encodeURIComponent(labels)}`;
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Timer-Record-CLI',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error: ${response.status} - ${error}`);
  }

  const issues = await response.json() as Array<{
    number: number;
    title: string;
    state: 'open' | 'closed';
    labels: Array<{ name: string }>;
    assignee: { login: string } | null;
    html_url: string;
  }>;

  return issues.map(issue => ({
    number: issue.number,
    title: issue.title,
    state: issue.state,
    labels: issue.labels.map(l => l.name),
    assignee: issue.assignee?.login || null,
    url: issue.html_url,
  }));
}

// Get a single issue
export async function getGitHubIssue(
  config: GitHubConfig,
  issueNumber: number
): Promise<GitHubIssue | null> {
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/issues/${issueNumber}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Timer-Record-CLI',
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const issue = await response.json() as {
    number: number;
    title: string;
    state: 'open' | 'closed';
    labels: Array<{ name: string }>;
    assignee: { login: string } | null;
    html_url: string;
  };

  return {
    number: issue.number,
    title: issue.title,
    state: issue.state,
    labels: issue.labels.map(l => l.name),
    assignee: issue.assignee?.login || null,
    url: issue.html_url,
  };
}

// Post time spent as a comment on the issue
export async function postTimeComment(
  config: GitHubConfig,
  issueNumber: number,
  hours: number,
  description: string
): Promise<void> {
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/issues/${issueNumber}/comments`;

  const body = `**Time Logged:** ${hours.toFixed(2)} hours\n\n${description}\n\n---\n_Logged via [Timer Record](https://github.com/Fergonz1993/Timer-recorder)_`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Timer-Record-CLI',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body }),
  });

  if (!response.ok) {
    throw new Error(`Failed to post comment: ${response.status}`);
  }
}

// Parse issue reference from notes (e.g., "#123" or "owner/repo#123")
export function parseIssueReference(text: string): { owner?: string; repo?: string; number: number } | null {
  // Match "owner/repo#123" or just "#123"
  const fullMatch = text.match(/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)#(\d+)/);
  if (fullMatch) {
    return {
      owner: fullMatch[1],
      repo: fullMatch[2],
      number: parseInt(fullMatch[3], 10),
    };
  }

  const simpleMatch = text.match(/#(\d+)/);
  if (simpleMatch) {
    return {
      number: parseInt(simpleMatch[1], 10),
    };
  }

  return null;
}
