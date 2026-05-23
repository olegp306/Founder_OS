import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { handleProjectManifestOnboarding } from "@/server/project-ai-api-services";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";

export async function POST(request: NextRequest) {
  const runtime = getFounderOsRuntime();

  try {
    return NextResponse.json(await handleProjectManifestOnboarding(runtime, await request.json()));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid project manifest", issues: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Project onboarding failed" }, { status: 400 });
  }
}
