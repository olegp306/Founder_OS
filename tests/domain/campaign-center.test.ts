import { describe, expect, it } from "vitest";
import {
  InMemoryCampaignStore,
  createCampaignWorkflow,
  createCampaignPreview,
  createTelegramDeliveryHandoff,
  evaluateCampaignEligibility,
  getCampaignWorkflow,
  approveTelegramCampaignForLiveSend,
  sendTelegramCampaignDryRun
} from "@/domain/campaigns/campaign-center";
import {
  InMemoryProfileOperationsStore,
  grantConsent,
  linkIdentity
} from "@/domain/profiles/profile-operations";

describe("campaign center", () => {
  it("tracks campaign workflow state from draft through dry-run and live-send approval", () => {
    const campaigns = new InMemoryCampaignStore();

    expect(
      createCampaignWorkflow(campaigns, {
        campaignKey: "booking_nudge",
        name: "Booking nudge",
        channel: "telegram",
        purpose: "marketing",
        message: "Want help automating photo studio bookings?",
        actor: "founder"
      })
    ).toMatchObject({
      campaignKey: "booking_nudge",
      status: "draft",
      channel: "telegram",
      plannedRecipients: 0,
      blockedReasons: []
    });

    sendTelegramCampaignDryRun(campaigns, {
      campaignKey: "booking_nudge",
      message: "Want help automating photo studio bookings?",
      recipients: [{ personId: "person_1", telegramId: "123456" }],
      actor: "founder"
    });

    expect(getCampaignWorkflow(campaigns, "booking_nudge")).toMatchObject({
      status: "dry_run",
      plannedRecipients: 1
    });

    approveTelegramCampaignForLiveSend(campaigns, {
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

    expect(getCampaignWorkflow(campaigns, "booking_nudge")).toMatchObject({
      status: "approved_for_live_send",
      approvedBy: "founder@example.com",
      botKeyRef: "ai_key_telegram_booking_bot",
      blockedReasons: []
    });
  });

  it("allows an eligible Telegram campaign recipient with consent inside their local send window", () => {
    const profiles = new InMemoryProfileOperationsStore();
    const identity = linkIdentity(profiles, {
      kind: "telegram",
      externalId: "123456",
      tags: ["booking_interest"],
      facts: { timezone: "Europe/Paris" }
    });
    grantConsent(profiles, {
      personId: identity.personId,
      channel: "telegram",
      purpose: "marketing",
      granted: true,
      source: "telegram_bot",
      actor: "system"
    });

    const eligibility = evaluateCampaignEligibility({
      profiles,
      personId: identity.personId,
      channel: "telegram",
      purpose: "marketing",
      localHour: 14,
      sentInLastHour: 0,
      hourlyLimit: 3
    });

    expect(eligibility).toEqual({ allowed: true, reasons: [] });
  });

  it("blocks sends without consent, outside timezone window, or over rate limit", () => {
    const profiles = new InMemoryProfileOperationsStore();
    const identity = linkIdentity(profiles, {
      kind: "telegram",
      externalId: "123456"
    });

    expect(
      evaluateCampaignEligibility({
        profiles,
        personId: identity.personId,
        channel: "telegram",
        purpose: "marketing",
        localHour: 22,
        sentInLastHour: 3,
        hourlyLimit: 3
      })
    ).toEqual({
      allowed: false,
      reasons: ["consent_not_granted", "outside_send_window", "rate_limit_exceeded"]
    });
  });

  it("builds a preview with eligible and blocked recipients before approval", () => {
    const profiles = new InMemoryProfileOperationsStore();
    const allowed = linkIdentity(profiles, {
      kind: "telegram",
      externalId: "123456",
      tags: ["booking_interest"]
    });
    const blocked = linkIdentity(profiles, {
      kind: "telegram",
      externalId: "789000",
      tags: ["booking_interest"]
    });
    grantConsent(profiles, {
      personId: allowed.personId,
      channel: "telegram",
      purpose: "marketing",
      granted: true,
      source: "telegram_bot",
      actor: "system"
    });

    const preview = createCampaignPreview({
      profiles,
      segmentMembers: [allowed.personId, blocked.personId],
      channel: "telegram",
      purpose: "marketing",
      localHour: 11,
      hourlyLimit: 10,
      alreadySentInLastHourByPerson: {}
    });

    expect(preview.eligible).toEqual([allowed.personId]);
    expect(preview.blocked).toEqual([
      {
        personId: blocked.personId,
        reasons: ["consent_not_granted"]
      }
    ]);
  });

  it("dry-runs a Telegram campaign and records send audit entries without sending real messages", () => {
    const campaigns = new InMemoryCampaignStore();

    const result = sendTelegramCampaignDryRun(campaigns, {
      campaignKey: "booking_nudge",
      message: "Want help automating photo studio bookings?",
      recipients: [
        {
          personId: "person_1",
          telegramId: "123456"
        }
      ],
      actor: "founder"
    });

    expect(result).toEqual({
      status: "dry_run",
      sent: 0,
      planned: 1,
      deliveries: [
        {
          personId: "person_1",
          telegramId: "123456",
          status: "planned"
        }
      ]
    });
    expect(campaigns.auditTrail()).toContainEqual(
      expect.objectContaining({
        action: "campaign.telegram.dry_run",
        actor: "founder",
        subjectId: "booking_nudge"
      })
    );
  });

  it("approves a Telegram campaign for live send only with dry-run evidence, manual approval, and bot key reference", () => {
    const campaigns = new InMemoryCampaignStore();

    expect(
      approveTelegramCampaignForLiveSend(campaigns, {
        campaignKey: "booking_nudge",
        dryRunId: "dry_run_2026_05_24",
        botKeyRef: "ai_key_telegram_booking_bot",
        actor: "founder",
        manualApproval: {
          approvedBy: "founder@example.com",
          approvedAt: "2026-05-24T15:00:00.000Z",
          confirmed: true
        },
        expectedRecipients: 2,
        dryRunPlannedRecipients: 2
      })
    ).toEqual({
      status: "approved_for_live_send",
      campaignKey: "booking_nudge",
      dryRunId: "dry_run_2026_05_24",
      botKeyRef: "ai_key_telegram_booking_bot",
      approvedBy: "founder@example.com",
      plannedRecipients: 2,
      blockedReasons: []
    });
    expect(campaigns.auditTrail()).toContainEqual(
      expect.objectContaining({
        action: "campaign.telegram.live_send_approved",
        actor: "founder",
        subjectId: "booking_nudge"
      })
    );
  });

  it("blocks Telegram live-send approval when approval evidence or recipient counts are unsafe", () => {
    const campaigns = new InMemoryCampaignStore();

    const result = approveTelegramCampaignForLiveSend(campaigns, {
      campaignKey: "booking_nudge",
      dryRunId: "",
      botKeyRef: "",
      actor: "founder",
      manualApproval: {
        approvedBy: "founder@example.com",
        approvedAt: "2026-05-24T15:00:00.000Z",
        confirmed: false
      },
      expectedRecipients: 3,
      dryRunPlannedRecipients: 2
    });

    expect(result).toEqual({
      status: "blocked",
      campaignKey: "booking_nudge",
      dryRunId: "",
      botKeyRef: "",
      approvedBy: "founder@example.com",
      plannedRecipients: 2,
      blockedReasons: [
        "manual_approval_required",
        "dry_run_evidence_required",
        "approved_bot_key_ref_required",
        "recipient_count_mismatch"
      ]
    });
    expect(campaigns.auditTrail()).toContainEqual(
      expect.objectContaining({
        action: "campaign.telegram.live_send_blocked",
        actor: "founder",
        subjectId: "booking_nudge"
      })
    );
  });

  it("creates a safe Telegram delivery handoff only after live-send approval", () => {
    const campaigns = new InMemoryCampaignStore();
    createCampaignWorkflow(campaigns, {
      campaignKey: "booking_nudge",
      name: "Booking nudge",
      channel: "telegram",
      purpose: "marketing",
      message: "Want help automating photo studio bookings?",
      actor: "founder"
    });
    sendTelegramCampaignDryRun(campaigns, {
      campaignKey: "booking_nudge",
      message: "Want help automating photo studio bookings?",
      recipients: [
        {
          personId: "person_1",
          telegramId: "123456"
        }
      ],
      actor: "founder"
    });
    approveTelegramCampaignForLiveSend(campaigns, {
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

    expect(
      createTelegramDeliveryHandoff(campaigns, {
        campaignKey: "booking_nudge",
        botKeyRef: "ai_key_telegram_booking_bot",
        actor: "founder",
        recipients: [{ personId: "person_1", telegramId: "123456" }]
      })
    ).toEqual({
      status: "handoff_ready",
      campaignKey: "booking_nudge",
      botKeyRef: "ai_key_telegram_booking_bot",
      message: "Want help automating photo studio bookings?",
      approvedBy: "founder@example.com",
      plannedRecipients: 1,
      recipients: [{ personId: "person_1", telegramId: "123456" }],
      blockedReasons: []
    });
    expect(campaigns.auditTrail()).toContainEqual(
      expect.objectContaining({
        action: "campaign.telegram.delivery_handoff_ready",
        actor: "founder",
        subjectId: "booking_nudge"
      })
    );
  });

  it("blocks Telegram delivery handoff when approval state or recipient evidence is unsafe", () => {
    const campaigns = new InMemoryCampaignStore();
    createCampaignWorkflow(campaigns, {
      campaignKey: "booking_nudge",
      name: "Booking nudge",
      channel: "telegram",
      purpose: "marketing",
      message: "Want help automating photo studio bookings?",
      actor: "founder"
    });

    const result = createTelegramDeliveryHandoff(campaigns, {
      campaignKey: "booking_nudge",
      botKeyRef: "wrong_key",
      actor: "founder",
      recipients: [{ personId: "person_1", telegramId: "123456" }]
    });

    expect(result).toMatchObject({
      status: "blocked",
      campaignKey: "booking_nudge",
      botKeyRef: "wrong_key",
      blockedReasons: [
        "campaign_not_approved_for_live_send",
        "approved_bot_key_ref_mismatch",
        "recipient_count_mismatch"
      ]
    });
  });
});
