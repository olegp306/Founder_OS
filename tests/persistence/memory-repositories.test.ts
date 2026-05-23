import { describe, expect, it } from "vitest";
import { MemoryRepositorySet } from "@/persistence/memory/repositories";

describe("memory repository set", () => {
  it("stores structured events idempotently", async () => {
    const repositories = new MemoryRepositorySet();
    const event = {
      source: "telegram_booking_bot",
      idempotencyKey: "telegram_booking_bot:profile:123456:1",
      event: "user.profile.updated",
      personRef: "telegram:123456",
      summary: "User is interested in booking automation.",
      tags: ["booking_interest"],
      facts: { business_type: "photo_studio" },
      occurredAt: "2026-05-22T18:30:00.000Z",
      storedAt: "2026-05-22T18:30:01.000Z"
    };

    await expect(repositories.events.append(event)).resolves.toBe("stored");
    await expect(repositories.events.append(event)).resolves.toBe("duplicate");
    await expect(
      repositories.events.findByIdempotencyKey(event.source, event.idempotencyKey)
    ).resolves.toMatchObject({ event: "user.profile.updated" });
  });

  it("records token usage by project", async () => {
    const repositories = new MemoryRepositorySet();

    await repositories.tokenUsage.record({
      projectKey: "booking_photoshop_studio",
      assistantKey: "booking_assistant",
      environment: "production",
      model: "gpt-5.4",
      inputTokens: 1400,
      outputTokens: 620,
      costUsd: 0.0124,
      occurredAt: "2026-05-22T19:45:00.000Z"
    });

    await expect(
      repositories.tokenUsage.findByProject("booking_photoshop_studio")
    ).resolves.toHaveLength(1);
  });

  it("falls back from assistant policy to project-wide policy", async () => {
    const repositories = new MemoryRepositorySet();

    await repositories.tokenPolicies.save({
      projectKey: "booking_photoshop_studio",
      preferredModel: "gpt-5.4-mini",
      fallbackModel: "gpt-5.4-mini",
      dailyBudgetUsd: 10,
      monthlyBudgetUsd: 200,
      maxTokensPerRequest: 2000,
      emergencyMode: true
    });

    await expect(
      repositories.tokenPolicies.find({
        projectKey: "booking_photoshop_studio",
        assistantKey: "missing_assistant"
      })
    ).resolves.toMatchObject({
      preferredModel: "gpt-5.4-mini",
      emergencyMode: true
    });
  });
});
