import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { handleTokenPolicyLookup, handleTokenPolicySave } from "@/server/api-services";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";

export async function GET(request: NextRequest) {
  const runtime = getFounderOsRuntime();
  const projectKey = request.nextUrl.searchParams.get("projectKey");
  const assistantKey = request.nextUrl.searchParams.get("assistantKey") ?? undefined;

  try {
    return NextResponse.json(await handleTokenPolicyLookup(runtime, { projectKey, assistantKey }));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Token policy lookup failed" },
      { status: projectKey ? 404 : 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  const runtime = getFounderOsRuntime();

  try {
    return NextResponse.json(await handleTokenPolicySave(runtime, await request.json()));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid token policy",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
          }))
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Token policy save failed" }, { status: 400 });
  }
}
