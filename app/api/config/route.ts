import { NextResponse } from "next/server";
import { env, isDemoMode } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    isDemoMode,
    businessName: env.BUSINESS_NAME,
    currency: env.DEFAULT_CURRENCY,
    llmModel: env.LLM_MODEL,
    hasSandboxCredentials: !isDemoMode,
  });
}
