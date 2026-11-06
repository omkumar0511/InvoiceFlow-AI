import { NextRequest, NextResponse } from "next/server";
import { createInvoiceRequestSchema } from "@/lib/schemas";
import {
  createDraftInvoice,
  generateInvoiceNumber,
  sendInvoice,
  getInvoice,
  PayPalApiError,
} from "@/lib/paypal";
import { dbOperations } from "@/lib/db";
import { env } from "@/lib/env";
import { fromCents, toCents, calculateInvoiceTotal } from "@/lib/money";

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const validation = createInvoiceRequestSchema.safeParse(body);
    if (!validation.success) {
      const issues = validation.error.issues.map((i) => i.message).join(", ");
      return NextResponse.json(
        { success: false, error: issues },
        { status: 400 }
      );
    }

    const data = validation.data;
    const todayStr = new Date().toISOString().split("T")[0];

    // 1. Generate next invoice number
    let invoiceNumber: string;
    try {
      invoiceNumber = await generateInvoiceNumber();
    } catch (err: any) {
      console.warn("Could not generate invoice number via PayPal, using fallback:", err.message);
      invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
    }

    // 2. Format line items with safe money formatting
    const formattedItems = data.items.map((item) => ({
      name: item.name,
      description: item.description || undefined,
      quantity: String(item.quantity),
      unit_amount: {
        currency_code: data.currency,
        value: fromCents(toCents(item.unit_price)),
      },
    }));

    // Split names into given / surname for PayPal schema
    const clientNameParts = data.client_name.trim().split(/\s+/);
    const clientGivenName = clientNameParts[0] || "Client";
    const clientSurname = clientNameParts.slice(1).join(" ") || "";

    const invoicerNameParts = env.BUSINESS_NAME.trim().split(/\s+/);
    const invoicerGivenName = invoicerNameParts[0] || "Business";
    const invoicerSurname = invoicerNameParts.slice(1).join(" ") || "";

    // 3. Create Draft Invoice in PayPal Sandbox
    const draftPayload = {
      detail: {
        invoice_number: invoiceNumber,
        invoice_date: todayStr,
        currency_code: data.currency,
        note: data.notes || undefined,
        payment_term: {
          term_type: "DUE_ON_DATE_SPECIFIED",
          due_date: data.due_date,
        },
      },
      invoicer: {
        business_name: env.BUSINESS_NAME,
        email_address: env.BUSINESS_EMAIL,
        name: {
          given_name: invoicerGivenName,
          surname: invoicerSurname,
        },
      },
      primary_recipients: [
        {
          billing_info: {
            name: {
              given_name: clientGivenName,
              surname: clientSurname,
            },
            email_address: data.client_email,
          },
        },
      ],
      items: formattedItems,
    };

    let invoice = await createDraftInvoice(draftPayload);

    let sendHref: string | undefined = undefined;

    // 4. Optionally Send via PayPal
    if (data.send_now && invoice.id) {
      const sendRes = await sendInvoice(invoice.id, {
        subject: `Invoice #${invoiceNumber} from ${env.BUSINESS_NAME}`,
        note: data.notes || "Thank you for your business!",
        send_to_invoicer: false,
        send_to_recipient: true,
      });

      sendHref = sendRes.href;

      // Fetch fresh status
      try {
        invoice = await getInvoice(invoice.id);
      } catch (e: any) {
        console.warn("Could not refetch sent invoice status:", e.message);
      }
    }

    // 5. Save metadata and original prompt in SQLite
    if (invoice.id) {
      dbOperations.saveInvoiceMeta(invoice.id, data.original_prompt || null);
    }

    // Compute live total safely
    const totalCalc = calculateInvoiceTotal(data.items);

    return NextResponse.json({
      success: true,
      data: {
        id: invoice.id,
        invoice_number: invoice.detail?.invoice_number || invoiceNumber,
        status: invoice.status || (data.send_now ? "SENT" : "DRAFT"),
        client_name: data.client_name,
        client_email: data.client_email,
        due_date: data.due_date,
        currency: data.currency,
        total_amount: totalCalc.formatted,
        paypal_link:
          sendHref || `https://www.sandbox.paypal.com/invoice/p/#${invoice.id}`,
        sent: data.send_now,
      },
    });
  } catch (error: any) {
    console.error("POST /api/invoices error:", error);

    if (error instanceof PayPalApiError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          error_name: error.errorName,
          debug_id: error.debugId,
          details: error.details,
        },
        { status: error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to create invoice with PayPal.",
      },
      { status: 500 }
    );
  }
}
