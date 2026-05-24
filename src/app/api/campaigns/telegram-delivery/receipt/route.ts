import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { handleTelegramDeliveryReceipt } from "@/server/engagement-api-services";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";

export async function POST(request: NextRequest) {
  const runtime = getFounderOsRuntime();

  try {
    return NextResponse.json(await handleTelegramDeliveryReceipt(runtime, await request.json()));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid Telegram delivery receipt", issues: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Telegram delivery receipt failed" }, { status: 400 });
  }
}
