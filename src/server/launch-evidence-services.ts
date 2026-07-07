import { z } from "zod";
import { handleTokenUsageSummary } from "@/server/api-services";
import { handleAlertList } from "@/server/alert-services";
import { handleCampaignWorkflowExport } from "@/server/engagement-api-services";
import type { FounderOsRuntime } from "@/server/founder-os-runtime";
import {
  handleProjectConnectionBundle,
  handleProjectReadinessList
} from "@/server/project-ai-api-services";

export const projectLaunchEvidenceSchema = z.object({
  projectKey: z.string().min(2),
  assistantKey: z.string().min(2),
  asOf: z.string().datetime().optional(),
  tokenWindowHours: z.number().min(1).max(24 * 31).default(24)
});

export async function handleProjectLaunchEvidence(runtime: FounderOsRuntime, payload: unknown) {
  const input = projectLaunchEvidenceSchema.parse(payload);
  const generatedAt = input.asOf ?? new Date().toISOString();
  const [
    readinessResult,
    connectionResult,
    tokenSpendResult,
    alertResult,
    campaignResult
  ] = await Promise.all([
    handleProjectReadinessList(runtime, {
      projectKeys: [input.projectKey],
      assistantKey: input.assistantKey
    }),
    handleProjectConnectionBundle(runtime, {
      projectKey: input.projectKey,
      assistantKey: input.assistantKey
    }),
    handleTokenUsageSummary(runtime, {
      projectKey: input.projectKey,
      windowHours: input.tokenWindowHours
    }),
    handleAlertList(runtime, {
      projectKey: input.projectKey,
      asOf: generatedAt,
      tokenWindowHours: input.tokenWindowHours
    }),
    handleCampaignWorkflowExport(runtime, {
      projectKey: input.projectKey,
      asOf: generatedAt
    })
  ]);
  const readiness = readinessResult.readiness[0];
  const missing = readinessMissingLabels(readiness);
  const criticalAlerts = alertResult.alerts.filter((alert) => alert.severity === "critical").length;
  const highAlerts = alertResult.alerts.filter((alert) => alert.severity === "high").length;
  const mediumAlerts = alertResult.alerts.filter((alert) => alert.severity === "medium").length;
  const launchBlockers = [
    ...missing.map((label) => `missing:${label}`),
    ...(connectionResult.bundle.nextSteps.length > 0 ? ["connection:not_ready"] : []),
    ...(criticalAlerts > 0 ? ["alerts:critical"] : [])
  ];

  return {
    status: "built" as const,
    generatedAt,
    projectKey: input.projectKey,
    assistantKey: input.assistantKey,
    ready: launchBlockers.length === 0,
    launchBlockers,
    readiness: {
      ready: missing.length === 0,
      missing
    },
    connection: {
      ready: connectionResult.bundle.ready,
      nextSteps: connectionResult.bundle.nextSteps
    },
    tokenSpend: {
      windowHours: tokenSpendResult.summary.windowHours,
      eventCount: tokenSpendResult.summary.eventCount,
      totalCostUsd: tokenSpendResult.summary.totalCostUsd,
      projectedDailySpendUsd: tokenSpendResult.summary.projectedDailySpendUsd
    },
    alerts: {
      alertCount: alertResult.alertCount,
      criticalCount: criticalAlerts,
      highCount: highAlerts,
      mediumCount: mediumAlerts
    },
    campaigns: {
      workflowCount: campaignResult.workflowCount,
      failedCampaigns: campaignResult.workflows.filter((workflow) => workflow.status === "failed").length,
      readyForAdapter: campaignResult.workflows.filter((workflow) => workflow.status === "approved_for_live_send").length
    }
  };
}

function readinessMissingLabels(readiness:
  | {
      manifestImported: boolean;
      aiKeyConfigured: boolean;
      tokenPolicyConfigured: boolean;
      tokenTrackingRequired: boolean;
      feedbackCaptureRequired: boolean;
      rawMessageStorage: string;
    }
  | undefined
): string[] {
  return [
    ...(readiness?.manifestImported ? [] : ["Manifest"]),
    ...(readiness?.aiKeyConfigured ? [] : ["AI key"]),
    ...(readiness?.tokenPolicyConfigured ? [] : ["Token policy"]),
    ...(readiness?.tokenTrackingRequired ? [] : ["Token tracking"]),
    ...(readiness?.feedbackCaptureRequired ? [] : ["Feedback capture"]),
    ...(readiness?.rawMessageStorage === "disabled_by_default" ? [] : ["Raw messages"])
  ];
}
