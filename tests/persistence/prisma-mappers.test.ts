import { describe, expect, it } from "vitest";
import {
  mapStructuredEventToPrismaCreate,
  mapTokenPolicyToPrismaCreate,
  mapTokenUsageToPrismaCreate
} from "@/persistence/prisma/mappers";

describe("Prisma persistence mappers", () => {
  it("maps structured events without raw conversation fields", () => {
    expect(
      mapStructuredEventToPrismaCreate({
        source: "telegram_booking_bot",
        idempotencyKey: "telegram_booking_bot:profile:123456:1",
        event: "user.profile.updated",
        personRef: "telegram:123456",
        summary: "User is interested in booking automation.",
        tags: ["booking_interest"],
        facts: { business_type: "photo_studio" },
        occurredAt: "2026-05-22T18:30:00.000Z",
        storedAt: "2026-05-22T18:30:01.000Z"
      })
    ).toMatchObject({
      source: "telegram_booking_bot",
      idempotencyKey: "telegram_booking_bot:profile:123456:1",
      name: "user.profile.updated",
      personRef: "telegram:123456",
      tags: ["booking_interest"],
      facts: { business_type: "photo_studio" },
      occurredAt: new Date("2026-05-22T18:30:00.000Z"),
      storedAt: new Date("2026-05-22T18:30:01.000Z")
    });
  });

  it("maps token usage records to Prisma create input", () => {
    expect(
      mapTokenUsageToPrismaCreate({
        projectId: "project_1",
        assistantId: "assistant_1",
        personId: "person_1",
        environment: "production",
        model: "gpt-5.4",
        inputTokens: 1400,
        outputTokens: 620,
        totalTokens: 2020,
        costUsd: 0.0124,
        occurredAt: "2026-05-22T19:45:00.000Z"
      })
    ).toMatchObject({
      projectId: "project_1",
      assistantId: "assistant_1",
      personId: "person_1",
      environment: "PRODUCTION",
      model: "gpt-5.4",
      inputTokens: 1400,
      outputTokens: 620,
      totalTokens: 2020,
      costUsd: "0.0124",
      occurredAt: new Date("2026-05-22T19:45:00.000Z")
    });
  });

  it("maps token policies to Prisma create input", () => {
    expect(
      mapTokenPolicyToPrismaCreate({
        projectId: "project_1",
        assistantId: "assistant_1",
        preferredModel: "gpt-5.4",
        fallbackModel: "gpt-5.4-mini",
        dailyBudgetUsd: 25,
        monthlyBudgetUsd: 500,
        maxTokensPerRequest: 8000,
        emergencyMode: true
      })
    ).toMatchObject({
      projectId: "project_1",
      assistantId: "assistant_1",
      preferredModel: "gpt-5.4",
      fallbackModel: "gpt-5.4-mini",
      dailyBudgetUsd: "25",
      monthlyBudgetUsd: "500",
      maxTokensPerRequest: 8000,
      emergencyMode: true,
      emergencyAction: "DOWNGRADE_MODEL"
    });
  });
});
