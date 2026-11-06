import { NextRequest, NextResponse } from "next/server";
import { getInvoice, PayPalApiError } from "@/lib/paypal";
import { dbOperations } from "@/lib/db";

export async function GET(
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

    // 1. Fetch from PayPal
    const invoice = await getInvoice(id);

    // 2. Fetch local metadata from SQLite
    const meta = dbOperations.getInvoiceMeta(id);

    return NextResponse.json({
      success: true,
      data: {
        ...invoice,
        original_prompt: meta?.original_prompt || null,
        local_created_at: meta?.created_at || null,
      },
    });
  } catch (error: any) {
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
        error: error?.message || "Failed to fetch invoice details.",
      },
      { status: 500 }
    );
  }
}
