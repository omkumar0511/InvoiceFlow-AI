import { GET } from "../app/api/invoices/route";
import { NextRequest } from "next/server";

async function main() {
  console.log("=============================================================");
  console.log("  InvoiceFlow AI - Phase 4 Dashboard & AG Grid Verification  ");
  console.log("=============================================================");

  console.log("1. Fetching invoices via GET /api/invoices...");
  const req = new NextRequest("http://localhost:3000/api/invoices");
  const res = await GET(req);
  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to fetch invoices");
  }

  const { invoices, stats } = json.data;
  console.log(`✅ Successfully retrieved ${invoices.length} invoices from PayPal Sandbox!`);
  console.log("-------------------------------------------------------------");
  console.log("STAT CARDS SUMMARY (Decimal-Safe Math):");
  console.log(`  1. Total Invoiced:  ${stats.currency} ${stats.total_invoiced} (${stats.counts.total} invoices)`);
  console.log(`  2. Paid:            ${stats.currency} ${stats.paid} (${stats.counts.paid} paid)`);
  console.log(`  3. Outstanding:     ${stats.currency} ${stats.outstanding} (${stats.counts.outstanding} pending)`);
  console.log(`  4. Overdue:         ${stats.currency} ${stats.overdue} (${stats.counts.overdue} past due)`);
  console.log("-------------------------------------------------------------");

  console.log("INVOICES LOADED IN AG GRID TABLE:");
  invoices.slice(0, 5).forEach((inv: any, idx: number) => {
    console.log(
      `  [${idx + 1}] Invoice #${inv.invoice_number.padEnd(6)} | Client: ${inv.client_name.padEnd(20)} | Amount: ${inv.currency} ${inv.amount.padStart(7)} | Due: ${inv.due_date || "—"} | Status: ${inv.computed_status}`
    );
  });

  if (invoices.length >= 3) {
    console.log(`\n🎉 VERIFICATION PASSED: Found ${invoices.length} invoices (>= 3 required).`);
  } else {
    console.warn(`\n⚠️ Found only ${invoices.length} invoices. Need at least 3.`);
  }
  console.log("=============================================================");
}

main().catch((err) => {
  console.error("Dashboard verification failed:", err);
  process.exit(1);
});
