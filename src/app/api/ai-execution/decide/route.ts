import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";
import { handleAiExecutionDecision } from "@/server/project-ai-api-services";

export async function POST(request: NextRequest) {
  const runtime = getFounderOsRuntime();

  try {
    return NextResponse.json(await handleAiExecutionDecision(runtime, await request.json()));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid AI execution decision request", issues: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "AI execution decision failed" }, { status: 400 });
  }
}
