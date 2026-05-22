import { describe, expect, it } from "vitest";
import { createFounderOsRuntime } from "@/server/founder-os-runtime";
import {
  handleStructuredEventIngestion,
  handleTokenPolicyLookup,
  handleTokenPolicySave,
  handleTokenUsageRecord
} from "@/server/api-services";

describe("API services backed by repositories", () => {
  it("stores structured events through the repository set and returns duplicate on repeat", async () => {
    const runtime = createFounderOsRuntime({ FOUNDER_OS_FORCE_MEMORY: "true" });
    const payload = {
      idempotencyKey: "telegram_booking_bot:profile:123456:1",
      event: "user.profile.updated",
      source: "telegram_booking_bot",
      personRef: "telegram:123456",
      summary: "User is interested in booking automation.",
      tags: ["booking_interest"],
      facts: { business_type: "photo_studio" },
      occurredAt: "2026-05-22T18:30:00.000Z"
    };

    await expect(handleStructuredEventIngestion(runtime, payload)).resolves.toMatchObject({
      status: "stored",
      event: {
        source: "telegram_booking_bot",
        idempotencyKey: "telegram_booking_bot:profile:123456:1",
        name: "user.profile.updated"
      }
    });
    await expect(handleStructuredEventIngestion(runtime, payload)).resolves.toMatchObject({
      status: "duplicate"
    });
  });

  it("saves and looks up token policies through repositories", async () => {
    const runtime = createFounderOsRuntime({ FOUNDER_OS_FORCE_MEMORY: "true" });

    await expect(
      handleTokenPolicySave(runtime, {
        projectKey: "booking_photoshop_studio",
        assistantKey: "booking_assistant",
        preferredModel: "gpt-5.4",
        fallbackModel: "gpt-5.4-mini",
        dailyBudgetUsd: 25,
        monthlyBudgetUsd: 500,
        maxTokensPerRequest: 8000,
        emergencyMode: false
      })
    ).resolves.toMatchObject({ status: "saved" });

    await expect(
      handleTokenPolicyLookup(runtime, {
        projectKey: "booking_photoshop_studio",
        assistantKey: "booking_assistant"
      })
    ).resolves.toMatchObject({
      policy: {
        preferredModel: "gpt-5.4",
        fallbackModel: "gpt-5.4-mini"
      }
    });
  });

  it("records token usage through repositories and includes active policy when present", async () => {
    const runtime = createFounderOsRuntime({ FOUNDER_OS_FORCE_MEMORY: "true" });
    await handleTokenPolicySave(runtime, {
      projectKey: "booking_photoshop_studio",
      assistantKey: "booking_assistant",
      preferredModel: "gpt-5.4",
      fallbackModel: "gpt-5.4-mini",
      dailyBudgetUsd: 25,
      monthlyBudgetUsd: 500,
      maxTokensPerRequest: 8000,
      emergencyMode: true
    });

    await expect(
      handleTokenUsageRecord(runtime, {
        projectKey: "booking_photoshop_studio",
        assistantKey: "booking_assistant",
        environment: "production",
        model: "gpt-5.4",
        inputTokens: 1400,
        outputTokens: 620,
        costUsd: 0.0124,
        occurredAt: "2026-05-22T19:45:00.000Z"
      })
    ).resolves.toMatchObject({
      status: "recorded",
      usage: {
        totalTokens: 2020
      },
      policy: {
        fallbackModel: "gpt-5.4-mini",
        emergencyMode: true
      }
    });
  });
});
