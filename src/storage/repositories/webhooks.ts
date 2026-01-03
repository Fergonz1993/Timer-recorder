import { getDatabase } from '../database.js';
import { loadConfig } from '../../config/settings.js';
import { getLogger } from '../../utils/logger.js';

export interface Webhook {
  id: number;
  name: string;
  url: string;
  events: string; // comma-separated event types
  secret: string | null;
  is_active: boolean;
  created_at: string;
}

export interface WebhookLog {
  id: number;
  webhook_id: number;
  event_type: string;
  payload: string;
  response_status: number | null;
  response_body: string | null;
  success: boolean;
  retries: number;
  created_at: string;
}

// Ensure webhooks tables exist
export function ensureWebhooksTable(): void {
  const db = getDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      events TEXT NOT NULL,
      secret TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS webhook_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      webhook_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      response_status INTEGER,
      response_body TEXT,
      success INTEGER DEFAULT 0,
      retries INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
    )
  `);
}

// Create a new webhook
export function createWebhook(data: {
  name: string;
  url: string;
  events: string[];
  secret?: string;
}): Webhook {
  ensureWebhooksTable();
  const db = getDatabase();
  const result = db.prepare(`
    INSERT INTO webhooks (name, url, events, secret)
    VALUES (?, ?, ?, ?)
  `).run(
    data.name,
    data.url,
    data.events.join(','),
    data.secret || null
  );
  return getWebhookById(result.lastInsertRowid as number)!;
}

// Get webhook by ID
export function getWebhookById(id: number): Webhook | null {
  ensureWebhooksTable();
  const db = getDatabase();
  return db.prepare('SELECT * FROM webhooks WHERE id = ?').get(id) as Webhook | null;
}

// Get all webhooks
export function getAllWebhooks(): Webhook[] {
  ensureWebhooksTable();
  const db = getDatabase();
  return db.prepare('SELECT * FROM webhooks ORDER BY created_at DESC').all() as Webhook[];
}

// Get active webhooks for an event
export function getActiveWebhooksForEvent(eventType: string): Webhook[] {
  ensureWebhooksTable();
  const db = getDatabase();
  const webhooks = db.prepare(`
    SELECT * FROM webhooks WHERE is_active = 1
  `).all() as Webhook[];

  // Filter to those that listen to this event
  return webhooks.filter(w => {
    const events = w.events.split(',').map(e => e.trim());
    return events.includes(eventType) || events.includes('*');
  });
}

// Delete webhook
export function deleteWebhook(id: number): boolean {
  ensureWebhooksTable();
  const db = getDatabase();
  // Rely on ON DELETE CASCADE - remove explicit log deletion
  const result = db.prepare('DELETE FROM webhooks WHERE id = ?').run(id);
  return result.changes > 0;
}

// Log a webhook call
export function logWebhookCall(data: {
  webhookId: number;
  eventType: string;
  payload: string;
  responseStatus?: number;
  responseBody?: string;
  success: boolean;
  retries?: number;
}): void {
  ensureWebhooksTable();
  const db = getDatabase();
  db.prepare(`
    INSERT INTO webhook_logs (
      webhook_id, event_type, payload, response_status,
      response_body, success, retries
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.webhookId,
    data.eventType,
    data.payload,
    data.responseStatus || null,
    data.responseBody || null,
    data.success ? 1 : 0,
    data.retries || 0
  );
}

// Get recent webhook logs
export function getWebhookLogs(webhookId?: number, limit = 50): WebhookLog[] {
  ensureWebhooksTable();
  const db = getDatabase();
  if (webhookId) {
    return db.prepare(`
      SELECT * FROM webhook_logs
      WHERE webhook_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(webhookId, limit) as WebhookLog[];
  }
  return db.prepare(`
    SELECT * FROM webhook_logs
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as WebhookLog[];
}

// Trigger webhooks for an event (async, non-blocking)
export async function triggerWebhooks(eventType: string, payload: Record<string, unknown>): Promise<void> {
  // Check privacy lockdown - don't send any webhooks if enabled
  const config = loadConfig();
  if (config.privacy_lockdown === true || config.webhooks_enabled === false) {
    return; // Silently skip webhooks in privacy lockdown mode
  }

  const webhooks = getActiveWebhooksForEvent(eventType);

  const logger = getLogger();
  
  for (const webhook of webhooks) {
    // Fire and forget - don't await, to keep it non-blocking
    fireWebhook(webhook, eventType, payload).catch((err) => {
      // Use structured logging
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Webhook invocation failed', error, {
        webhookId: webhook.id,
        webhookName: webhook.name,
        eventType,
      });
    });
  }
}

// Fire a single webhook with retries
async function fireWebhook(
  webhook: Webhook,
  eventType: string,
  payload: Record<string, unknown>,
  retries = 0
): Promise<void> {
  const maxRetries = 3;
  const payloadStr = JSON.stringify({
    event: eventType,
    timestamp: new Date().toISOString(),
    data: payload,
  });

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Event': eventType,
        ...(webhook.secret ? { 'X-Webhook-Secret': webhook.secret } : {}),
      },
      body: payloadStr,
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    const responseBody = await response.text();

    logWebhookCall({
      webhookId: webhook.id,
      eventType,
      payload: payloadStr,
      responseStatus: response.status,
      responseBody: responseBody.slice(0, 1000),
      success: response.ok,
      retries,
    });

    // Only retry on transient failures (5xx) or network errors, not 4xx client errors
    if (!response.ok && retries < maxRetries) {
      if (response.status >= 500 && response.status < 600) {
        // Server error - retry with exponential backoff
        await new Promise(r => setTimeout(r, Math.pow(2, retries) * 1000));
        return fireWebhook(webhook, eventType, payload, retries + 1);
      }
      // 4xx errors are permanent - don't retry
    }
  } catch (error) {
    logWebhookCall({
      webhookId: webhook.id,
      eventType,
      payload: payloadStr,
      success: false,
      retries,
    });

    // Network/timeout errors - retry
    if (retries < maxRetries) {
      await new Promise(r => setTimeout(r, Math.pow(2, retries) * 1000));
      return fireWebhook(webhook, eventType, payload, retries + 1);
    }
  }
}
