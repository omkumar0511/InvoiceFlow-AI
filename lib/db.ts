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

// Initialize tables as required:
// 1. invoices_meta (paypal_invoice_id, original_prompt, created_at)
// 2. reminders (invoice_id, subject, message, sent_at)
// 3. summaries (stats_hash, text, created_at)
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
};

export default db;
