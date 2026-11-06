import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { listInvoices } from "@/lib/paypal";
import { dbOperations } from "@/lib/db";
import { getLLMProvider, BusyAIError } from "@/lib/llm";
import {
  buildBusinessSummaryUserPrompt,
  geminiSummaryResponseSchema,
  BUSINESS_SUMMARY_SYSTEM_INSTRUCTION,
} from "@/lib/prompts";
import { businessSummarySchema } from "@/lib/schemas";
import { env } from "@/lib/env";
import { fromCents, toCents } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const forceRefresh =
      searchParams.get("force_refresh") === "true" ||
      searchParams.get("refresh") === "true";

    // 1. Fetch current invoices from PayPal
    const res = await listInvoices({ pageSize: 100, totalCountRequired: true });
    const items = res.items || [];
    const todayStr = new Date().toISOString().split("T")[0];

    // 2. Compute all financial stats strictly in code (integer cents)
    let totalInvoicedCents = 0;
    let paidCents = 0;
    let outstandingCents = 0;
    let overdueCents = 0;

    const counts = {
      total: 0,
      paid: 0,
      outstanding: 0,
      overdue: 0,
      draft: 0,
      cancelled: 0,
    };

    const clientTotals: Record<string, number> = {};

    for (const inv of items) {
      const recipient = inv.primary_recipients?.[0]?.billing_info;
      const clientName =
        recipient?.name?.full_name ||
        [recipient?.name?.given_name, recipient?.name?.surname]
          .filter(Boolean)
          .join(" ") ||
        "Client";

      const dueDate = inv.detail?.payment_term?.due_date || "";
      const amountCents = toCents(inv.amount?.value || "0.00");
      const status = (inv.status || "DRAFT").toUpperCase();
      const isPaid = status === "PAID" || status === "MARKED_AS_PAID";
      const isCancelled = status === "CANCELLED" || status === "REFUNDED";

      counts.total++;

      if (!isCancelled) {
        totalInvoicedCents += amountCents;
        clientTotals[clientName] = (clientTotals[clientName] || 0) + amountCents;
      }

      if (isPaid) {
        paidCents += amountCents;
        counts.paid++;
      } else if (isCancelled) {
        counts.cancelled++;
      } else if (status !== "DRAFT" && dueDate && dueDate < todayStr) {
        overdueCents += amountCents;
        counts.overdue++;
      } else if (status === "DRAFT") {
        counts.draft++;
      } else {
        outstandingCents += amountCents;
        counts.outstanding++;
      }
    }

    // Top 3 clients by volume
    const topClients = Object.entries(clientTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, cents]) => ({
        name,
        totalAmount: fromCents(cents),
      }));

    const statsPayload = {
      totalInvoiced: fromCents(totalInvoicedCents),
      paid: fromCents(paidCents),
      outstanding: fromCents(outstandingCents),
      overdue: fromCents(overdueCents),
      currency: env.DEFAULT_CURRENCY || "USD",
      counts,
      topClients,
    };

    // 3. Compute deterministic hash of stats payload
    const statsHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(statsPayload))
      .digest("hex");

    // 4. Check SQLite cache (unless force_refresh is requested)
    if (!forceRefresh) {
      const cached = dbOperations.getSummaryByHash(statsHash);
      if (cached) {
        try {
          const parsed = JSON.parse(cached.text);
          return NextResponse.json({
            success: true,
            data: {
              ...parsed,
              cached: true,
              created_at: cached.created_at,
              stats_hash: statsHash,
            },
          });
        } catch {
          // If parse fails, regenerate
        }
      }
    }

    // 5. Call Gemini to generate short narrative + 1 actionable suggestion
    const provider = getLLMProvider();
    const prompt = buildBusinessSummaryUserPrompt(statsPayload);

    const result = await provider.generateStructured({
      prompt,
      systemInstruction: BUSINESS_SUMMARY_SYSTEM_INSTRUCTION,
      responseSchema: geminiSummaryResponseSchema,
      validate: (raw) => businessSummarySchema.parse(raw),
    });

    // 6. Save in SQLite summaries table
    dbOperations.saveSummary(statsHash, JSON.stringify(result.data));

    return NextResponse.json({
      success: true,
      data: {
        ...result.data,
        cached: false,
        created_at: new Date().toISOString(),
        stats_hash: statsHash,
      },
    });
  } catch (error: any) {
    console.error("GET /api/summary error:", error);

    if (error instanceof BusyAIError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to generate AI business summary.",
      },
      { status: 500 }
    );
  }
}
