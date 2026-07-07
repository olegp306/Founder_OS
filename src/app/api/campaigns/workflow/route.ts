import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import {
  handleCampaignWorkflowCreate,
  handleCampaignWorkflowGet
} from "@/server/engagement-api-services";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";

export async function GET(request: NextRequest) {
  const runtime = getFounderOsRuntime();

  try {
    return NextResponse.json(
      await handleCampaignWorkflowGet(runtime, {
        campaignKey: request.nextUrl.searchParams.get("campaignKey")
      })
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid campaign workflow lookup", issues: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Campaign workflow lookup failed" }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  const runtime = getFounderOsRuntime();

  try {
    return NextResponse.json(await handleCampaignWorkflowCreate(runtime, await request.json()));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid campaign workflow", issues: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Campaign workflow failed" }, { status: 400 });
  }
}
