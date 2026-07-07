import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { handleCampaignWorkflowExport } from "@/server/engagement-api-services";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";

export async function GET(request: NextRequest) {
  const runtime = getFounderOsRuntime();

  try {
    return NextResponse.json(
      await handleCampaignWorkflowExport(runtime, {
        projectKey: request.nextUrl.searchParams.get("projectKey") ?? undefined
      })
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid campaign workflow export", issues: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Campaign workflow export failed" }, { status: 400 });
  }
}
