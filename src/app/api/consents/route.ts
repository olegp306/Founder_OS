import { NextResponse, type NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { grantConsent, mayContactPerson } from "@/domain/profiles/profile-operations";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";

const consentRequestSchema = z.object({
  personId: z.string().min(1),
  channel: z.enum(["telegram", "email", "sms", "web"]),
  purpose: z.enum(["product_updates", "marketing", "support", "token_metering"]),
  granted: z.boolean(),
  source: z.string().min(2),
  actor: z.string().min(2)
});

export async function POST(request: NextRequest) {
  const runtime = getFounderOsRuntime();

  try {
    const input = consentRequestSchema.parse(await request.json());
    const consent = grantConsent(runtime.profileOps, input);
    const eligibility = mayContactPerson(runtime.profileOps, {
      personId: input.personId,
      channel: input.channel,
      purpose: input.purpose
    });

    return NextResponse.json({ status: "recorded", consent, eligibility });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid consent record", issues: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Consent recording failed" }, { status: 400 });
  }
}
