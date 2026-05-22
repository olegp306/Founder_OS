import { describe, expect, it } from "vitest";
import {
  InMemoryProfileOperationsStore,
  captureFeedback,
  evaluateSegment,
  grantConsent,
  linkIdentity,
  mayContactPerson,
  mergePersonIdentities
} from "@/domain/profiles/profile-operations";

describe("profile operations", () => {
  it("links Telegram and email identities to the same person when merge is explicit", () => {
    const store = new InMemoryProfileOperationsStore();
    const telegram = linkIdentity(store, {
      kind: "telegram",
      externalId: "123456",
      displayName: "Oleg"
    });
    const email = linkIdentity(store, {
      kind: "email",
      externalId: "oleg@example.com",
      displayName: "Oleg"
    });

    const merged = mergePersonIdentities(store, {
      primaryPersonId: telegram.personId,
      secondaryPersonId: email.personId,
      reason: "user confirmed same owner",
      actor: "founder"
    });

    expect(merged.identities).toEqual([
      { kind: "telegram", externalId: "123456" },
      { kind: "email", externalId: "oleg@example.com" }
    ]);
    expect(store.auditTrail()).toContainEqual(
      expect.objectContaining({
        action: "person.identities.merged",
        actor: "founder"
      })
    );
  });

  it("allows contact only when consent is granted and not opted out", () => {
    const store = new InMemoryProfileOperationsStore();
    const identity = linkIdentity(store, {
      kind: "telegram",
      externalId: "123456"
    });

    grantConsent(store, {
      personId: identity.personId,
      channel: "telegram",
      purpose: "marketing",
      granted: true,
      source: "telegram_bot",
      actor: "system"
    });

    expect(
      mayContactPerson(store, {
        personId: identity.personId,
        channel: "telegram",
        purpose: "marketing"
      })
    ).toEqual({ allowed: true, reasons: [] });

    grantConsent(store, {
      personId: identity.personId,
      channel: "telegram",
      purpose: "marketing",
      granted: false,
      source: "telegram_bot_stop",
      actor: "system"
    });

    expect(
      mayContactPerson(store, {
        personId: identity.personId,
        channel: "telegram",
        purpose: "marketing"
      })
    ).toEqual({ allowed: false, reasons: ["consent_not_granted"] });
  });

  it("captures feedback and evaluates a tag-based segment", () => {
    const store = new InMemoryProfileOperationsStore();
    const identity = linkIdentity(store, {
      kind: "telegram",
      externalId: "123456",
      tags: ["booking_interest", "photo_studio"]
    });

    const feedback = captureFeedback(store, {
      personId: identity.personId,
      projectKey: "booking_photoshop_studio",
      source: "assistant_observation",
      kind: "feature_request",
      summary: "User repeatedly asks for deposit reminders.",
      tags: ["payments", "booking"]
    });

    const segment = evaluateSegment(store, {
      key: "photo_studio_booking_leads",
      name: "Photo studio booking leads",
      requiredTags: ["booking_interest", "photo_studio"]
    });

    expect(feedback.status).toBe("new");
    expect(segment.members).toEqual([identity.personId]);
  });
});
