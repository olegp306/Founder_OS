import { describe, expect, it } from "vitest";
import { createFounderOsRuntime } from "@/server/founder-os-runtime";
import {
  handleCampaignPreview,
  handleConsentRecord,
  handleFeedbackCapture,
  handleSegmentEvaluation,
  handleTelegramDryRun
} from "@/server/engagement-api-services";
import { grantConsent, linkIdentity } from "@/domain/profiles/profile-operations";

describe("engagement API services", () => {
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
});
