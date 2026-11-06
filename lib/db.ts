import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

// Ensure data directory exists
const dbDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, "invoiceflow.db");

// Initialize SQLite database instance
const db = new Database(dbPath);

// Optimization pragmas
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Initialize tables:
// 1. invoices_meta (paypal_invoice_id, original_prompt, created_at)
// 2. reminders (invoice_id, subject, message, sent_at)
// 3. summaries (stats_hash, text, created_at)
// 4. mock_invoices (id, status, data_json, created_at, updated_at) for Demo Mode
db.exec(`
  CREATE TABLE IF NOT EXISTS invoices_meta (
    paypal_invoice_id TEXT PRIMARY KEY,
    original_prompt TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    sent_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_reminders_invoice_id ON reminders (invoice_id);

  CREATE TABLE IF NOT EXISTS summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stats_hash TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_summaries_stats_hash ON summaries (stats_hash);

  CREATE TABLE IF NOT EXISTS mock_invoices (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    data_json TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_mock_invoices_status ON mock_invoices (status);
`);

export interface InvoiceMeta {
  paypal_invoice_id: string;
  original_prompt: string | null;
  created_at: string;
}

export interface ReminderRecord {
  id: number;
  invoice_id: string;
  subject: string;
  message: string;
  sent_at: string;
}

export interface SummaryRecord {
  id: number;
  stats_hash: string;
  text: string;
  created_at: string;
}

export interface MockInvoiceRow {
  id: string;
  status: string;
  data_json: string;
  created_at: string;
  updated_at: string;
}

