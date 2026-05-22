import { NextResponse, type NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { createCampaignPreview } from "@/domain/campaigns/campaign-center";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";

const campaignPreviewRequestSchema = z.object({
  segmentMembers: z.array(z.string().min(1)),
  channel: z.enum(["telegram", "email", "sms", "web"]),
  purpose: z.enum(["product_updates", "marketing", "support", "token_metering"]),
  localHour: z.number().int().min(0).max(23),
  hourlyLimit: z.number().int().min(1),
  alreadySentInLastHourByPerson: z.record(z.number().int().min(0)).default({})
});

export async function POST(request: NextRequest) {
  const runtime = getFounderOsRuntime();

  try {
    const input = campaignPreviewRequestSchema.parse(await request.json());
    const preview = createCampaignPreview({
      profiles: runtime.profileOps,
      ...input
    });

    return NextResponse.json({ status: "preview", preview });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid campaign preview", issues: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Campaign preview failed" }, { status: 400 });
  }
}
