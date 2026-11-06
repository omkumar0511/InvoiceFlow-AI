import { listInvoices, getInvoice, recordPayment, sendReminder } from "../lib/paypal";
import { dbOperations } from "../lib/db";
import { getLLMProvider } from "../lib/llm";
import {
  buildReminderUserPrompt,
  geminiReminderResponseSchema,
  REMINDER_SYSTEM_INSTRUCTION,
  buildBusinessSummaryUserPrompt,
  geminiSummaryResponseSchema,
  BUSINESS_SUMMARY_SYSTEM_INSTRUCTION,
} from "../lib/prompts";
import { reminderOutputSchema, businessSummarySchema } from "../lib/schemas";
import { env } from "../lib/env";
import { GET as getInvoicesRoute } from "../app/api/invoices/route";
import { GET as getSummaryRoute } from "../app/api/summary/route";
import { NextRequest } from "next/server";

async function runPhase5Verification() {
  console.log("=============================================================");
  console.log("  InvoiceFlow AI - Phase 5 Verification (Reminders & Summary)");
  console.log("=============================================================");

  // 1. Get an existing invoice
  console.log("1. Finding a target invoice for reminder & payment test...");
  const listRes = await listInvoices({ pageSize: 10 });
  const invoices = listRes.items || [];
  if (invoices.length === 0) {
    throw new Error("No invoices found in sandbox. Run phase 3 or 4 first.");
  }

  // Pick first unpaid sent invoice or first invoice
  const targetInvoice =
    invoices.find((i) => i.status === "SENT") || invoices[0];
  console.log(`   Target Invoice: ${targetInvoice.id} (#${targetInvoice.detail?.invoice_number})`);
  console.log(`   Client: ${targetInvoice.primary_recipients?.[0]?.billing_info?.email_address}`);
  console.log(`   Amount: ${targetInvoice.amount?.currency_code} ${targetInvoice.amount?.value}`);
  console.log(`   Current Status: ${targetInvoice.status}`);

  // 2. Test AI Reminder Drafter
  console.log("\n2. Testing AI Reminder Drafter (Gemini)...");
  const provider = getLLMProvider();
  const tones = ["friendly", "firm"] as const;

  for (const tone of tones) {
    console.log(`   - Generating "${tone}" tone reminder...`);
    const prompt = buildReminderUserPrompt({
      clientName:
        targetInvoice.primary_recipients?.[0]?.billing_info?.name?.full_name ||
        "Valued Client",
      invoiceNumber: targetInvoice.detail?.invoice_number || "0001",
      amount: targetInvoice.amount?.value || "10.00",
      currency: targetInvoice.amount?.currency_code || "USD",
      dueDate: targetInvoice.detail?.payment_term?.due_date || "2026-11-20",
      daysDiff: 3, // 3 days overdue
      tone,
      businessName: env.BUSINESS_NAME,
    });

    const aiRes = await provider.generateStructured({
      prompt,
      systemInstruction: REMINDER_SYSTEM_INSTRUCTION,
      responseSchema: geminiReminderResponseSchema,
      validate: (raw) => reminderOutputSchema.parse(raw),
    });

    console.log(`   ✅ Tone [${tone.toUpperCase()}] Drafted:`);
    console.log(`      Subject: ${aiRes.data.subject}`);
    console.log(`      Message preview: ${aiRes.data.message.slice(0, 100)}...`);
  }

  // 3. Test Sending Reminder via PayPal & Storing in SQLite
  console.log("\n3. Sending Payment Reminder via PayPal Sandbox...");
  const testSubject = `Payment Reminder: Invoice #${targetInvoice.detail?.invoice_number}`;
  const testMessage = `Hi, this is a friendly reminder that invoice #${targetInvoice.detail?.invoice_number} is currently due. Thank you for your business!`;

  try {
    await sendReminder(targetInvoice.id, {
      subject: testSubject,
      note: testMessage,
    });
    console.log("   ✅ Reminder successfully sent via PayPal API!");
  } catch (err: any) {
    console.warn(`   ⚠️ PayPal Reminder notice: ${err.message}`);
  }

  // Store in SQLite
  dbOperations.saveReminder(targetInvoice.id, testSubject, testMessage);
  const remindersInDb = dbOperations.getReminders(targetInvoice.id);
  console.log(`   ✅ Reminder saved in SQLite! Total reminders for invoice: ${remindersInDb.length}`);

  // 4. Test Mark as Paid (Sandbox Demo)
  console.log("\n4. Marking invoice as PAID in PayPal Sandbox...");
  const todayStr = new Date().toISOString().split("T")[0];
  await recordPayment(targetInvoice.id, {
    method: "OTHER",
    payment_date: todayStr,
    note: "Paid in full (Sandbox Verification)",
  });

  const updatedInvoice = await getInvoice(targetInvoice.id);
  console.log(`   ✅ Invoice status in PayPal is now: ${updatedInvoice.status}`);

  // 5. Test Dashboard Stats & Summary Recalculation
  console.log("\n5. Testing Dashboard Stats & AI Business Summary Recalculation...");
  const invoicesReq = new NextRequest("http://localhost:3000/api/invoices");
  const invoicesRes = await getInvoicesRoute(invoicesReq);
  const invoicesJson = await invoicesRes.json();
  const updatedStats = invoicesJson.data.stats;

  console.log("   Updated Dashboard Stats:");
  console.log(`   - Total Invoiced: USD ${updatedStats.total_invoiced}`);
  console.log(`   - Total Paid:     USD ${updatedStats.paid}`);
  console.log(`   - Outstanding:    USD ${updatedStats.outstanding}`);
  console.log(`   - Paid Count:     ${updatedStats.counts.paid} of ${updatedStats.counts.total}`);

  // Test AI Summary Route
  console.log("\n   Calling GET /api/summary (Gemini AI Business Advisor)...");
  const summaryReq = new NextRequest("http://localhost:3000/api/summary?refresh=true");
  const summaryRes = await getSummaryRoute(summaryReq);
  const summaryJson = await summaryRes.json();
  const summaryData = summaryJson.data;

  console.log("-------------------------------------------------------------");
  console.log("🎉 AI BUSINESS SUMMARY GENERATED:");
  console.log(`   Narrative:\n   "${summaryData.narrative}"`);
  console.log(`\n   Actionable Suggestion:\n   "${summaryData.actionable_suggestion}"`);
  console.log(`   Cached: ${summaryData.cached}`);
  console.log("=============================================================");
}

runPhase5Verification().catch((err) => {
  console.error("Phase 5 verification failed:", err);
  process.exit(1);
});
