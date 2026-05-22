import { z } from "zod";
import {
  createCampaignPreview,
  sendTelegramCampaignDryRun
} from "@/domain/campaigns/campaign-center";
import {
  captureFeedback,
  evaluateSegment,
  grantConsent,
  mayContactPerson
} from "@/domain/profiles/profile-operations";
import type { FounderOsRuntime } from "@/server/founder-os-runtime";

export const consentRequestSchema = z.object({
  personId: z.string().min(1),
  channel: z.enum(["telegram", "email", "sms", "web"]),
  purpose: z.enum(["product_updates", "marketing", "support", "token_metering"]),
  granted: z.boolean(),
  source: z.string().min(2),
  actor: z.string().min(2)
});

export const feedbackRequestSchema = z.object({
  personId: z.string().min(1).optional(),
  projectKey: z.string().min(2).optional(),
  source: z.string().min(2),
  kind: z.string().min(2),
  summary: z.string().min(1).max(2000),
  tags: z.array(z.string().min(1)).default([])
});

export const segmentRequestSchema = z.object({
  key: z.string().min(2),
  name: z.string().min(2),
  requiredTags: z.array(z.string().min(1)).min(1)
});

export const campaignPreviewRequestSchema = z.object({
  segmentMembers: z.array(z.string().min(1)),
  channel: z.enum(["telegram", "email", "sms", "web"]),
  purpose: z.enum(["product_updates", "marketing", "support", "token_metering"]),
  localHour: z.number().int().min(0).max(23),
  hourlyLimit: z.number().int().min(1),
  alreadySentInLastHourByPerson: z.record(z.number().int().min(0)).default({})
});

export const telegramDryRunRequestSchema = z.object({
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

export async function handleConsentRecord(runtime: FounderOsRuntime, payload: unknown) {
  const input = consentRequestSchema.parse(payload);
  const consent = grantConsent(runtime.profileOps, input);
  const eligibility = mayContactPerson(runtime.profileOps, {
    personId: input.personId,
    channel: input.channel,
    purpose: input.purpose
  });

  return { status: "recorded" as const, consent, eligibility };
}

export async function handleFeedbackCapture(runtime: FounderOsRuntime, payload: unknown) {
  const feedback = captureFeedback(runtime.profileOps, feedbackRequestSchema.parse(payload));
  return { status: "captured" as const, feedback };
}

export async function handleSegmentEvaluation(runtime: FounderOsRuntime, payload: unknown) {
  const segment = evaluateSegment(runtime.profileOps, segmentRequestSchema.parse(payload));
  return { status: "evaluated" as const, segment };
}

export async function handleCampaignPreview(runtime: FounderOsRuntime, payload: unknown) {
  const input = campaignPreviewRequestSchema.parse(payload);
  const preview = createCampaignPreview({
    profiles: runtime.profileOps,
    ...input
  });

  return { status: "preview" as const, preview };
}

export async function handleTelegramDryRun(runtime: FounderOsRuntime, payload: unknown) {
  return sendTelegramCampaignDryRun(
    runtime.campaigns,
    telegramDryRunRequestSchema.parse(payload)
  );
}
