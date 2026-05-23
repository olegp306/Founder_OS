import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { handleProjectAiControlResolve } from "@/server/project-ai-api-services";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";

export async function POST(request: NextRequest) {
  const runtime = getFounderOsRuntime();

  try {
    return NextResponse.json(await handleProjectAiControlResolve(runtime, await request.json()));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid AI control request", issues: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "AI control resolution failed" }, { status: 400 });
  }
}
