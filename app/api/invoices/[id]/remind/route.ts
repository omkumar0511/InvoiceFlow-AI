import { NextRequest, NextResponse } from "next/server";
import { sendReminder, PayPalApiError } from "@/lib/paypal";
import { dbOperations } from "@/lib/db";
import { sendReminderBodySchema } from "@/lib/schemas";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing invoice ID" },
        { status: 400 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const validation = sendReminderBodySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.issues.map((i) => i.message).join(", "),
        },
        { status: 400 }
      );
    }

    const { subject, message } = validation.data;

    // 1. Send via PayPal Invoicing API
    await sendReminder(id, {
      subject,
      note: message,
      send_to_invoicer: false,
      send_to_recipient: true,
    });

    // 2. Persist in SQLite reminders table
    const reminderId = dbOperations.saveReminder(id, subject, message);

    return NextResponse.json({
      success: true,
      data: {
        id: reminderId,
        invoice_id: id,
        subject,
        message,
        sent_at: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("POST /api/invoices/[id]/remind error:", error);

    if (error instanceof PayPalApiError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          error_name: error.errorName,
          debug_id: error.debugId,
        },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to send reminder via PayPal.",
      },
      { status: 500 }
    );
  }
}
