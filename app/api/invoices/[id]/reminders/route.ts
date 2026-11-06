import { NextRequest, NextResponse } from "next/server";
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

    const reminders = dbOperations.getReminders(id);

    return NextResponse.json({
      success: true,
      data: reminders,
    });
  } catch (error: any) {
    console.error("GET /api/invoices/[id]/reminders error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch reminders." },
      { status: 500 }
    );
  }
}
