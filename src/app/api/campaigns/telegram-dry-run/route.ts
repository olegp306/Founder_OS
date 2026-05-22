import { NextResponse, type NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { sendTelegramCampaignDryRun } from "@/domain/campaigns/campaign-center";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";

const telegramDryRunRequestSchema = z.object({
  campaignKey: z.string().min(2),
  message: z.string().min(1).max(4000),
  actor: z.string().min(2),
  recipients: z.array(
    z.object({
      personId: z.string().min(1),
      telegramId: z.string().min(1)
    })
  )
});

export async function POST(request: NextRequest) {
  const runtime = getFounderOsRuntime();

  try {
    const input = telegramDryRunRequestSchema.parse(await request.json());
    const result = sendTelegramCampaignDryRun(runtime.campaigns, input);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid Telegram dry-run", issues: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Telegram dry-run failed" }, { status: 400 });
  }
}
