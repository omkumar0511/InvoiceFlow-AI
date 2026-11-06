import {
  getAccessToken,
  generateInvoiceNumber,
  createDraftInvoice,
  sendInvoice,
  getInvoice,
  PayPalApiError,
} from "../lib/paypal";
import { env } from "../lib/env";

async function main() {
  console.log("=================================================");
  console.log("  InvoiceFlow AI - PayPal Sandbox Test Script    ");
  console.log("=================================================");
  console.log(`Base URL:       ${env.PAYPAL_BASE_URL}`);
  console.log(`Business Name:  ${env.BUSINESS_NAME}`);
  console.log(`Business Email: ${env.BUSINESS_EMAIL}`);
  console.log("-------------------------------------------------");

  try {
    // 1. Get Access Token
    console.log("1. Authenticating with PayPal Sandbox OAuth2...");
    const token = await getAccessToken();
    console.log(
      `   ✅ Access Token obtained (length: ${token.length}, prefix: ${token.substring(0, 8)}...)`
    );

    // 2. Generate Next Invoice Number
    console.log("2. Generating next invoice number...");
    let invoiceNumber: string;
    try {
      invoiceNumber = await generateInvoiceNumber();
      console.log(`   ✅ Generated Invoice Number: ${invoiceNumber}`);
    } catch (err: any) {
      console.warn(`   ⚠️ generateInvoiceNumber warning: ${err.message}. Using fallback number.`);
      invoiceNumber = `INV-${Date.now()}`;
    }

    // Calculate dates (today and due in 7 days)
    const today = new Date();
    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const formatDate = (d: Date) => d.toISOString().split("T")[0];

    const invoiceDateStr = formatDate(today);
    const dueDateStr = formatDate(dueDate);

    // 3. Create Draft Invoice
    console.log("3. Creating draft invoice...");
    console.log(`   - Client: Test Client <test-client@example.com>`);
    console.log(`   - Invoicer: ${env.BUSINESS_NAME} <${env.BUSINESS_EMAIL}>`);
    console.log(`   - Item: "Test Service" x 1 @ 10.00 USD`);
    console.log(`   - Invoice Date: ${invoiceDateStr}, Due Date: ${dueDateStr}`);

    const draft = await createDraftInvoice({
      detail: {
        invoice_number: invoiceNumber,
        invoice_date: invoiceDateStr,
        currency_code: env.DEFAULT_CURRENCY || "USD",
        note: "Thank you for testing InvoiceFlow AI!",
        payment_term: {
          term_type: "DUE_ON_DATE_SPECIFIED",
          due_date: dueDateStr,
        },
      },
      invoicer: {
        business_name: env.BUSINESS_NAME,
        email_address: env.BUSINESS_EMAIL,
        name: {
          given_name: env.BUSINESS_NAME.split(" ")[0] || "Test",
          surname: env.BUSINESS_NAME.split(" ").slice(1).join(" ") || "Business",
        },
      },
      primary_recipients: [
        {
          billing_info: {
            name: {
              given_name: "Test",
              surname: "Client",
            },
            email_address: "test-client@example.com",
          },
        },
      ],
      items: [
        {
          name: "Test Service",
          description: "Initial sandbox verification invoice item",
          quantity: "1",
          unit_amount: {
            currency_code: env.DEFAULT_CURRENCY || "USD",
            value: "10.00",
          },
        },
      ],
    });

    console.log(`   ✅ Draft invoice created! ID: ${draft.id}, Status: ${draft.status || "DRAFT"}`);

    // 4. Send Invoice
    console.log(`4. Sending invoice ${draft.id}...`);
    const sendResult = await sendInvoice(draft.id, {
      subject: "Test Invoice from InvoiceFlow AI",
      note: "This is a test invoice created in the PayPal Sandbox.",
      send_to_invoicer: false,
      send_to_recipient: true,
    });
    console.log(`   ✅ Invoice sent successfully! Result:`, sendResult);

    // 5. Fetch Invoice back
    console.log(`5. Fetching invoice ${draft.id} back to verify status...`);
    const fetchedInvoice = await getInvoice(draft.id);

    console.log("-------------------------------------------------");
    console.log("🎉 SUCCESSFUL VERIFICATION RESULT:");
    console.log(`   Invoice ID:     ${fetchedInvoice.id}`);
    console.log(`   Status:         ${fetchedInvoice.status}`);
    console.log(`   Invoice Number: ${fetchedInvoice.detail?.invoice_number}`);
    console.log(`   Invoice Date:   ${fetchedInvoice.detail?.invoice_date}`);
    console.log(`   Due Date:       ${fetchedInvoice.detail?.payment_term?.due_date}`);
    console.log(
      `   Total Amount:   ${fetchedInvoice.amount?.currency_code} ${fetchedInvoice.amount?.value}`
    );
    console.log("=================================================");
  } catch (error: any) {
    console.error("\n❌ PAYPAL OPERATION FAILED:");
    if (error instanceof PayPalApiError) {
      console.error(error.toDetailedString());
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

main();
