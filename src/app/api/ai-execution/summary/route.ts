import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";
import { handleAiExecutionSummary } from "@/server/project-ai-api-services";

export async function GET(request: NextRequest) {
  const runtime = getFounderOsRuntime();
  const { searchParams } = new URL(request.url);

  try {
    return NextResponse.json(
      await handleAiExecutionSummary(runtime, {
        projectKey: searchParams.get("projectKey") ?? undefined
      })
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid AI execution summary request", issues: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "AI execution summary failed" }, { status: 400 });
  }
}
