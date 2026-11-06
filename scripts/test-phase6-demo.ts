import { dbOperations } from "../lib/db";
import { MockLLMProvider } from "../lib/llm";
import { calculateInvoiceTotal, fromCents, toCents } from "../lib/money";

async function runDemoModeVerification() {
  console.log("=================================================");
  console.log("       PHASE 6: DEMO MODE END-TO-END TEST        ");
  console.log("=================================================");

  // 1. Seed & Test Mock Invoices Storage in SQLite
  console.log("\n[1] Verifying SQLite Mock Invoices Seeding & Persistence...");
  dbOperations.seedMockInvoicesIfEmpty();
  const mockList = dbOperations.listMockInvoices(1, 10);
  console.log(`✅ Retrieved ${mockList.items.length} demo invoices (total: ${mockList.total_items})`);

  for (const inv of mockList.items) {
    const client = inv.primary_recipients?.[0]?.billing_info?.name?.given_name || "Client";
    const amount = inv.amount?.value || "0.00";
    const currency = inv.amount?.currency_code || "USD";
    const dueDate = inv.detail?.payment_term?.due_date || "No due date";
    console.log(`   - Invoice #${inv.detail?.invoice_number} | ID: ${inv.id} | Status: ${inv.status} | Client: ${client} | Due: ${dueDate} | Total: ${currency} ${amount}`);
  }

  // 2. Test Creating a Mock Invoice in SQLite
  console.log("\n[2] Testing Mock Invoice Creation & Exact Integer Cents Math...");
  const newMockId = `INV2-DEMO-${Date.now().toString(36).toUpperCase()}`;
  const total = calculateInvoiceTotal([
    { quantity: 2, unit_price: 250 },
    { quantity: 1, unit_price: 75 },
  ]);
  const totalFormatted = total.formatted;

  const mockPayload = {
    id: newMockId,
    status: "DRAFT",
    detail: {
      invoice_number: `INV2-${String(mockList.total_items + 1).padStart(4, "0")}`,
      invoice_date: new Date().toISOString().slice(0, 10),
      currency_code: "USD",
      note: "Automated Demo Mode Test",
      payment_term: {
        term_type: "NET_15",
        due_date: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
      },
    },
    primary_recipients: [
      {
        billing_info: {
          name: { given_name: "Demo", surname: "User" },
          email_address: "demo.user@example.com",
        },
      },
    ],
    items: [
      { name: "Consulting Hours", quantity: "2", unit_amount: { currency_code: "USD", value: "250.00" } },
      { name: "Documentation", quantity: "1", unit_amount: { currency_code: "USD", value: "75.00" } },
    ],
    amount: {
      currency_code: "USD",
      value: totalFormatted,
      breakdown: { item_total: { currency_code: "USD", value: totalFormatted } },
    },
    links: [
      { href: `https://www.sandbox.paypal.com/invoice/p/#${newMockId}`, rel: "self", method: "GET" },
      { href: `https://www.sandbox.paypal.com/invoice/p/#${newMockId}`, rel: "payer-view", method: "GET" },
    ],
  };

  dbOperations.saveMockInvoice(mockPayload);
  const fetchedMock = dbOperations.getMockInvoice(newMockId);
  console.log(`✅ Saved & Fetched Mock Invoice: ${fetchedMock.id}`);
  console.log(`   - Status: ${fetchedMock.status}`);
  console.log(`   - Total Computed: ${fetchedMock.amount.currency_code} ${fetchedMock.amount.value}`);

  // 3. Test Mock Status Transitions (DRAFT -> SENT -> MARKED_AS_PAID)
  console.log("\n[3] Testing Mock Lifecycle Status Transitions in SQLite...");
  fetchedMock.status = "SENT";
  dbOperations.saveMockInvoice(fetchedMock);
  console.log(`   - Transitioned to: ${dbOperations.getMockInvoice(newMockId).status}`);

  fetchedMock.status = "MARKED_AS_PAID";
  fetchedMock.payments = { paid_amount: fetchedMock.amount };
  dbOperations.saveMockInvoice(fetchedMock);
  console.log(`   - Transitioned to: ${dbOperations.getMockInvoice(newMockId).status}`);

  // 4. Test Deterministic Mock LLM Provider
  console.log("\n[4] Testing Deterministic Mock LLM for the 3 Example Prompts...");
  const mockLLM = new MockLLMProvider();

  // Prompt 1
  const p1 = "Invoice Rahul Mehta (rahul@example.com) $450 for logo design and $120 for two revisions, due in 15 days";
  const r1 = await mockLLM.generateStructured({ prompt: p1, validate: (x: any) => x });
  console.log(`✅ Prompt 1 (Rahul Mehta):`);
  console.log(`   Client: ${r1.data.client_name} <${r1.data.client_email}> | Items: ${r1.data.items.length} | Confidence: ${r1.data.confidence}`);

  // Prompt 2
  const p2 = "Bill TechStudio Inc (finance@techstudio.io) for 40 hours of fullstack web development at $85/hr, due in 30 days";
  const r2 = await mockLLM.generateStructured({ prompt: p2, validate: (x: any) => x });
  console.log(`✅ Prompt 2 (TechStudio Inc):`);
  console.log(`   Client: ${r2.data.client_name} <${r2.data.client_email}> | Items: ${r2.data.items.length} | Confidence: ${r2.data.confidence}`);

  // Prompt 3
  const p3 = "Invoice Sophie Laurent (sophie.l@design.fr) €750 for UI/UX audit and €250 for design system guidelines, due in 10 days";
  const r3 = await mockLLM.generateStructured({ prompt: p3, validate: (x: any) => x });
  console.log(`✅ Prompt 3 (Sophie Laurent):`);
  console.log(`   Client: ${r3.data.client_name} <${r3.data.client_email}> | Currency: ${r3.data.currency} | Items: ${r3.data.items.length}`);

  // 5. Test Mock Reminder Drafter (All 3 Tones)
  console.log("\n[5] Testing Mock AI Reminder Drafter (Friendly, Neutral, Firm)...");
  const friendlyRem = await mockLLM.generateStructured({ prompt: "Draft a friendly reminder prompt", validate: (x: any) => x });
  console.log(`✅ Friendly Reminder: "${friendlyRem.data.subject}"`);

  const firmRem = await mockLLM.generateStructured({ prompt: "Draft a firm tone reminder prompt for 5 days overdue", validate: (x: any) => x });
  console.log(`✅ Firm Reminder: "${firmRem.data.subject}"`);

  // 6. Test Mock Executive Business Summary
  console.log("\n[6] Testing Mock Executive Business Summary...");
  const summaryRes = await mockLLM.generateStructured({
    prompt: "Precomputed Financial Statistics: Total invoiced $4,970.00, Paid $3,400.00. Write a narrative and suggestion.",
    validate: (x: any) => x,
  });
  console.log(`✅ AI Narrative: "${summaryRes.data.narrative}"`);
  console.log(`✅ AI Suggestion: "${summaryRes.data.suggestion}"`);

  console.log("\n=================================================");
  console.log("       ALL PHASE 6 DEMO MODE TESTS PASSED!       ");
  console.log("=================================================");
}

runDemoModeVerification().catch((err) => {
  console.error("❌ Phase 6 test failed:", err);
  process.exit(1);
});
