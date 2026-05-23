import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";
import { handleProjectList } from "@/server/project-ai-api-services";

export async function GET(request: NextRequest) {
  const runtime = getFounderOsRuntime();
  const assistantKey = request.nextUrl.searchParams.get("assistantKey") ?? undefined;

  try {
    return NextResponse.json(await handleProjectList(runtime, { assistantKey }));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid project list request", issues: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Project list failed" }, { status: 400 });
  }
}
