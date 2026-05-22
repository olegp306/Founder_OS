import { describe, expect, it } from "vitest";
import { createFounderOsRuntime } from "@/server/founder-os-runtime";
import {
  handleStructuredEventIngestion,
  handleTokenPolicyLookup,
  handleTokenPolicySave,
  handleTokenUsageSummary,
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

  it("records an audit event when token policy is changed centrally", async () => {
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
        emergencyMode: true
      })
    ).resolves.toMatchObject({ status: "saved" });

    expect(runtime.events.all()).toEqual([
      expect.objectContaining({
        event: "token.policy.changed",
        source: "founder_os",
        project: "booking_photoshop_studio",
        summary: "Token policy changed for booking_photoshop_studio/booking_assistant.",
        tags: ["token_policy", "ai_control", "emergency_mode"],
        facts: {
          assistant_key: "booking_assistant",
          preferred_model: "gpt-5.4",
          fallback_model: "gpt-5.4-mini",
          daily_budget_usd: 25,
          monthly_budget_usd: 500,
          max_tokens_per_request: 8000,
          emergency_mode: true
        }
      })
    ]);
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

  it("summarizes token usage by assistant, model, and environment", async () => {
    const runtime = createFounderOsRuntime({ FOUNDER_OS_FORCE_MEMORY: "true" });
    await handleTokenUsageRecord(runtime, {
      projectKey: "booking_photoshop_studio",
      assistantKey: "booking_assistant",
      environment: "production",
      model: "gpt-5.4",
      inputTokens: 1000,
      outputTokens: 500,
      costUsd: 3,
      occurredAt: "2026-05-22T19:00:00.000Z"
    });
    await handleTokenUsageRecord(runtime, {
      projectKey: "booking_photoshop_studio",
      assistantKey: "booking_assistant",
      environment: "production",
      model: "gpt-5.4-mini",
      inputTokens: 800,
      outputTokens: 200,
      costUsd: 1,
      occurredAt: "2026-05-22T20:00:00.000Z"
    });
    await handleTokenUsageRecord(runtime, {
      projectKey: "booking_photoshop_studio",
      assistantKey: "feedback_assistant",
      environment: "staging",
      model: "gpt-5.4-mini",
      inputTokens: 300,
      outputTokens: 200,
      costUsd: 0.5,
      occurredAt: "2026-05-22T20:30:00.000Z"
    });

    await expect(
      handleTokenUsageSummary(runtime, {
        projectKey: "booking_photoshop_studio",
        windowHours: 6
      })
    ).resolves.toEqual({
      status: "summarized",
      summary: {
        projectKey: "booking_photoshop_studio",
        windowHours: 6,
        eventCount: 3,
        totalTokens: 3000,
        totalCostUsd: 4.5,
        spendPerHourUsd: 0.75,
        tokensPerHour: 500,
        projectedDailySpendUsd: 18,
        byAssistant: [
          { key: "booking_assistant", totalTokens: 2500, totalCostUsd: 4, eventCount: 2 },
          { key: "feedback_assistant", totalTokens: 500, totalCostUsd: 0.5, eventCount: 1 }
        ],
        byModel: [
          { key: "gpt-5.4", totalTokens: 1500, totalCostUsd: 3, eventCount: 1 },
          { key: "gpt-5.4-mini", totalTokens: 1500, totalCostUsd: 1.5, eventCount: 2 }
        ],
        byEnvironment: [
          { key: "production", totalTokens: 2500, totalCostUsd: 4, eventCount: 2 },
          { key: "staging", totalTokens: 500, totalCostUsd: 0.5, eventCount: 1 }
        ]
      }
    });
  });
});
