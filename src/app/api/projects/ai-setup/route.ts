import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";
import { handleProjectAiSetup } from "@/server/project-ai-api-services";

export async function POST(request: NextRequest) {
  const runtime = getFounderOsRuntime();

  try {
    return NextResponse.json(await handleProjectAiSetup(runtime, await request.json()));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid project AI setup request", issues: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Project AI setup failed" }, { status: 400 });
  }
}
