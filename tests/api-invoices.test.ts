import { describe, it, expect, vi } from "vitest";
import { POST } from "../app/api/invoices/route";
import { GET } from "../app/api/invoices/[id]/route";
import { NextRequest } from "next/server";
import * as paypal from "../lib/paypal";
import { dbOperations } from "../lib/db";

describe("API /api/invoices Endpoints", () => {
  it("rejects invalid request bodies with 400 (e.g. past due date)", async () => {
    const pastDate = "2020-01-01";
    const req = new NextRequest("http://localhost:3000/api/invoices", {
      method: "POST",
      body: JSON.stringify({
        client_name: "Test Client",
        client_email: "test@example.com",
        due_date: pastDate,
        currency: "USD",
        items: [{ name: "Service", quantity: 1, unit_price: 100 }],
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("Due date cannot be in the past");
  });

  it("creates a draft invoice and stores prompt in SQLite", async () => {
    // Mock PayPal functions to test endpoint logic cleanly
    const mockInvoiceId = "INV2-MOCK-DRAFT-001";
    vi.spyOn(paypal, "generateInvoiceNumber").mockResolvedValue("0099");
    vi.spyOn(paypal, "createDraftInvoice").mockResolvedValue({
      id: mockInvoiceId,
      status: "DRAFT",
      detail: {
        invoice_number: "0099",
        invoice_date: "2026-11-06",
        currency_code: "USD",
      },
    });

    const futureDate = new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0];

    const req = new NextRequest("http://localhost:3000/api/invoices", {
      method: "POST",
      body: JSON.stringify({
        client_name: "Rahul Mehta",
        client_email: "rahul@example.com",
        due_date: futureDate,
        currency: "USD",
        notes: "Thank you for the logo design work!",
        items: [
          { name: "Logo Design", quantity: 1, unit_price: 450 },
          { name: "Revisions", quantity: 2, unit_price: 60 },
        ],
        send_now: false,
        original_prompt: "Invoice Rahul Mehta $450 for logo and $120 for revisions",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.id).toBe(mockInvoiceId);
    expect(json.data.invoice_number).toBe("0099");
    expect(json.data.status).toBe("DRAFT");
    expect(json.data.total_amount).toBe("570.00"); // 450 + 120 = 570

    // Verify stored prompt in SQLite
    const meta = dbOperations.getInvoiceMeta(mockInvoiceId);
    expect(meta).toBeDefined();
    expect(meta?.original_prompt).toContain("Invoice Rahul Mehta $450");
  });

  it("retrieves invoice details via GET /api/invoices/[id]", async () => {
    const mockId = "INV2-MOCK-GET-002";
    dbOperations.saveInvoiceMeta(mockId, "Original prompt for get test");

    vi.spyOn(paypal, "getInvoice").mockResolvedValue({
      id: mockId,
      status: "SENT",
      detail: {
        invoice_number: "0100",
        invoice_date: "2026-11-06",
        currency_code: "USD",
      },
      amount: {
        currency_code: "USD",
        value: "250.00",
      },
    });

    const req = new NextRequest(`http://localhost:3000/api/invoices/${mockId}`);
    const res = await GET(req, { params: { id: mockId } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.id).toBe(mockId);
    expect(json.data.original_prompt).toBe("Original prompt for get test");
    expect(json.data.status).toBe("SENT");
  });
});
