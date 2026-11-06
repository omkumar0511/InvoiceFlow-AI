import { NextRequest, NextResponse } from "next/server";
import { getInvoice, PayPalApiError } from "@/lib/paypal";
import { getLLMProvider } from "@/lib/llm";
import {
  buildReminderUserPrompt,
  geminiReminderResponseSchema,
  REMINDER_SYSTEM_INSTRUCTION,
} from "@/lib/prompts";
import { draftReminderRequestSchema, reminderOutputSchema } from "@/lib/schemas";
import { env } from "@/lib/env";

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

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const validation = draftReminderRequestSchema.safeParse(body);
    const tone = validation.success ? validation.data.tone : "friendly";

    // 1. Fetch invoice details from PayPal
    const invoice = await getInvoice(id);

    const recipient = invoice.primary_recipients?.[0]?.billing_info;
    const clientName =
      recipient?.name?.full_name ||
      [recipient?.name?.given_name, recipient?.name?.surname]
        .filter(Boolean)
        .join(" ") ||
      "Client";

    const invoiceNumber = invoice.detail?.invoice_number || id;
    const amount = invoice.amount?.value || "0.00";
    const currency = invoice.amount?.currency_code || env.DEFAULT_CURRENCY || "USD";
    const dueDate = invoice.detail?.payment_term?.due_date || "";

    // Calculate daysDiff relative to today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let daysDiff = 0;
    if (dueDate) {
      const due = new Date(dueDate + "T00:00:00Z");
      const diffMs = today.getTime() - due.getTime();
      daysDiff = Math.round(diffMs / (24 * 60 * 60 * 1000));
    }

    // 2. Draft reminder using Gemini LLM
    const provider = getLLMProvider();
    const prompt = buildReminderUserPrompt({
      clientName,
      invoiceNumber,
      amount,
      currency,
      dueDate,
      daysDiff,
      tone,
      businessName: env.BUSINESS_NAME,
    });

    const result = await provider.generateStructured({
      prompt,
      systemInstruction: REMINDER_SYSTEM_INSTRUCTION,
      responseSchema: geminiReminderResponseSchema,
      validate: (raw) => reminderOutputSchema.parse(raw),
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      meta: {
        modelUsed: result.modelUsed,
        tone,
      },
    });
  } catch (error: any) {
    console.error("Draft reminder error:", error);
    if (error instanceof PayPalApiError) {
      return NextResponse.json(
        { success: false, error: error.message, debug_id: error.debugId },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to generate reminder draft.",
      },
      { status: 500 }
    );
  }
}
