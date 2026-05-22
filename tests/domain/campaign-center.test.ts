import { describe, expect, it } from "vitest";
import {
  InMemoryCampaignStore,
  createCampaignPreview,
  evaluateCampaignEligibility,
  sendTelegramCampaignDryRun
} from "@/domain/campaigns/campaign-center";
import {
  InMemoryProfileOperationsStore,
  grantConsent,
  linkIdentity
} from "@/domain/profiles/profile-operations";

describe("campaign center", () => {
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
});
