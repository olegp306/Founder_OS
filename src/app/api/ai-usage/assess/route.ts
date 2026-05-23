import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";
import { handleAiUsageAssessment } from "@/server/project-ai-api-services";

export async function POST(request: NextRequest) {
  const runtime = getFounderOsRuntime();

  try {
    return NextResponse.json(await handleAiUsageAssessment(runtime, await request.json()));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid AI usage assessment request", issues: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "AI usage assessment failed" }, { status: 400 });
  }
}
