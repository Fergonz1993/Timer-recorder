import chalk from 'chalk';
import {
  createWebhook,
  getAllWebhooks,
  getWebhookById,
  deleteWebhook,
  getWebhookLogs,
  ensureWebhooksTable,
} from '../../storage/repositories/webhooks.js';
import { success, error, info } from '../utils/format.js';

// List webhooks
export function webhooksListCommand(): void {
  ensureWebhooksTable();
  const webhooks = getAllWebhooks();

  console.log();
  if (webhooks.length === 0) {
    info('No webhooks configured');
    console.log();
    console.log(chalk.dim('Create one with: tt webhook add <name> <url> --events "timer.start,timer.stop"'));
    console.log();
    return;
  }

  console.log(chalk.bold('Webhooks'));
  console.log();

  for (const webhook of webhooks) {
    const status = webhook.is_active ? chalk.green('active') : chalk.dim('inactive');
    console.log(`  ${chalk.cyan(webhook.name)} (${status})`);
    console.log(`    URL:    ${webhook.url}`);
    console.log(`    Events: ${webhook.events}`);
    console.log();
  }
}

// Add webhook
export function webhooksAddCommand(name: string, url: string, options: {
  events?: string;
  secret?: string;
}): void {
  const events = options.events?.split(',').map(e => e.trim()) || ['*'];

  try {
    const webhook = createWebhook({
      name,
      url,
      events,
      secret: options.secret,
    });

    console.log();
    success(`Webhook "${webhook.name}" created`);
    console.log();
    console.log(`  ID:     ${webhook.id}`);
    console.log(`  URL:    ${webhook.url}`);
    console.log(`  Events: ${events.join(', ')}`);
    console.log();
  } catch (err) {
    console.log();
    error('Failed to create webhook');
    console.log();
  }
}

// Delete webhook
export function webhooksDeleteCommand(nameOrId: string): void {
  ensureWebhooksTable();

  // Try to find by ID or name
  const id = parseInt(nameOrId, 10);
  let found = false;

  if (!isNaN(id)) {
    found = deleteWebhook(id);
  } else {
    const webhooks = getAllWebhooks();
    const webhook = webhooks.find(w => w.name.toLowerCase() === nameOrId.toLowerCase());
    if (webhook) {
      found = deleteWebhook(webhook.id);
    }
  }

  console.log();
  if (found) {
    success('Webhook deleted');
  } else {
    error(`Webhook "${nameOrId}" not found`);
  }
  console.log();
}

// Show webhook logs
export function webhooksLogsCommand(options: { limit?: string; webhookId?: string }): void {
  ensureWebhooksTable();
  const limit = options.limit ? parseInt(options.limit, 10) : 20;
  const webhookId = options.webhookId ? parseInt(options.webhookId, 10) : undefined;
  const logs = getWebhookLogs(webhookId, limit);

  console.log();
  if (logs.length === 0) {
    info('No webhook logs found');
    console.log();
    return;
  }

  console.log(chalk.bold('Webhook Logs'));
  console.log();

  for (const log of logs) {
    const status = log.success ? chalk.green('✓') : chalk.red('✗');
    const statusCode = log.response_status ? ` (${log.response_status})` : '';
    const retries = log.retries > 0 ? chalk.yellow(` [${log.retries} retries]`) : '';
    console.log(`${status} ${log.created_at.slice(0, 19)}  ${log.event_type}${statusCode}${retries}`);
  }

  console.log();
}
