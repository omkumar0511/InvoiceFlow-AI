import { NextRequest, NextResponse } from "next/server";
import { recordPayment, getInvoice, PayPalApiError } from "@/lib/paypal";

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

    const todayStr = new Date().toISOString().split("T")[0];

    // 1. Record payment with PayPal
    await recordPayment(id, {
      method: "OTHER",
      payment_date: todayStr,
      note: "Paid in full (Recorded via InvoiceFlow AI Sandbox Demo)",
    });

    // 2. Fetch updated invoice
    const updatedInvoice = await getInvoice(id);

    return NextResponse.json({
      success: true,
      data: updatedInvoice,
    });
  } catch (error: any) {
    console.error("POST /api/invoices/[id]/pay error:", error);

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
        error: error?.message || "Failed to record payment in PayPal.",
      },
      { status: 500 }
    );
  }
}
