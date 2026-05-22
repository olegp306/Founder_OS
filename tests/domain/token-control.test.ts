import { describe, expect, it } from "vitest";
import {
  evaluateTokenPolicy,
  normalizeTokenUsageEvent,
  summarizeTokenBurnRate
} from "@/domain/token-control/token-control";

describe("token control plane", () => {
  it("normalizes token usage with total tokens and cost per thousand tokens", () => {
    const usage = normalizeTokenUsageEvent({
      projectKey: "booking_photoshop_studio",
      assistantKey: "booking_assistant",
      environment: "production",
      model: "gpt-5.4",
      inputTokens: 1400,
      outputTokens: 620,
      costUsd: 0.0124,
      occurredAt: "2026-05-22T18:00:00.000Z"
    });

    expect(usage.totalTokens).toBe(2020);
    expect(usage.costPerThousandTokensUsd).toBeCloseTo(0.006139, 6);
    expect(usage.policySubject).toBe("project:booking_photoshop_studio");
  });

  it("downgrades to fallback model when emergency mode is enabled", () => {
    const decision = evaluateTokenPolicy({
      preferredModel: "gpt-5.4",
      fallbackModel: "gpt-5.4-mini",
      emergencyMode: true,
      dailyBudgetUsd: 25,
      spentTodayUsd: 12,
      maxTokensPerRequest: 8000,
      requestedTokens: 2000
    });

    expect(decision).toEqual({
      allowed: true,
      model: "gpt-5.4-mini",
      action: "downgrade",
      reasons: ["emergency_mode"]
    });
  });

  it("blocks high-cost requests when daily budget is already exhausted", () => {
    const decision = evaluateTokenPolicy({
      preferredModel: "gpt-5.4",
      fallbackModel: "gpt-5.4-mini",
      emergencyMode: false,
      dailyBudgetUsd: 10,
      spentTodayUsd: 10.25,
      maxTokensPerRequest: 8000,
      requestedTokens: 1000
    });

    expect(decision.allowed).toBe(false);
    expect(decision.action).toBe("block");
    expect(decision.reasons).toContain("daily_budget_exhausted");
  });

  it("summarizes burn rate and projected daily spend from recent usage", () => {
    const summary = summarizeTokenBurnRate({
      windowHours: 2,
      events: [
        { costUsd: 2, totalTokens: 1000 },
        { costUsd: 4, totalTokens: 3000 }
      ]
    });

    expect(summary.spendPerHourUsd).toBe(3);
    expect(summary.tokensPerHour).toBe(2000);
    expect(summary.projectedDailySpendUsd).toBe(72);
  });
});
