import { describe, expect, it } from "vitest";
import { createFounderOsRuntime } from "@/server/founder-os-runtime";
import {
  handleBulkTokenPolicySave,
  handleStructuredEventIngestion,
  handleTokenPolicySave,
  handleTokenUsageRecord
} from "@/server/api-services";
import {
  handleAiKeyReferenceRegistration,
  handleProjectManifestOnboarding
} from "@/server/project-ai-api-services";
import { handleProviderSpendImport } from "@/server/provider-spend-services";
import { handleAlertList } from "@/server/alert-services";

describe("alert services", () => {
  it("projects budget, rotation, provider spend, and emergency-mode alerts safely", async () => {
    const runtime = createFounderOsRuntime({ FOUNDER_OS_FORCE_MEMORY: "true" });
    await handleProjectManifestOnboarding(runtime, {
      project_id: "booking_assistant",
      name: "Booking Assistant",
      status: "active",
      owner: "olegp306"
    });
    await handleAiKeyReferenceRegistration(runtime, {
      projectKey: "booking_assistant",
      provider: "openai",
      secretRef: "vercel:BOOKING_ASSISTANT_OPENAI_API_KEY",
      displayName: "Booking Assistant OpenAI key",
      allowedModels: ["gpt-5.4-mini", "gpt-5.4"],
      defaultModel: "gpt-5.4-mini",
      monthlyBudgetUsd: 250,
      environment: "production",
      rotationDueAt: "2026-05-20T00:00:00.000Z"
    });
    await handleTokenPolicySave(runtime, {
      projectKey: "booking_assistant",
      assistantKey: "support_bot",
      preferredModel: "gpt-5.4",
      fallbackModel: "gpt-5.4-mini",
      dailyBudgetUsd: 10,
      monthlyBudgetUsd: 250,
      maxTokensPerRequest: 8000,
      emergencyMode: false
    });
    await handleTokenUsageRecord(runtime, {
      projectKey: "booking_assistant",
      assistantKey: "support_bot",
      environment: "production",
      model: "gpt-5.4",
      inputTokens: 2000,
      outputTokens: 1000,
      costUsd: 8,
      occurredAt: "2026-05-24T08:00:00.000Z"
    });
    await handleProviderSpendImport(runtime, {
      imports: [
        {
          projectKey: "booking_assistant",
          provider: "openai",
          periodStart: "2026-05-22T00:00:00.000Z",
          periodEnd: "2026-05-23T00:00:00.000Z",
          costUsd: 10,
          source: "openai_usage_export",
          importedAt: "2026-05-23T08:00:00.000Z"
        },
        {
          projectKey: "booking_assistant",
          provider: "openai",
          periodStart: "2026-05-23T00:00:00.000Z",
          periodEnd: "2026-05-24T00:00:00.000Z",
          costUsd: 35,
          source: "openai_usage_export",
          importedAt: "2026-05-24T08:00:00.000Z"
        }
      ]
    });
    await handleBulkTokenPolicySave(runtime, {
      targets: [{ projectKey: "booking_assistant", assistantKey: "support_bot" }],
      policy: {
        preferredModel: "gpt-5.4-mini",
        fallbackModel: "gpt-5.4-mini",
        dailyBudgetUsd: 5,
        monthlyBudgetUsd: 100,
        maxTokensPerRequest: 2000,
        emergencyMode: true
      },
      reason: "cost spike"
    });
    await handleStructuredEventIngestion(runtime, {
      idempotencyKey: "raw-leak-test-1",
      event: "provider.spend.imported",
      source: "unsafe_fixture",
      project: "booking_assistant",
      summary: "Should not leak raw provider details.",
      tags: ["provider_spend"],
      facts: {
        provider: "openai",
        cost_usd: 999,
        secretRef: "vercel:SHOULD_NOT_LEAK",
        invoice_url: "https://billing.example.com/raw-invoice"
      },
      occurredAt: "2026-05-24T08:00:00.000Z"
    });

    const result = await handleAlertList(runtime, {
      projectKey: "booking_assistant",
      asOf: "2026-05-24T12:00:00.000Z",
      tokenWindowHours: 1
    });

    expect(result).toEqual({
      status: "listed",
      alertCount: 4,
      alerts: [
        {
          id: "budget-breach:booking_assistant:support_bot",
          type: "budget_breach",
          severity: "critical",
          projectKey: "booking_assistant",
          provider: undefined,
          title: "Projected token spend exceeds daily budget",
          detail: "booking_assistant/support_bot projects $192.00 daily spend against a $10.00 budget.",
          evidence: {
            assistantKey: "support_bot",
            projectedDailySpendUsd: 192,
            dailyBudgetUsd: 10,
            windowHours: 1
          },
          occurredAt: "2026-05-24T12:00:00.000Z"
        },
        {
          id: "key-rotation-overdue:booking_assistant:openai",
          type: "key_rotation_overdue",
          severity: "high",
          projectKey: "booking_assistant",
          provider: "openai",
          title: "AI key rotation overdue",
          detail: "booking_assistant/openai rotation was due 2026-05-20T00:00:00.000Z.",
          evidence: {
            rotationDueAt: "2026-05-20T00:00:00.000Z",
            environment: "production",
            status: "active"
          },
          occurredAt: "2026-05-24T12:00:00.000Z"
        },
        {
          id: "provider-spend-anomaly:booking_assistant:openai",
          type: "provider_spend_anomaly",
          severity: "high",
          projectKey: "booking_assistant",
          provider: "openai",
          title: "Provider spend anomaly detected",
          detail: "booking_assistant/openai provider spend increased from $10.00 to $35.00.",
          evidence: {
            previousCostUsd: 10,
            latestCostUsd: 35,
            increaseRatio: 3.5,
            source: "openai_usage_export"
          },
          occurredAt: "2026-05-24T08:00:00.000Z"
        },
        {
          id: "emergency-mode:booking_assistant:support_bot",
          type: "emergency_mode_enabled",
          severity: "medium",
          projectKey: "booking_assistant",
          provider: undefined,
          title: "Emergency token policy enabled",
          detail: "booking_assistant/support_bot is in emergency mode.",
          evidence: {
            assistantKey: "support_bot",
            fallbackModel: "gpt-5.4-mini",
            reason: "cost spike"
          },
          occurredAt: expect.any(String)
        }
      ]
    });
    expect(JSON.stringify(result)).not.toContain("vercel:");
    expect(JSON.stringify(result)).not.toContain("invoice");
    expect(JSON.stringify(result)).not.toContain("sk-");
  });
});
