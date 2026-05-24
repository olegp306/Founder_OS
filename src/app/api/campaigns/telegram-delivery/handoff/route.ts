import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { handleTelegramDeliveryHandoff } from "@/server/engagement-api-services";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";

export async function POST(request: NextRequest) {
  const runtime = getFounderOsRuntime();

  try {
    return NextResponse.json(await handleTelegramDeliveryHandoff(runtime, await request.json()));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid Telegram delivery handoff", issues: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Telegram delivery handoff failed" }, { status: 400 });
  }
}
