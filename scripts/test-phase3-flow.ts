import { parseInvoice } from "../lib/parser";
import {
  createDraftInvoice,
  generateInvoiceNumber,
  sendInvoice,
  getInvoice,
} from "../lib/paypal";
import { dbOperations } from "../lib/db";
import { env } from "../lib/env";
import { calculateInvoiceTotal, fromCents, toCents } from "../lib/money";

async function runEndToEndPhase3Test() {
  console.log("=============================================================");
  console.log("  InvoiceFlow AI - Phase 3 End-to-End Flow Verification      ");
  console.log("=============================================================");

  const examplePrompt =
    "Invoice Rahul Mehta (rahul@example.com) $450 for logo design and $120 for two revisions, due in 15 days";

  console.log("STEP 1: Parse Natural Language with Gemini AI");
  console.log(`Prompt: "${examplePrompt}"`);
  const parseResult = await parseInvoice(examplePrompt);
  console.log("✅ AI Parsed Result:");
  console.log(`   - Client:     ${parseResult.invoice.client_name} <${parseResult.invoice.client_email}>`);
  console.log(`   - Currency:   ${parseResult.invoice.currency}`);
  console.log(`   - Due Date:   ${parseResult.invoice.due_date} (in ${parseResult.invoice.due_in_days} days)`);
  console.log(`   - Items:      ${parseResult.invoice.items.length} items extracted`);
  parseResult.invoice.items.forEach((item, i) => {
    console.log(`     [${i + 1}] ${item.name} - Qty: ${item.quantity} @ $${item.unit_price}`);
  });
  console.log(`   - Confidence: ${parseResult.invoice.confidence}`);

  console.log("\nSTEP 2: Simulate User Edits in Review Form");
  // Simulate user adding a project note and an extra rush fee item
  const editedItems = [
    ...parseResult.invoice.items,
    {
      name: "Rush Delivery Fee",
      description: "Priority turnaround",
      quantity: 1,
      unit_price: 30,
    },
  ];
  const userNotes = "Priority delivery requested. Thank you for your business!";
  const calculatedTotal = calculateInvoiceTotal(editedItems);
  console.log(`   - Added item: Rush Delivery Fee ($30.00)`);
  console.log(`   - Updated Notes: "${userNotes}"`);
  console.log(`   - Exact Live Total: ${calculatedTotal.formatted} ${parseResult.invoice.currency}`);

  console.log("\nSTEP 3: Create & Send via PayPal Invoicing API (Sandbox)");
  const invoiceNumber = await generateInvoiceNumber();
  console.log(`   - Generated Next Invoice #: ${invoiceNumber}`);

  const todayStr = new Date().toISOString().split("T")[0];
  const draftPayload = {
    detail: {
      invoice_number: invoiceNumber,
      invoice_date: todayStr,
      currency_code: parseResult.invoice.currency,
      note: userNotes,
      payment_term: {
        term_type: "DUE_ON_DATE_SPECIFIED",
        due_date: parseResult.invoice.due_date || todayStr,
      },
    },
    invoicer: {
      business_name: env.BUSINESS_NAME,
      email_address: env.BUSINESS_EMAIL,
    },
    primary_recipients: [
      {
        billing_info: {
          name: {
            given_name: parseResult.invoice.client_name.split(" ")[0] || "Client",
            surname: parseResult.invoice.client_name.split(" ").slice(1).join(" ") || "",
          },
          email_address: parseResult.invoice.client_email || "rahul@example.com",
        },
      },
    ],
    items: editedItems.map((item) => ({
      name: item.name,
      description: item.description || undefined,
      quantity: String(item.quantity),
      unit_amount: {
        currency_code: parseResult.invoice.currency,
        value: fromCents(toCents(item.unit_price)),
      },
    })),
  };

  const draft = await createDraftInvoice(draftPayload);
  console.log(`✅ Draft Created: PayPal Invoice ID = ${draft.id}, Status = ${draft.status}`);

  console.log(`   - Sending Invoice ${draft.id} to recipient...`);
  const sendRes = await sendInvoice(draft.id, {
    subject: `Invoice #${invoiceNumber} from ${env.BUSINESS_NAME}`,
    note: userNotes,
  });
  console.log(`✅ Invoice Sent! Hosted Link: ${sendRes.href || `https://www.sandbox.paypal.com/invoice/p/#${draft.id}`}`);

  console.log("\nSTEP 4: Store in Local SQLite DB");
  dbOperations.saveInvoiceMeta(draft.id, examplePrompt);
  const meta = dbOperations.getInvoiceMeta(draft.id);
  console.log(`✅ Stored in SQLite: Invoice ID = ${meta?.paypal_invoice_id}, Prompt saved = "${meta?.original_prompt}"`);

  console.log("\nSTEP 5: Fetch from PayPal Sandbox to Confirm Live Existence");
  const liveInvoice = await getInvoice(draft.id);
  console.log("-------------------------------------------------------------");
  console.log("🎉 LIVE SANDBOX CONFIRMATION:");
  console.log(`   Invoice ID:      ${liveInvoice.id}`);
  console.log(`   Invoice Number:  ${liveInvoice.detail?.invoice_number}`);
  console.log(`   Status:          ${liveInvoice.status}`);
  console.log(`   Recipient:       ${liveInvoice.primary_recipients?.[0]?.billing_info?.email_address}`);
  console.log(`   Total Amount:    ${liveInvoice.amount?.currency_code} ${liveInvoice.amount?.value}`);
  console.log(`   Due Date:        ${liveInvoice.detail?.payment_term?.due_date}`);
  console.log(`   Line Items Count:${liveInvoice.items?.length}`);
  console.log("=============================================================");
}

runEndToEndPhase3Test().catch((err) => {
  console.error("Test flow failed:", err);
  process.exit(1);
});
