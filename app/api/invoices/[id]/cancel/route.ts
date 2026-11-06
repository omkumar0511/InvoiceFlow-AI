import { NextRequest, NextResponse } from "next/server";
import { cancelInvoice, getInvoice, PayPalApiError } from "@/lib/paypal";

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

    let note = "Invoice cancelled by merchant via InvoiceFlow AI.";
    try {
      const body = await req.json();
      if (body?.note) {
        note = body.note;
      }
    } catch {
      // Body is optional
    }

    // 1. Cancel in PayPal
    await cancelInvoice(id, {
      note,
      send_to_invoicer: false,
      send_to_recipient: true,
    });

    // 2. Fetch updated invoice details if possible
    let updatedInvoice: any = null;
    try {
      updatedInvoice = await getInvoice(id);
    } catch {
      updatedInvoice = { id, status: "CANCELLED" };
    }

    return NextResponse.json({
      success: true,
      message: "Invoice cancelled successfully.",
      data: updatedInvoice,
    });
  } catch (error: any) {
    console.error("POST /api/invoices/[id]/cancel error:", error);

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
        error: error?.message || "Failed to cancel invoice in PayPal.",
      },
      { status: 500 }
    );
  }
}
