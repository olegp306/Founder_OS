import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";
import { handleProjectReadinessList } from "@/server/project-ai-api-services";

export async function GET(request: NextRequest) {
  const runtime = getFounderOsRuntime();
  const projectKeys = request.nextUrl.searchParams
    .get("projectKeys")
    ?.split(",")
    .map((projectKey) => projectKey.trim())
    .filter(Boolean);
  const assistantKey = request.nextUrl.searchParams.get("assistantKey") ?? undefined;

  try {
    return NextResponse.json(
      await handleProjectReadinessList(runtime, { projectKeys, assistantKey })
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid project readiness request", issues: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Project readiness lookup failed" }, { status: 400 });
  }
}
