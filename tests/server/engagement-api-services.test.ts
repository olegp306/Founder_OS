import { describe, expect, it } from "vitest";
import { createFounderOsRuntime } from "@/server/founder-os-runtime";
import {
  handleCampaignWorkflowExport,
  handleCampaignWorkflowCreate,
  handleCampaignWorkflowGet,
  handleCampaignPreview,
  handleConsentRecord,
  handleFeedbackCapture,
  handleSegmentEvaluation,
  handleTelegramDeliveryReceipt,
  handleTelegramDeliveryHandoff,
  handleTelegramLiveSendApproval,
  handleTelegramDryRun
} from "@/server/engagement-api-services";
import { grantConsent, linkIdentity } from "@/domain/profiles/profile-operations";

describe("engagement API services", () => {
  it("creates and reads campaign workflow state through the runtime campaign store", async () => {
    const runtime = createFounderOsRuntime({ FOUNDER_OS_FORCE_MEMORY: "true" });

    await expect(
      handleCampaignWorkflowCreate(runtime, {
        campaignKey: "booking_nudge",
        projectKey: "booking_assistant",
        name: "Booking nudge",
        channel: "telegram",
        purpose: "marketing",
        message: "Want help automating bookings?",
        actor: "founder"
      })
    ).resolves.toMatchObject({
      status: "draft",
      workflow: {
        campaignKey: "booking_nudge",
        projectKey: "booking_assistant",
        status: "draft",
        channel: "telegram"
      }
    });

    await expect(
      handleCampaignWorkflowGet(runtime, { campaignKey: "booking_nudge" })
    ).resolves.toMatchObject({
      status: "found",
      workflow: {
        campaignKey: "booking_nudge",
        projectKey: "booking_assistant",
        name: "Booking nudge"
      }
    });
  });

  it("records consent and returns current contact eligibility", async () => {
    const runtime = createFounderOsRuntime({ FOUNDER_OS_FORCE_MEMORY: "true" });
    const identity = linkIdentity(runtime.profileOps, {
      kind: "telegram",
      externalId: "123456"
    });

    await expect(
      handleConsentRecord(runtime, {
        personId: identity.personId,
        channel: "telegram",
        purpose: "marketing",
        granted: true,
        source: "telegram_bot",
        actor: "system"
      })
    ).resolves.toMatchObject({
      status: "recorded",
      eligibility: { allowed: true, reasons: [] }
    });
  });

  it("captures feedback with status new", async () => {
    const runtime = createFounderOsRuntime({ FOUNDER_OS_FORCE_MEMORY: "true" });

    await expect(
      handleFeedbackCapture(runtime, {
        projectKey: "booking_photoshop_studio",
        source: "assistant_observation",
        kind: "feature_request",
        summary: "User wants deposit reminders.",
        tags: ["booking", "payments"]
      })
    ).resolves.toMatchObject({
      status: "captured",
      feedback: {
        status: "new",
        tags: ["booking", "payments"]
      }
    });
  });

  it("evaluates tag-based segments through the runtime profile store", async () => {
    const runtime = createFounderOsRuntime({ FOUNDER_OS_FORCE_MEMORY: "true" });
    const identity = linkIdentity(runtime.profileOps, {
      kind: "telegram",
      externalId: "123456",
      tags: ["booking_interest", "photo_studio"]
    });

    await expect(
      handleSegmentEvaluation(runtime, {
        key: "photo_studio_booking_leads",
        name: "Photo studio booking leads",
        requiredTags: ["booking_interest", "photo_studio"]
      })
    ).resolves.toMatchObject({
      status: "evaluated",
      segment: { members: [identity.personId] }
    });
  });

  it("creates campaign preview and dry-run send results", async () => {
    const runtime = createFounderOsRuntime({ FOUNDER_OS_FORCE_MEMORY: "true" });
    const identity = linkIdentity(runtime.profileOps, {
      kind: "telegram",
      externalId: "123456"
    });
    grantConsent(runtime.profileOps, {
      personId: identity.personId,
      channel: "telegram",
      purpose: "marketing",
      granted: true,
      source: "telegram_bot",
      actor: "system"
    });

    await expect(
      handleCampaignPreview(runtime, {
        segmentMembers: [identity.personId],
        channel: "telegram",
        purpose: "marketing",
        localHour: 12,
        hourlyLimit: 3,
        alreadySentInLastHourByPerson: {}
      })
    ).resolves.toMatchObject({
      status: "preview",
      preview: { eligible: [identity.personId], blocked: [] }
    });

    await expect(
      handleTelegramDryRun(runtime, {
        campaignKey: "booking_nudge",
        message: "Want help automating bookings?",
        actor: "founder",
        recipients: [{ personId: identity.personId, telegramId: "123456" }]
      })
    ).resolves.toMatchObject({
      status: "dry_run",
      sent: 0,
      planned: 1
    });
  });

  it("approves Telegram live-send readiness through the runtime campaign store", async () => {
    const runtime = createFounderOsRuntime({ FOUNDER_OS_FORCE_MEMORY: "true" });

    await expect(
      handleTelegramLiveSendApproval(runtime, {
        campaignKey: "booking_nudge",
        dryRunId: "dry_run_2026_05_24",
        botKeyRef: "ai_key_telegram_booking_bot",
        actor: "founder",
        manualApproval: {
          approvedBy: "founder@example.com",
          approvedAt: "2026-05-24T15:00:00.000Z",
          confirmed: true
        },
        expectedRecipients: 1,
        dryRunPlannedRecipients: 1
      })
    ).resolves.toMatchObject({
      status: "approved_for_live_send",
      blockedReasons: []
    });
  });

  it("creates Telegram delivery handoff through the runtime campaign store", async () => {
    const runtime = createFounderOsRuntime({ FOUNDER_OS_FORCE_MEMORY: "true" });

    await handleCampaignWorkflowCreate(runtime, {
      campaignKey: "booking_nudge",
      name: "Booking nudge",
      channel: "telegram",
      purpose: "marketing",
      message: "Want help automating bookings?",
      actor: "founder"
    });
    await handleTelegramDryRun(runtime, {
      campaignKey: "booking_nudge",
      message: "Want help automating bookings?",
      actor: "founder",
      recipients: [{ personId: "person_1", telegramId: "123456" }]
    });
    await handleTelegramLiveSendApproval(runtime, {
      campaignKey: "booking_nudge",
      dryRunId: "dry_run_2026_05_24",
      botKeyRef: "ai_key_telegram_booking_bot",
      actor: "founder",
      manualApproval: {
        approvedBy: "founder@example.com",
        approvedAt: "2026-05-24T15:00:00.000Z",
        confirmed: true
      },
      expectedRecipients: 1,
      dryRunPlannedRecipients: 1
    });

    await expect(
      handleTelegramDeliveryHandoff(runtime, {
        campaignKey: "booking_nudge",
        botKeyRef: "ai_key_telegram_booking_bot",
        actor: "founder",
        recipients: [{ personId: "person_1", telegramId: "123456" }]
      })
    ).resolves.toMatchObject({
      status: "handoff_ready",
      message: "Want help automating bookings?",
      blockedReasons: []
    });
  });

  it("records Telegram delivery receipt through the runtime campaign store", async () => {
    const runtime = createFounderOsRuntime({ FOUNDER_OS_FORCE_MEMORY: "true" });
    await handleCampaignWorkflowCreate(runtime, {
      campaignKey: "booking_nudge",
      name: "Booking nudge",
      channel: "telegram",
      purpose: "marketing",
      message: "Want help automating bookings?",
      actor: "founder"
    });

    await expect(
      handleTelegramDeliveryReceipt(runtime, {
        campaignKey: "booking_nudge",
        adapterRunId: "telegram_run_1",
        actor: "telegram_adapter",
        delivered: [{ personId: "person_1", telegramId: "123456", deliveredAt: "2026-05-24T16:00:00.000Z" }],
        failed: []
      })
    ).resolves.toMatchObject({
      status: "sent",
      deliveredCount: 1,
      failedCount: 0
    });

    await expect(
      handleCampaignWorkflowGet(runtime, { campaignKey: "booking_nudge" })
    ).resolves.toMatchObject({
      workflow: { status: "sent" }
    });
  });

  it("exports project-filtered campaign workflow state without delivery secrets", async () => {
    const runtime = createFounderOsRuntime({ FOUNDER_OS_FORCE_MEMORY: "true" });
    await handleCampaignWorkflowCreate(runtime, {
      campaignKey: "booking_nudge",
      projectKey: "booking_assistant",
      name: "Booking nudge",
      channel: "telegram",
      purpose: "marketing",
      message: "Want help automating bookings?",
      actor: "founder"
    });
    await handleTelegramDryRun(runtime, {
      campaignKey: "booking_nudge",
      message: "Want help automating bookings?",
      actor: "founder",
      recipients: [{ personId: "person_1", telegramId: "123456" }]
    });
    await handleTelegramLiveSendApproval(runtime, {
      campaignKey: "booking_nudge",
      dryRunId: "dry_run_2026_05_24",
      botKeyRef: "ai_key_telegram_booking_bot",
      actor: "founder",
      manualApproval: {
        approvedBy: "founder@example.com",
        approvedAt: "2026-05-24T15:00:00.000Z",
        confirmed: true
      },
      expectedRecipients: 1,
      dryRunPlannedRecipients: 1
    });
    await handleCampaignWorkflowCreate(runtime, {
      campaignKey: "sales_followup",
      projectKey: "sales_copilot",
      name: "Sales followup",
      channel: "telegram",
      purpose: "marketing",
      message: "Want help with sales followups?",
      actor: "founder"
    });

    const result = await handleCampaignWorkflowExport(runtime, {
      projectKey: "booking_assistant",
      asOf: "2026-05-24T18:00:00.000Z"
    });

    expect(result).toEqual({
      status: "exported",
      generatedAt: "2026-05-24T18:00:00.000Z",
      projectKey: "booking_assistant",
      workflowCount: 1,
      workflows: [
        {
          campaignKey: "booking_nudge",
          projectKey: "booking_assistant",
          name: "Booking nudge",
          channel: "telegram",
          purpose: "marketing",
          status: "approved_for_live_send",
          plannedRecipients: 1,
          blockedReasons: [],
          updatedAt: expect.any(String)
        }
      ]
    });
    expect(JSON.stringify(result)).not.toContain("123456");
    expect(JSON.stringify(result)).not.toContain("ai_key_telegram_booking_bot");
    expect(JSON.stringify(result)).not.toContain("sales_followup");
  });
});
