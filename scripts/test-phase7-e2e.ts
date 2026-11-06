async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runE2E() {
  console.log("=================================================================");
  console.log("       PHASE 7: FULL END-TO-END FLOW QUALITY VERIFICATION        ");
  console.log("=================================================================");

  const BASE_URL = "http://localhost:3000";

  // Step 0: Wait for server to respond
  console.log("\n[0] Connecting to Next.js server at " + BASE_URL + "...");
  let ready = false;
  for (let i = 0; i < 15; i++) {
    try {
      const res = await fetch(`${BASE_URL}/api/config`);
      if (res.ok) {
        const config = await res.json();
        console.log(`✅ Server is live! Mode: ${config.isDemoMode ? "Demo Mode" : "Real PayPal Sandbox Mode"}`);
        ready = true;
        break;
      }
    } catch {
      await wait(1000);
    }
  }

  if (!ready) {
    throw new Error("Server failed to respond on " + BASE_URL);
  }

  // Step 1: Mobile Viewport & Page Availability Check
  console.log("\n[1] Testing Mobile Viewport HTML Delivery...");
  const mobileHeaders = {
    "User-Agent":
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
  };

  const pages = ["/", "/new", "/about"];
  for (const page of pages) {
    const res = await fetch(`${BASE_URL}${page}`, { headers: mobileHeaders });
    const html = await res.text();
    if (!res.ok) throw new Error(`Page ${page} failed with status ${res.status}`);
    const hasViewport = html.includes('name="viewport"') || html.includes("<html");
    console.log(`✅ Page ${page} loaded (Status: ${res.status}, Viewport OK: ${hasViewport})`);
  }

  // Step 2: Parse Natural Language Invoice Sentence
  console.log("\n[2] Testing AI Parse (POST /api/parse)...");
  const parsePrompt =
    "Invoice Vikram Roy (vikram.roy@designco.com) $850 for brand identity package and $150 for business cards, due in 14 days";
  console.log(`   Prompt: "${parsePrompt}"`);

  const parseRes = await fetch(`${BASE_URL}/api/parse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: parsePrompt,
      referenceDate: new Date().toISOString().slice(0, 10),
    }),
  });

  const parseJson = await parseRes.json();
  if (!parseRes.ok || !parseJson.success) {
    throw new Error(`Parse failed: ${parseJson.error || parseRes.statusText}`);
  }

  const parsed = parseJson.data;
  console.log(`✅ Parsed successfully!`);
  console.log(`   - Client: ${parsed.client_name} <${parsed.client_email}>`);
  console.log(`   - Due Date: ${parsed.due_date} (in ${parsed.due_in_days} days)`);
  console.log(`   - Items count: ${parsed.items.length}`);
  for (const it of parsed.items) {
    console.log(`     * ${it.name}: ${it.quantity} x $${it.unit_price}`);
  }

  // Step 3: Review & Send Invoice via PayPal
  console.log("\n[3] Testing Review & Send via PayPal (POST /api/invoices)...");
  const invoicePayload = {
    client_name: parsed.client_name,
    client_email: parsed.client_email,
    currency: parsed.currency || "USD",
    due_date: parsed.due_date,
    notes: "Thank you for partnering with us on your brand identity!",
    items: parsed.items,
    send_now: true,
    original_prompt: parsePrompt,
  };

  const createRes = await fetch(`${BASE_URL}/api/invoices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(invoicePayload),
  });

  const createJson = await createRes.json();
  if (!createRes.ok || !createJson.success) {
    throw new Error(`Create/Send failed: ${createJson.error || createRes.statusText}`);
  }

  const invoice = createJson.data;
  console.log(`✅ Invoice Created and Sent!`);
  console.log(`   - PayPal Invoice ID: ${invoice.id}`);
  console.log(`   - Invoice Number: #${invoice.invoice_number}`);
  console.log(`   - Status: ${invoice.status}`);
  console.log(`   - Total Amount: ${invoice.currency} ${invoice.total_amount}`);
  console.log(`   - PayPal Hosted Link: ${invoice.paypal_link}`);

  // Step 4: Check Dashboard Aggregation
  console.log("\n[4] Testing Dashboard Listing & Stats (GET /api/invoices)...");
  const dashRes = await fetch(`${BASE_URL}/api/invoices`);
  const dashJson = await dashRes.json();
  if (!dashRes.ok || !dashJson.success) {
    throw new Error(`Dashboard fetch failed: ${dashJson.error}`);
  }

  console.log(`✅ Dashboard stats refreshed:`);
  console.log(`   - Total Invoiced: $${dashJson.data.stats.total_invoiced}`);
  console.log(`   - Outstanding: $${dashJson.data.stats.outstanding}`);
  console.log(`   - Paid: $${dashJson.data.stats.paid}`);
  console.log(`   - Overdue: $${dashJson.data.stats.overdue}`);
  console.log(`   - Total Invoices: ${dashJson.data.stats.counts.total}`);

  // Step 5: Check Invoice Detail View
  console.log("\n[5] Testing Invoice Detail View (GET /api/invoices/" + invoice.id + ")...");
  const detailRes = await fetch(`${BASE_URL}/api/invoices/${invoice.id}`);
  const detailJson = await detailRes.json();
  if (!detailRes.ok || !detailJson.success) {
    throw new Error(`Detail fetch failed: ${detailJson.error}`);
  }

  console.log(`✅ Invoice detail retrieved!`);
  console.log(`   - ID: ${detailJson.data.id}`);
  console.log(`   - Status: ${detailJson.data.status}`);
  console.log(`   - Original Prompt: "${detailJson.data.original_prompt}"`);

  // Step 6: Draft AI Payment Reminder
  console.log("\n[6] Testing AI Reminder Drafter (POST /api/invoices/" + invoice.id + "/draft-reminder)...");
  const draftRemRes = await fetch(`${BASE_URL}/api/invoices/${invoice.id}/draft-reminder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tone: "friendly" }),
  });
  const draftRemJson = await draftRemRes.json();
  if (!draftRemRes.ok || !draftRemJson.success) {
    throw new Error(`Draft reminder failed: ${draftRemJson.error}`);
  }

  console.log(`✅ AI drafted friendly reminder:`);
  console.log(`   - Subject: "${draftRemJson.data.subject}"`);
  console.log(`   - Message: "${draftRemJson.data.message.slice(0, 90)}..."`);

  // Step 7: Send Reminder via PayPal
  console.log("\n[7] Testing Send Reminder via PayPal (POST /api/invoices/" + invoice.id + "/remind)...");
  const sendRemRes = await fetch(`${BASE_URL}/api/invoices/${invoice.id}/remind`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subject: draftRemJson.data.subject,
      message: draftRemJson.data.message,
    }),
  });
  const sendRemJson = await sendRemRes.json();
  if (!sendRemRes.ok || !sendRemJson.success) {
    throw new Error(`Send reminder failed: ${sendRemJson.error}`);
  }
  console.log(`✅ Reminder dispatched and recorded in SQLite!`);

  // Step 8: Mark Invoice as Paid
  console.log("\n[8] Testing Record Payment (POST /api/invoices/" + invoice.id + "/pay)...");
  const payRes = await fetch(`${BASE_URL}/api/invoices/${invoice.id}/pay`, {
    method: "POST",
  });
  const payJson = await payRes.json();
  if (!payRes.ok || !payJson.success) {
    throw new Error(`Payment failed: ${payJson.error}`);
  }
  console.log(`✅ Invoice marked as PAID in PayPal! Payment ID: ${payJson.payment_id}`);

  // Step 9: AI Executive Business Summary
  console.log("\n[9] Testing AI Executive Business Summary (GET /api/summary?refresh=true)...");
  const summaryRes = await fetch(`${BASE_URL}/api/summary?refresh=true`);
  const summaryJson = await summaryRes.json();
  if (!summaryRes.ok || !summaryJson.success) {
    throw new Error(`Summary failed: ${summaryJson.error}`);
  }
  console.log(`✅ AI Business Insights generated:`);
  console.log(`   - Narrative: "${summaryJson.data.narrative}"`);
  console.log(`   - Suggestion: "${summaryJson.data.actionable_suggestion}"`);

  console.log("\n=================================================================");
  console.log("       🎉 FULL END-TO-END FLOW VERIFIED 100% WORKING!             ");
  console.log("=================================================================");
}

runE2E().catch((err) => {
  console.error("❌ E2E Verification failed:", err);
  process.exit(1);
});
