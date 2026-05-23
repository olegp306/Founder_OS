import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { handleTokenUsageSummary } from "@/server/api-services";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";

export async function GET(request: NextRequest) {
  const runtime = getFounderOsRuntime();
  const projectKey = request.nextUrl.searchParams.get("projectKey");
  const windowHoursParam = request.nextUrl.searchParams.get("windowHours");
  const windowHours = windowHoursParam ? Number(windowHoursParam) : undefined;

  try {
    return NextResponse.json(await handleTokenUsageSummary(runtime, { projectKey, windowHours }));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid token usage summary request",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
          }))
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Token usage summary failed" }, { status: 400 });
  }
}
