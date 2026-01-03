/**
 * Jira Integration
 * Allows linking time entries to Jira issues and logging work
 */

import { getDatabase } from '../storage/database.js';

export interface JiraConfig {
  domain: string; // e.g., "company.atlassian.net"
  email: string;
  apiToken: string;
}

export interface JiraIssue {
  key: string;
  summary: string;
  status: string;
  assignee: string | null;
  project: string;
  issueType: string;
  url: string;
}

export interface JiraWorklog {
  id: string;
  timeSpentSeconds: number;
  comment: string;
  started: string;
}

// Store config in settings table
export function saveJiraConfig(config: JiraConfig): void {
  const db = getDatabase();
  db.prepare(`
    INSERT OR REPLACE INTO settings (key, value)
    VALUES ('jira_domain', ?), ('jira_email', ?), ('jira_token', ?)
  `).run(config.domain, config.email, config.apiToken);
}

export function getJiraConfig(): JiraConfig | null {
  const db = getDatabase();
  const domain = db.prepare(`SELECT value FROM settings WHERE key = 'jira_domain'`).get() as { value: string } | undefined;
  const email = db.prepare(`SELECT value FROM settings WHERE key = 'jira_email'`).get() as { value: string } | undefined;
  const token = db.prepare(`SELECT value FROM settings WHERE key = 'jira_token'`).get() as { value: string } | undefined;

  if (!domain?.value || !email?.value || !token?.value) {
    return null;
  }

  return {
    domain: domain.value,
    email: email.value,
    apiToken: token.value,
  };
}

export function clearJiraConfig(): void {
  const db = getDatabase();
  db.prepare(`DELETE FROM settings WHERE key IN ('jira_domain', 'jira_email', 'jira_token')`).run();
}

// Get auth header for Jira
function getAuthHeader(config: JiraConfig): string {
  const credentials = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
  return `Basic ${credentials}`;
}

// Fetch issue from Jira
export async function getJiraIssue(
  config: JiraConfig,
  issueKey: string
): Promise<JiraIssue | null> {
  const url = `https://${config.domain}/rest/api/3/issue/${issueKey}`;

  const response = await fetch(url, {
    headers: {
      Authorization: getAuthHeader(config),
      Accept: 'application/json',
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Jira API error: ${response.status} - ${error}`);
  }

  const data = await response.json() as {
    key: string;
    fields: {
      summary: string;
      status: { name: string };
      assignee: { displayName: string } | null;
      project: { key: string };
      issuetype: { name: string };
    };
  };

  return {
    key: data.key,
    summary: data.fields.summary,
    status: data.fields.status.name,
    assignee: data.fields.assignee?.displayName || null,
    project: data.fields.project.key,
    issueType: data.fields.issuetype.name,
    url: `https://${config.domain}/browse/${data.key}`,
  };
}

// Search issues with JQL
export async function searchJiraIssues(
  config: JiraConfig,
  jql: string,
  maxResults: number = 50
): Promise<JiraIssue[]> {
  const url = `https://${config.domain}/rest/api/3/search`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(config),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jql,
      maxResults,
      fields: ['summary', 'status', 'assignee', 'project', 'issuetype'],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Jira search error: ${response.status} - ${error}`);
  }

  const data = await response.json() as {
    issues: Array<{
      key: string;
      fields: {
        summary: string;
        status: { name: string };
        assignee: { displayName: string } | null;
        project: { key: string };
        issuetype: { name: string };
      };
    }>;
  };

  return data.issues.map(issue => ({
    key: issue.key,
    summary: issue.fields.summary,
    status: issue.fields.status.name,
    assignee: issue.fields.assignee?.displayName || null,
    project: issue.fields.project.key,
    issueType: issue.fields.issuetype.name,
    url: `https://${config.domain}/browse/${issue.key}`,
  }));
}

// Log work to Jira issue
export async function logWorkToJira(
  config: JiraConfig,
  issueKey: string,
  timeSpentSeconds: number,
  comment: string,
  started?: Date
): Promise<JiraWorklog> {
  const url = `https://${config.domain}/rest/api/3/issue/${issueKey}/worklog`;

  const startedDate = started || new Date();
  const startedIso = startedDate.toISOString().replace('Z', '+0000');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(config),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeSpentSeconds,
      comment: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: comment,
              },
            ],
          },
        ],
      },
      started: startedIso,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to log work: ${response.status} - ${error}`);
  }

  const worklog = await response.json() as {
    id: string;
    timeSpentSeconds: number;
    comment: { content: Array<{ content: Array<{ text: string }> }> };
    started: string;
  };

  return {
    id: worklog.id,
    timeSpentSeconds: worklog.timeSpentSeconds,
    comment: worklog.comment?.content?.[0]?.content?.[0]?.text || '',
    started: worklog.started,
  };
}

// Get worklogs for an issue
export async function getJiraWorklogs(
  config: JiraConfig,
  issueKey: string
): Promise<JiraWorklog[]> {
  const url = `https://${config.domain}/rest/api/3/issue/${issueKey}/worklog`;

  const response = await fetch(url, {
    headers: {
      Authorization: getAuthHeader(config),
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get worklogs: ${response.status}`);
  }

  const data = await response.json() as {
    worklogs: Array<{
      id: string;
      timeSpentSeconds: number;
      comment: { content: Array<{ content: Array<{ text: string }> }> } | null;
      started: string;
    }>;
  };

  return data.worklogs.map(w => ({
    id: w.id,
    timeSpentSeconds: w.timeSpentSeconds,
    comment: w.comment?.content?.[0]?.content?.[0]?.text || '',
    started: w.started,
  }));
}

// Parse Jira issue key from text (e.g., "PROJECT-123")
export function parseJiraKey(text: string): string | null {
  const match = text.match(/([A-Z][A-Z0-9]*-\d+)/);
  return match ? match[1] : null;
}

// Get my issues (assigned to current user)
export async function getMyJiraIssues(config: JiraConfig): Promise<JiraIssue[]> {
  return searchJiraIssues(config, 'assignee = currentUser() AND status != Done ORDER BY updated DESC');
}
