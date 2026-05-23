import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { handleConsentRecord } from "@/server/engagement-api-services";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";

export async function POST(request: NextRequest) {
  const runtime = getFounderOsRuntime();

  try {
    return NextResponse.json(await handleConsentRecord(runtime, await request.json()));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid consent record", issues: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Consent recording failed" }, { status: 400 });
  }
}
