import { z } from "zod";
import {
  approveTelegramCampaignForLiveSend,
  createCampaignWorkflow,
  createCampaignPreview,
  createTelegramDeliveryHandoff,
  getCampaignWorkflow,
  recordTelegramDeliveryReceipt,
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

export const campaignWorkflowCreateRequestSchema = z.object({
  campaignKey: z.string().min(2),
  projectKey: z.string().min(2).optional(),
  name: z.string().min(2),
  channel: z.enum(["telegram", "email", "sms", "web"]),
  purpose: z.enum(["product_updates", "marketing", "support", "token_metering"]),
  message: z.string().min(1).max(4000),
  actor: z.string().min(2)
});

export const campaignWorkflowGetRequestSchema = z.object({
  campaignKey: z.string().min(2)
});

export const campaignWorkflowExportRequestSchema = z.object({
  projectKey: z.string().min(2).optional(),
  asOf: z.string().datetime().optional()
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

export const telegramLiveSendApprovalRequestSchema = z.object({
  campaignKey: z.string().min(2),
  dryRunId: z.string(),
  botKeyRef: z.string(),
  actor: z.string().min(2),
  manualApproval: z.object({
    approvedBy: z.string().email(),
    approvedAt: z.string().datetime(),
    confirmed: z.boolean()
  }),
  expectedRecipients: z.number().int().min(0),
  dryRunPlannedRecipients: z.number().int().min(0)
});

export const telegramDeliveryHandoffRequestSchema = z.object({
  campaignKey: z.string().min(2),
  botKeyRef: z.string().min(1),
  actor: z.string().min(2),
  recipients: z.array(
    z.object({
      personId: z.string().min(1),
      telegramId: z.string().min(1)
    })
  )
});

export const telegramDeliveryReceiptRequestSchema = z.object({
  campaignKey: z.string().min(2),
  adapterRunId: z.string().min(2),
  actor: z.string().min(2),
  delivered: z.array(
    z.object({
      personId: z.string().min(1),
      telegramId: z.string().min(1),
      deliveredAt: z.string().datetime()
    })
  ),
  failed: z.array(
    z.object({
      personId: z.string().min(1),
      telegramId: z.string().min(1),
      reason: z.string().min(1)
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

export async function handleCampaignWorkflowCreate(runtime: FounderOsRuntime, payload: unknown) {
  const workflow = createCampaignWorkflow(
    runtime.campaigns,
    campaignWorkflowCreateRequestSchema.parse(payload)
  );

  return { status: workflow.status, workflow };
}

export async function handleCampaignWorkflowGet(runtime: FounderOsRuntime, payload: unknown) {
  const input = campaignWorkflowGetRequestSchema.parse(payload);
  const workflow = getCampaignWorkflow(runtime.campaigns, input.campaignKey);

  return workflow
    ? { status: "found" as const, workflow }
    : { status: "not_found" as const, workflow: null };
}

export async function handleCampaignWorkflowExport(runtime: FounderOsRuntime, payload: unknown) {
  const input = campaignWorkflowExportRequestSchema.parse(payload ?? {});
  const workflows = runtime.campaigns
    .allWorkflows()
    .filter((workflow) => !input.projectKey || workflow.projectKey === input.projectKey)
    .map((workflow) => ({
      campaignKey: workflow.campaignKey,
      projectKey: workflow.projectKey ?? "campaigns",
      name: workflow.name,
      channel: workflow.channel,
      purpose: workflow.purpose,
      status: workflow.status,
      plannedRecipients: workflow.plannedRecipients,
      blockedReasons: workflow.blockedReasons,
      updatedAt: workflow.updatedAt
    }));

  return {
    status: "exported" as const,
    generatedAt: input.asOf ?? new Date().toISOString(),
    projectKey: input.projectKey,
    workflowCount: workflows.length,
    workflows
  };
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

export async function handleTelegramLiveSendApproval(runtime: FounderOsRuntime, payload: unknown) {
  return approveTelegramCampaignForLiveSend(
    runtime.campaigns,
    telegramLiveSendApprovalRequestSchema.parse(payload)
  );
}

export async function handleTelegramDeliveryHandoff(runtime: FounderOsRuntime, payload: unknown) {
  return createTelegramDeliveryHandoff(
    runtime.campaigns,
    telegramDeliveryHandoffRequestSchema.parse(payload)
  );
}

export async function handleTelegramDeliveryReceipt(runtime: FounderOsRuntime, payload: unknown) {
  return recordTelegramDeliveryReceipt(
    runtime.campaigns,
    telegramDeliveryReceiptRequestSchema.parse(payload)
  );
}
