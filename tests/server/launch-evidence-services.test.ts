import { describe, expect, it } from "vitest";
import { createFounderOsRuntime } from "@/server/founder-os-runtime";
import {
  handleProjectManifestOnboarding,
  handleAiKeyReferenceRegistration
} from "@/server/project-ai-api-services";
import {
  handleTokenPolicySave,
  handleTokenUsageRecord
} from "@/server/api-services";
import {
  handleCampaignWorkflowCreate,
  handleTelegramDryRun,
  handleTelegramLiveSendApproval
} from "@/server/engagement-api-services";
import { handleProjectLaunchEvidence } from "@/server/launch-evidence-services";

describe("launch evidence services", () => {
  it("builds a safe project launch evidence snapshot", async () => {
    const runtime = createFounderOsRuntime({ FOUNDER_OS_FORCE_MEMORY: "true" });
    await handleProjectManifestOnboarding(runtime, {
      project_id: "booking_assistant",
      name: "Booking Assistant",
      status: "active",
      owner: "olegp306",
      assistant: {
        enabled: true,
        token_tracking_required: true,
        feedback_capture_required: true
      },
      user_data: {
        raw_message_storage: "disabled_by_default",
        consent_required_for_marketing: true
      }
    });
    await handleAiKeyReferenceRegistration(runtime, {
      projectKey: "booking_assistant",
      provider: "openai",
      secretRef: "vercel:BOOKING_ASSISTANT_OPENAI_API_KEY",
      displayName: "Booking Assistant OpenAI key",
      allowedModels: ["gpt-5.4-mini", "gpt-5.4"],
      defaultModel: "gpt-5.4-mini",
      monthlyBudgetUsd: 250,
      plaintextSecret: "sk-never-return"
    });
    await handleTokenPolicySave(runtime, {
      projectKey: "booking_assistant",
      assistantKey: "support_bot",
      preferredModel: "gpt-5.4",
      fallbackModel: "gpt-5.4-mini",
      dailyBudgetUsd: 20,
      monthlyBudgetUsd: 250,
      maxTokensPerRequest: 2000,
      emergencyMode: false
    });
    await handleTokenUsageRecord(runtime, {
      projectKey: "booking_assistant",
      assistantKey: "support_bot",
      environment: "production",
      model: "gpt-5.4-mini",
      inputTokens: 500,
      outputTokens: 250,
      costUsd: 0.1,
      occurredAt: "2026-05-24T17:00:00.000Z"
    });
    await handleCampaignWorkflowCreate(runtime, {
      campaignKey: "booking_nudge",
      projectKey: "booking_assistant",
      name: "Booking nudge",
      channel: "telegram",
      purpose: "marketing",
      message: "Want help automating bookings?",
      actor: "founder"
    });
    await handleTelegramDryRun(runtime, {
      campaignKey: "booking_nudge",
      message: "Want help automating bookings?",
      actor: "founder",
      recipients: [{ personId: "person_1", telegramId: "123456" }]
    });
    await handleTelegramLiveSendApproval(runtime, {
      campaignKey: "booking_nudge",
      dryRunId: "dry_run_2026_05_24",
      botKeyRef: "ai_key_telegram_booking_bot",
      actor: "founder",
      manualApproval: {
        approvedBy: "founder@example.com",
        approvedAt: "2026-05-24T17:30:00.000Z",
        confirmed: true
      },
      expectedRecipients: 1,
      dryRunPlannedRecipients: 1
    });

    const result = await handleProjectLaunchEvidence(runtime, {
      projectKey: "booking_assistant",
      assistantKey: "support_bot",
      tokenWindowHours: 1,
      asOf: "2026-05-24T18:00:00.000Z"
    });

    expect(result).toEqual({
      status: "built",
      generatedAt: "2026-05-24T18:00:00.000Z",
      projectKey: "booking_assistant",
      assistantKey: "support_bot",
      ready: true,
      launchBlockers: [],
      readiness: {
        ready: true,
        missing: []
      },
      connection: {
        ready: true,
        nextSteps: []
      },
      tokenSpend: {
        windowHours: 1,
        eventCount: 1,
        totalCostUsd: 0.1,
        projectedDailySpendUsd: 2.4
      },
      alerts: {
        alertCount: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0
      },
      campaigns: {
        workflowCount: 1,
        failedCampaigns: 0,
        readyForAdapter: 1
      }
    });
    expect(JSON.stringify(result)).not.toContain("vercel:");
    expect(JSON.stringify(result)).not.toContain("sk-");
    expect(JSON.stringify(result)).not.toContain("123456");
    expect(JSON.stringify(result)).not.toContain("ai_key_telegram_booking_bot");
    expect(JSON.stringify(result)).not.toContain("Want help automating");
  });
});
