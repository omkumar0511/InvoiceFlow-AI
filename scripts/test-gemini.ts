import { parseInvoice } from "../lib/parser";
import { env } from "../lib/env";

async function main() {
  console.log("=================================================");
  console.log("  InvoiceFlow AI - Gemini Live Parser Test       ");
  console.log("=================================================");
  console.log(`Configured Model: ${env.LLM_MODEL}`);
  console.log("-------------------------------------------------");

  const samplePrompt =
    "Invoice Rahul Mehta (rahul@example.com) $450 for logo design and $120 for two revisions, due in 15 days";

  console.log(`Prompt to parse:\n"${samplePrompt}"\n`);
  console.log("Calling Google Gemini via @google/genai...");

  try {
    const startTime = Date.now();
    const result = await parseInvoice(samplePrompt);
    const duration = Date.now() - startTime;

    console.log(`\n✅ PARSING SUCCESSFUL in ${duration}ms!`);
    console.log(`Model Used: ${result.modelUsed}`);
    if (result.usage) {
      console.log(
        `Token Usage: Prompt = ${result.usage.promptTokens}, Candidates = ${result.usage.candidatesTokens}, Total = ${result.usage.totalTokens}`
      );
    }

    console.log("\nParsed Invoice JSON:");
    console.log(JSON.stringify(result.invoice, null, 2));

    console.log("\nSummary Verification:");
    console.log(`- Client Name:     ${result.invoice.client_name}`);
    console.log(`- Client Email:    ${result.invoice.client_email}`);
    console.log(`- Currency:        ${result.invoice.currency}`);
    console.log(`- Items Count:     ${result.invoice.items.length}`);
    result.invoice.items.forEach((item, idx) => {
      console.log(
        `   Item ${idx + 1}: ${item.name} | Qty: ${item.quantity} | Unit Price: ${item.unit_price}`
      );
    });
    console.log(`- Due In Days:     ${result.invoice.due_in_days}`);
    console.log(`- Due Date:        ${result.invoice.due_date}`);
    console.log(`- Missing Fields:  [${result.invoice.missing_fields.join(", ")}]`);
    console.log(`- Confidence:      ${result.invoice.confidence}`);
    console.log("=================================================");
  } catch (err: any) {
    console.error("\n❌ GEMINI PARSE FAILED:");
    console.error(err);
    process.exit(1);
  }
}

main();
