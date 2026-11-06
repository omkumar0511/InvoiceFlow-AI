import { NextRequest, NextResponse } from "next/server";
import { parseRequestSchema } from "@/lib/schemas";
import { parseInvoice } from "@/lib/parser";
import { BusyAIError } from "@/lib/llm";

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

    const validation = parseRequestSchema.safeParse(body);
    if (!validation.success) {
      const errorMsg = validation.error.issues
        .map((i) => i.message)
        .join(", ");
      return NextResponse.json(
        { success: false, error: errorMsg },
        { status: 400 }
      );
    }

    const { prompt, referenceDate } = validation.data;
    const result = await parseInvoice(prompt, { referenceDate });

    return NextResponse.json({
      success: true,
      data: result.invoice,
      meta: {
        modelUsed: result.modelUsed,
        usage: result.usage,
      },
    });
  } catch (error: any) {
    if (error instanceof BusyAIError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 429 }
      );
    }

    console.error("API /api/parse error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "An error occurred while parsing the invoice description.",
      },
      { status: 500 }
    );
  }
}