// Database helper functions
export const dbOperations = {
  saveInvoiceMeta(paypalInvoiceId: string, originalPrompt?: string | null): void {
    const stmt = db.prepare(`
      INSERT INTO invoices_meta (paypal_invoice_id, original_prompt)
      VALUES (?, ?)
      ON CONFLICT(paypal_invoice_id) DO UPDATE SET
        original_prompt = excluded.original_prompt
    `);
    stmt.run(paypalInvoiceId, originalPrompt ?? null);
  },

  getInvoiceMeta(paypalInvoiceId: string): InvoiceMeta | undefined {
    const stmt = db.prepare<[string], InvoiceMeta>(`
      SELECT paypal_invoice_id, original_prompt, created_at
      FROM invoices_meta
      WHERE paypal_invoice_id = ?
    `);
    return stmt.get(paypalInvoiceId);
  },

  saveReminder(invoiceId: string, subject: string, message: string): number {
    const stmt = db.prepare(`
      INSERT INTO reminders (invoice_id, subject, message)
      VALUES (?, ?, ?)
    `);
    const info = stmt.run(invoiceId, subject, message);
    return Number(info.lastInsertRowid);
  },

  getReminders(invoiceId: string): ReminderRecord[] {
    const stmt = db.prepare<[string], ReminderRecord>(`
      SELECT id, invoice_id, subject, message, sent_at
      FROM reminders
      WHERE invoice_id = ?
      ORDER BY sent_at DESC
    `);
    return stmt.all(invoiceId);
  },

  saveSummary(statsHash: string, text: string): number {
    const stmt = db.prepare(`
      INSERT INTO summaries (stats_hash, text)
      VALUES (?, ?)
    `);
    const info = stmt.run(statsHash, text);
    return Number(info.lastInsertRowid);
  },

  getSummaryByHash(statsHash: string): SummaryRecord | undefined {
    const stmt = db.prepare<[string], SummaryRecord>(`
      SELECT id, stats_hash, text, created_at
      FROM summaries
      WHERE stats_hash = ?
      ORDER BY created_at DESC
      LIMIT 1
    `);
    return stmt.get(statsHash);
  },

  // -------------------------------------------------------------------------
  // Demo Mode: Mock Invoices Operations
  // -------------------------------------------------------------------------
  saveMockInvoice(invoice: any): void {
    const stmt = db.prepare(`
      INSERT INTO mock_invoices (id, status, data_json, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        data_json = excluded.data_json,
        updated_at = datetime('now')
    `);
    stmt.run(invoice.id, invoice.status, JSON.stringify(invoice));
  },

  getMockInvoice(id: string): any | null {
    const stmt = db.prepare<[string], MockInvoiceRow>(`
      SELECT id, status, data_json, created_at, updated_at
      FROM mock_invoices
      WHERE id = ?
    `);
    const row = stmt.get(id);
    if (!row) return null;
    return JSON.parse(row.data_json);
  },

  listMockInvoices(page = 1, pageSize = 20): { items: any[]; total_items: number; total_pages: number } {
    this.seedMockInvoicesIfEmpty();

    const countRow = db
      .prepare("SELECT COUNT(*) as count FROM mock_invoices")
      .get() as { count: number } | undefined;
    const total = countRow?.count || 0;

    const offset = Math.max(0, (page - 1) * pageSize);
    const stmt = db.prepare<[number, number], MockInvoiceRow>(`
      SELECT id, status, data_json, created_at, updated_at
      FROM mock_invoices
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(pageSize, offset);
    const items = rows.map((r) => JSON.parse(r.data_json));

    return {
      items,
      total_items: total,
      total_pages: Math.ceil(total / pageSize) || 1,
    };
  },

  countMockInvoices(): number {
    const row = db
      .prepare("SELECT COUNT(*) as count FROM mock_invoices")
      .get() as { count: number } | undefined;
    return row?.count || 0;
  },

  seedMockInvoicesIfEmpty(): void {
    const count = this.countMockInvoices();
    if (count > 0) return;

    const today = new Date();
    const pastDueDate = new Date(today);
    pastDueDate.setDate(pastDueDate.getDate() - 5);
    const pastDueDateStr = pastDueDate.toISOString().slice(0, 10);

    const invoiceDateStr = new Date(today.getTime() - 20 * 86400000).toISOString().slice(0, 10);
    const recentDateStr = new Date(today.getTime() - 10 * 86400000).toISOString().slice(0, 10);
    const futureDueDateStr = new Date(today.getTime() + 15 * 86400000).toISOString().slice(0, 10);

    const demoInvoices = [
      {
        id: "INV2-DEMO-0001",
        status: "SENT",
        detail: {
          invoice_number: "INV2-0001",
          invoice_date: invoiceDateStr,
          currency_code: "USD",
          note: "Thanks for your business! Please remit payment promptly.",
          payment_term: {
            term_type: "DUE_ON_DATE_SPECIFIED",
            due_date: pastDueDateStr, // Overdue by 5 days
          },
          metadata: {
            create_time: `${invoiceDateStr}T10:00:00Z`,
          },
        },
        invoicer: {
          business_name: "InvoiceFlow Studio (Demo)",
          email_address: "billing@invoiceflow.demo",
        },
        primary_recipients: [
          {
            billing_info: {
              name: { given_name: "Rahul", surname: "Mehta" },
              email_address: "rahul@example.com",
            },
          },
        ],
        items: [
          {
            name: "Logo design",
            quantity: "1",
            unit_amount: { currency_code: "USD", value: "450.00" },
          },
          {
            name: "Two revisions",
            quantity: "2",
            unit_amount: { currency_code: "USD", value: "60.00" },
          },
        ],
        amount: {
          currency_code: "USD",
          value: "570.00",
          breakdown: {
            item_total: { currency_code: "USD", value: "570.00" },
          },
        },
        links: [
          {
            href: "https://www.sandbox.paypal.com/invoice/p/#DEMO-0001",
            rel: "self",
            method: "GET",
          },
          {
            href: "https://www.sandbox.paypal.com/invoice/p/#DEMO-0001",
            rel: "payer-view",
            method: "GET",
          },
        ],
      },
      {
        id: "INV2-DEMO-0002",
        status: "MARKED_AS_PAID",
        detail: {
          invoice_number: "INV2-0002",
          invoice_date: recentDateStr,
          currency_code: "USD",
          note: "Fullstack engineering consultation sprint #4.",
          payment_term: {
            term_type: "NET_30",
            due_date: futureDueDateStr,
          },
          metadata: {
            create_time: `${recentDateStr}T09:30:00Z`,
          },
        },
        invoicer: {
          business_name: "InvoiceFlow Studio (Demo)",
          email_address: "billing@invoiceflow.demo",
        },
        primary_recipients: [
          {
            billing_info: {
              name: { given_name: "TechStudio", surname: "Finance" },
              email_address: "finance@techstudio.io",
            },
          },
        ],
        items: [
          {
            name: "Fullstack Web Development",
            description: "40 hours at $85/hr",
            quantity: "40",
            unit_amount: { currency_code: "USD", value: "85.00" },
          },
        ],
        amount: {
          currency_code: "USD",
          value: "3400.00",
          breakdown: {
            item_total: { currency_code: "USD", value: "3400.00" },
          },
        },
        payments: {
          paid_amount: { currency_code: "USD", value: "3400.00" },
        },
        links: [
          {
            href: "https://www.sandbox.paypal.com/invoice/p/#DEMO-0002",
            rel: "self",
            method: "GET",
          },
        ],
      },
      {
        id: "INV2-DEMO-0003",
        status: "DRAFT",
        detail: {
          invoice_number: "INV2-0003",
          invoice_date: new Date().toISOString().slice(0, 10),
          currency_code: "EUR",
          note: "Design system guidelines and complete UX review audit.",
          payment_term: {
            term_type: "DUE_ON_DATE_SPECIFIED",
            due_date: futureDueDateStr,
          },
          metadata: {
            create_time: new Date().toISOString(),
          },
        },
        invoicer: {
          business_name: "InvoiceFlow Studio (Demo)",
          email_address: "billing@invoiceflow.demo",
        },
        primary_recipients: [
          {
            billing_info: {
              name: { given_name: "Sophie", surname: "Laurent" },
              email_address: "sophie.l@design.fr",
            },
          },
        ],
        items: [
          {
            name: "UI/UX Audit",
            quantity: "1",
            unit_amount: { currency_code: "EUR", value: "750.00" },
          },
          {
            name: "Design System Guidelines",
            quantity: "1",
            unit_amount: { currency_code: "EUR", value: "250.00" },
          },
        ],
        amount: {
          currency_code: "EUR",
          value: "1000.00",
          breakdown: {
            item_total: { currency_code: "EUR", value: "1000.00" },
          },
        },
        links: [
          {
            href: "https://www.sandbox.paypal.com/invoice/p/#DEMO-0003",
            rel: "self",
            method: "GET",
          },
        ],
      },
    ];

    for (const inv of demoInvoices) {
      this.saveMockInvoice(inv);
      this.saveInvoiceMeta(
        inv.id,
        `Demo seed invoice created for ${inv.primary_recipients[0].billing_info.email_address}`
      );
    }
  },
};

export default db;
