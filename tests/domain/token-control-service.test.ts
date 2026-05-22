import { describe, expect, it } from "vitest";
import {
  InMemoryTokenControlStore,
  assessTokenSpend,
  getSafeTokenPolicy,
  recordTokenUsage
} from "@/domain/token-control/token-control-service";

describe("token control service", () => {
  it("records normalized usage and indexes it by project", () => {
    const store = new InMemoryTokenControlStore();

    const usage = recordTokenUsage(store, {
      projectKey: "booking_photoshop_studio",
      assistantKey: "booking_assistant",
      environment: "production",
      model: "gpt-5.4",
      inputTokens: 1400,
      outputTokens: 620,
      costUsd: 0.0124,
      occurredAt: "2026-05-22T19:00:00.000Z"
    });

    expect(usage.totalTokens).toBe(2020);
    expect(store.usageForProject("booking_photoshop_studio")).toHaveLength(1);
  });

  it("returns the active project policy for connected products", () => {
    const store = new InMemoryTokenControlStore();
    store.setPolicy({
      projectKey: "booking_photoshop_studio",
      assistantKey: "booking_assistant",
      preferredModel: "gpt-5.4",
      fallbackModel: "gpt-5.4-mini",
      dailyBudgetUsd: 25,
      monthlyBudgetUsd: 500,
      maxTokensPerRequest: 8000,
      emergencyMode: false
    });

    expect(
      store.findPolicy({
        projectKey: "booking_photoshop_studio",
        assistantKey: "booking_assistant"
      })
    ).toMatchObject({
      preferredModel: "gpt-5.4",
      fallbackModel: "gpt-5.4-mini"
    });
  });

  it("creates a burn-rate alert when projected daily spend exceeds the policy budget", () => {
    const store = new InMemoryTokenControlStore();
    const policy = store.setPolicy({
      projectKey: "booking_photoshop_studio",
      assistantKey: "booking_assistant",
      preferredModel: "gpt-5.4",
      fallbackModel: "gpt-5.4-mini",
      dailyBudgetUsd: 30,
      monthlyBudgetUsd: 500,
      maxTokensPerRequest: 8000,
      emergencyMode: false
    });

    recordTokenUsage(store, {
      projectKey: "booking_photoshop_studio",
      assistantKey: "booking_assistant",
      environment: "production",
      model: "gpt-5.4",
      inputTokens: 10_000,
      outputTokens: 5_000,
      costUsd: 4,
      occurredAt: "2026-05-22T19:00:00.000Z"
    });

    const assessment = assessTokenSpend({
      store,
      policy,
      windowHours: 2
    });

    expect(assessment.alerts).toEqual([
      {
        kind: "burn_rate",
        message: "Projected daily spend $48.00 exceeds daily budget $30.00"
      }
    ]);
  });

  it("fails closed to the last known safe policy for high-cost actions when central policy is unavailable", () => {
    const policy = getSafeTokenPolicy({
      activePolicy: undefined,
      lastKnownSafePolicy: {
        projectKey: "booking_photoshop_studio",
        preferredModel: "gpt-5.4-mini",
        fallbackModel: "gpt-5.4-mini",
        maxTokensPerRequest: 1000,
        emergencyMode: true
      },
      requestedTokens: 5000
    });

    expect(policy).toEqual({
      allowed: false,
      model: "gpt-5.4-mini",
      source: "last_known_safe_policy",
      reasons: ["central_policy_unavailable", "request_token_limit_exceeded"]
    });
  });
});
