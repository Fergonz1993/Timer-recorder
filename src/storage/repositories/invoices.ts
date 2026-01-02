import { getDatabase } from '../database.js';

export interface Invoice {
  id: number;
  invoice_number: string;
  project_id: number | null;
  client: string | null;
  from_date: string;
  to_date: string;
  total_hours: number;
  hourly_rate: number;
  total_amount: number;
  status: 'draft' | 'sent' | 'paid';
  notes: string | null;
  created_at: string;
}

export interface InvoiceLineItem {
  id: number;
  invoice_id: number;
  entry_id: number;
  date: string;
  category: string;
  hours: number;
  rate: number;
  amount: number;
  notes: string | null;
}

// Ensure invoices tables exist
export function ensureInvoicesTable(): void {
  const db = getDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      project_id INTEGER,
      client TEXT,
      from_date TEXT NOT NULL,
      to_date TEXT NOT NULL,
      total_hours REAL NOT NULL,
      hourly_rate REAL NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT DEFAULT 'draft',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoice_line_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      entry_id INTEGER,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      hours REAL NOT NULL,
      rate REAL NOT NULL,
      amount REAL NOT NULL,
      notes TEXT,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (entry_id) REFERENCES time_entries(id)
    )
  `);
}

// Generate next invoice number
export function getNextInvoiceNumber(): string {
  ensureInvoicesTable();
  const db = getDatabase();
  const result = db.prepare(`
    SELECT invoice_number FROM invoices
    ORDER BY id DESC LIMIT 1
  `).get() as { invoice_number: string } | undefined;

  if (!result) {
    return 'INV-001';
  }

  // Extract number from invoice_number (e.g., INV-001 -> 1)
  const match = result.invoice_number.match(/INV-(\d+)/);
  if (match) {
    const nextNum = parseInt(match[1], 10) + 1;
    return `INV-${nextNum.toString().padStart(3, '0')}`;
  }

  return `INV-${Date.now()}`;
}

// Create a new invoice
export function createInvoice(data: {
  projectId: number | null;
  client: string | null;
  fromDate: string;
  toDate: string;
  totalHours: number;
  hourlyRate: number;
  totalAmount: number;
  notes?: string;
  lineItems: {
    entryId?: number;
    date: string;
    category: string;
    hours: number;
    rate: number;
    amount: number;
    notes?: string;
  }[];
}): Invoice {
  ensureInvoicesTable();
  const db = getDatabase();
  const invoiceNumber = getNextInvoiceNumber();

  const result = db.prepare(`
    INSERT INTO invoices (
      invoice_number, project_id, client, from_date, to_date,
      total_hours, hourly_rate, total_amount, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    invoiceNumber,
    data.projectId,
    data.client,
    data.fromDate,
    data.toDate,
    data.totalHours,
    data.hourlyRate,
    data.totalAmount,
    data.notes || null
  );

  const invoiceId = result.lastInsertRowid as number;

  // Insert line items
  const insertLineItem = db.prepare(`
    INSERT INTO invoice_line_items (
      invoice_id, entry_id, date, category, hours, rate, amount, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const item of data.lineItems) {
    insertLineItem.run(
      invoiceId,
      item.entryId || null,
      item.date,
      item.category,
      item.hours,
      item.rate,
      item.amount,
      item.notes || null
    );
  }

  return getInvoiceById(invoiceId)!;
}

// Get invoice by ID
export function getInvoiceById(id: number): Invoice | null {
  ensureInvoicesTable();
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM invoices WHERE id = ?
  `).get(id) as Invoice | null;
}

// Get invoice by number
export function getInvoiceByNumber(invoiceNumber: string): Invoice | null {
  ensureInvoicesTable();
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM invoices WHERE invoice_number = ?
  `).get(invoiceNumber) as Invoice | null;
}

// Get all invoices
export function getAllInvoices(): Invoice[] {
  ensureInvoicesTable();
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM invoices ORDER BY created_at DESC
  `).all() as Invoice[];
}

// Get invoice line items
export function getInvoiceLineItems(invoiceId: number): InvoiceLineItem[] {
  ensureInvoicesTable();
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM invoice_line_items WHERE invoice_id = ? ORDER BY date
  `).all(invoiceId) as InvoiceLineItem[];
}

// Delete invoice
export function deleteInvoice(id: number): boolean {
  ensureInvoicesTable();
  const db = getDatabase();

  // Delete line items first (manual cascade)
  db.prepare('DELETE FROM invoice_line_items WHERE invoice_id = ?').run(id);

  const result = db.prepare('DELETE FROM invoices WHERE id = ?').run(id);
  return result.changes > 0;
}

// Update invoice status
export function updateInvoiceStatus(id: number, status: 'draft' | 'sent' | 'paid'): boolean {
  ensureInvoicesTable();
  const db = getDatabase();
  const result = db.prepare(`
    UPDATE invoices SET status = ? WHERE id = ?
  `).run(status, id);
  return result.changes > 0;
}
