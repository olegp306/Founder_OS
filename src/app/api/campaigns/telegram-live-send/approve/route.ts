import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { handleTelegramLiveSendApproval } from "@/server/engagement-api-services";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";

export async function POST(request: NextRequest) {
  const runtime = getFounderOsRuntime();

  try {
    return NextResponse.json(await handleTelegramLiveSendApproval(runtime, await request.json()));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid Telegram live-send approval", issues: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Telegram live-send approval failed" }, { status: 400 });
  }
}
