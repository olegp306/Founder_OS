import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";
import { handleProjectConnectionBundle } from "@/server/project-ai-api-services";

export async function GET(request: NextRequest) {
  const runtime = getFounderOsRuntime();
  const projectKey = request.nextUrl.searchParams.get("projectKey") ?? undefined;
  const assistantKey = request.nextUrl.searchParams.get("assistantKey") ?? undefined;

  try {
    return NextResponse.json(
      await handleProjectConnectionBundle(runtime, { projectKey, assistantKey })
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid project connection request", issues: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Project connection bundle failed" }, { status: 400 });
  }
}
