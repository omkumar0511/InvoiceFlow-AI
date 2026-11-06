import { describe, it, expect } from "vitest";
import { dbOperations } from "../lib/db";

describe("Database Foundation", () => {
  it("should create and retrieve invoice metadata", () => {
    const invoiceId = "TEST-INV-Vitest-001";
    const prompt = "Invoice John $500 for web design";
    dbOperations.saveInvoiceMeta(invoiceId, prompt);

    const record = dbOperations.getInvoiceMeta(invoiceId);
    expect(record).toBeDefined();
    expect(record?.paypal_invoice_id).toBe(invoiceId);
    expect(record?.original_prompt).toBe(prompt);
  });
});
