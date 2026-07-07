import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";
import { handleProjectLaunchEvidence } from "@/server/launch-evidence-services";

export async function GET(request: NextRequest) {
  const runtime = getFounderOsRuntime();
  const tokenWindowHours = request.nextUrl.searchParams.get("tokenWindowHours");

  try {
    return NextResponse.json(
      await handleProjectLaunchEvidence(runtime, {
        projectKey: request.nextUrl.searchParams.get("projectKey") ?? undefined,
        assistantKey: request.nextUrl.searchParams.get("assistantKey") ?? undefined,
        asOf: request.nextUrl.searchParams.get("asOf") ?? undefined,
        tokenWindowHours: tokenWindowHours ? Number(tokenWindowHours) : undefined
      })
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid project launch evidence request", issues: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Project launch evidence failed" }, { status: 400 });
  }
}
