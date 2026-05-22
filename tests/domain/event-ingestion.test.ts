import { describe, expect, it } from "vitest";
import {
  InMemoryEventStore,
  ingestStructuredEvent,
  rejectUnsafeRawPayload
} from "@/domain/events/event-ingestion";
import { InMemoryProfileStore } from "@/domain/profiles/profile-builder";

describe("event ingestion", () => {
  it("stores a structured event and updates the profile projection", async () => {
    const events = new InMemoryEventStore();
    const profiles = new InMemoryProfileStore();

    const result = await ingestStructuredEvent({
      events,
      profiles,
      payload: {
        idempotencyKey: "telegram_booking_bot:profile:123456:1",
        event: "user.profile.updated",
        source: "telegram_booking_bot",
        personRef: "telegram:123456",
        summary: "User is interested in booking automation for a photo studio.",
        tags: ["booking_interest", "photo_studio"],
        facts: {
          business_type: "photo_studio",
          preferred_language: "ru"
        },
        occurredAt: "2026-05-22T18:30:00.000Z"
      }
    });

    expect(result.status).toBe("stored");
    expect(events.all()).toHaveLength(1);
    expect(profiles.get("telegram:123456")).toMatchObject({
      personRef: "telegram:123456",
      summaries: ["User is interested in booking automation for a photo studio."],
      tags: ["booking_interest", "photo_studio"],
      facts: {
        business_type: "photo_studio",
        preferred_language: "ru"
      }
    });
  });

  it("rejects payloads that attempt to store raw conversation content", async () => {
    const events = new InMemoryEventStore();
    const profiles = new InMemoryProfileStore();

    await expect(
      ingestStructuredEvent({
        events,
        profiles,
        payload: {
          idempotencyKey: "telegram_booking_bot:raw:123456:1",
          event: "user.profile.updated",
          source: "telegram_booking_bot",
          personRef: "telegram:123456",
          rawMessage: "Please store this whole private message.",
          occurredAt: "2026-05-22T18:31:00.000Z"
        }
      })
    ).rejects.toThrow("Raw conversation content is not allowed");
  });

  it("does not duplicate an event with the same source and idempotency key", async () => {
    const events = new InMemoryEventStore();
    const profiles = new InMemoryProfileStore();
    const payload = {
      idempotencyKey: "booking_assistant:token:abc",
      event: "assistant.token_usage.recorded",
      source: "booking_assistant",
      personRef: "telegram:123456",
      facts: {
        model: "gpt-5.4",
        input_tokens: 1400,
        output_tokens: 620,
        cost_usd: 0.0124
      },
      occurredAt: "2026-05-22T18:32:00.000Z"
    };

    const first = await ingestStructuredEvent({ events, profiles, payload });
    const second = await ingestStructuredEvent({ events, profiles, payload });

    expect(first.status).toBe("stored");
    expect(second.status).toBe("duplicate");
    expect(events.all()).toHaveLength(1);
  });

  it("detects unsafe raw fields recursively before validation", () => {
    expect(() =>
      rejectUnsafeRawPayload({
        event: "user.profile.updated",
        facts: {
          nested: {
            conversationTranscript: "raw private dialog"
          }
        }
      })
    ).toThrow("Raw conversation content is not allowed");
  });
});
