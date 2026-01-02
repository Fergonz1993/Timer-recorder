import { writeFileSync } from 'fs';
import chalk from 'chalk';
import { getDatabase } from '../../storage/database.js';
import { getAllProjects, getProjectByName } from '../../storage/repositories/projects.js';
import { success, error, info, formatDuration } from '../utils/format.js';

interface InvoiceEntry {
  date: string;
  category: string;
  project: string | null;
  hours: number;
  rate: number;
  amount: number;
  notes: string | null;
}

interface InvoiceData {
  project: string;
  client: string | null;
  period: string;
  entries: InvoiceEntry[];
  totalHours: number;
  totalAmount: number;
  rate: number;
}

// Generate invoice data
function generateInvoiceData(options: {
  project?: string;
  from?: string;
  to?: string;
  rate?: number;
}): InvoiceData | null {
  const db = getDatabase();

  // Get project details
  let project = null;
  let projectFilter = '';
  const params: (string | number | null)[] = [];

  if (options.project) {
    project = getProjectByName(options.project);
    if (!project) {
      return null;
    }
    projectFilter = 'AND e.project_id = ?';
    params.push(project.id);
  }

  // Get date range
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const fromDate = options.from || firstOfMonth.toISOString().split('T')[0];
  const toDate = options.to || today.toISOString().split('T')[0];
  params.unshift(fromDate, toDate);

  // Get entries
  const entries = db.prepare(`
    SELECT
      date(e.start_time) as date,
      COALESCE(c.name, 'uncategorized') as category,
      p.name as project,
      e.duration_seconds,
      e.notes,
      COALESCE(p.hourly_rate, 0) as rate
    FROM time_entries e
    LEFT JOIN categories c ON e.category_id = c.id
    LEFT JOIN projects p ON e.project_id = p.id
    WHERE date(e.start_time) BETWEEN ? AND ?
    AND e.duration_seconds IS NOT NULL
    ${projectFilter}
    ORDER BY e.start_time
  `).all(...params) as {
    date: string;
    category: string;
    project: string | null;
    duration_seconds: number;
    notes: string | null;
    rate: number;
  }[];

  if (entries.length === 0) {
    return null;
  }

  const rate = options.rate || project?.hourly_rate || 0;

  const invoiceEntries: InvoiceEntry[] = entries.map(e => ({
    date: e.date,
    category: e.category,
    project: e.project,
    hours: e.duration_seconds / 3600,
    rate,
    amount: (e.duration_seconds / 3600) * rate,
    notes: e.notes,
  }));

  const totalHours = invoiceEntries.reduce((sum, e) => sum + e.hours, 0);
  const totalAmount = totalHours * rate;

  return {
    project: options.project || 'All Projects',
    client: project?.client || null,
    period: `${fromDate} to ${toDate}`,
    entries: invoiceEntries,
    totalHours,
    totalAmount,
    rate,
  };
}

// Generate text invoice
function generateTextInvoice(data: InvoiceData): string {
  let output = '═'.repeat(60) + '\n';
  output += '                        INVOICE\n';
  output += '═'.repeat(60) + '\n\n';

  output += `Project:    ${data.project}\n`;
  if (data.client) {
    output += `Client:     ${data.client}\n`;
  }
  output += `Period:     ${data.period}\n`;
  output += `Rate:       $${data.rate.toFixed(2)}/hour\n\n`;

  output += '─'.repeat(60) + '\n';
  output += 'Date        Category        Hours       Amount\n';
  output += '─'.repeat(60) + '\n';

  for (const entry of data.entries) {
    const date = entry.date.padEnd(12);
    const category = entry.category.slice(0, 15).padEnd(16);
    const hours = entry.hours.toFixed(2).padStart(6);
    const amount = ('$' + entry.amount.toFixed(2)).padStart(12);
    output += `${date}${category}${hours}${amount}\n`;
  }

  output += '─'.repeat(60) + '\n';
  output += `TOTAL${' '.repeat(25)}${data.totalHours.toFixed(2).padStart(6)}  $${data.totalAmount.toFixed(2).padStart(10)}\n`;
  output += '═'.repeat(60) + '\n';

  return output;
}

// Generate HTML invoice
function generateHtmlInvoice(data: InvoiceData): string {
  const entriesHtml = data.entries.map(e => `
    <tr>
      <td>${e.date}</td>
      <td>${e.category}</td>
      <td class="number">${e.hours.toFixed(2)}</td>
      <td class="number">$${e.amount.toFixed(2)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice - ${data.project}</title>
  <style>
    body { font-family: -apple-system, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
    h1 { color: #333; border-bottom: 2px solid #61AFEF; padding-bottom: 10px; }
    .header { margin-bottom: 30px; }
    .header p { margin: 5px 0; color: #666; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; }
    .number { text-align: right; }
    .total { font-weight: bold; background: #f0f0f0; }
    .footer { margin-top: 40px; text-align: center; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Invoice</h1>
  <div class="header">
    <p><strong>Project:</strong> ${data.project}</p>
    ${data.client ? `<p><strong>Client:</strong> ${data.client}</p>` : ''}
    <p><strong>Period:</strong> ${data.period}</p>
    <p><strong>Rate:</strong> $${data.rate.toFixed(2)}/hour</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Category</th>
        <th class="number">Hours</th>
        <th class="number">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${entriesHtml}
    </tbody>
    <tfoot>
      <tr class="total">
        <td colspan="2">Total</td>
        <td class="number">${data.totalHours.toFixed(2)}</td>
        <td class="number">$${data.totalAmount.toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>
  <div class="footer">Generated by Timer Record</div>
</body>
</html>`;
}

// Invoice command
export function invoiceCommand(options: {
  project?: string;
  from?: string;
  to?: string;
  rate?: string;
  output?: string;
  format?: string;
}): void {
  const rate = options.rate ? parseFloat(options.rate) : undefined;
  const data = generateInvoiceData({
    project: options.project,
    from: options.from,
    to: options.to,
    rate,
  });

  if (!data) {
    console.log();
    if (options.project) {
      error(`Project "${options.project}" not found or no entries in period`);
    } else {
      error('No billable entries found in the specified period');
    }
    console.log();
    return;
  }

  const format = options.format || 'text';
  let content: string;

  if (format === 'html') {
    content = generateHtmlInvoice(data);
  } else {
    content = generateTextInvoice(data);
  }

  if (options.output) {
    writeFileSync(options.output, content);
    console.log();
    success(`Invoice saved to ${options.output}`);
    console.log();
  } else {
    console.log();
    console.log(content);
  }
}

// Preview invoice
export function invoicePreview(options: {
  project?: string;
  from?: string;
  to?: string;
}): void {
  const data = generateInvoiceData({
    project: options.project,
    from: options.from,
    to: options.to,
  });

  if (!data) {
    console.log();
    info('No billable entries found');
    console.log();
    return;
  }

  console.log();
  console.log(chalk.bold('Invoice Preview'));
  console.log();
  console.log(`  Project:     ${data.project}`);
  if (data.client) {
    console.log(`  Client:      ${data.client}`);
  }
  console.log(`  Period:      ${data.period}`);
  console.log(`  Rate:        $${data.rate.toFixed(2)}/hour`);
  console.log(`  Total Hours: ${data.totalHours.toFixed(2)}`);
  console.log(`  Total:       ${chalk.green('$' + data.totalAmount.toFixed(2))}`);
  console.log(`  Entries:     ${data.entries.length}`);
  console.log();
  info('Generate with: tt invoice --project <name> -o invoice.html --format html');
  console.log();
}
