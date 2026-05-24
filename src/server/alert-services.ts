import { z } from "zod";
import type { StructuredEvent } from "@/domain/events/event-ingestion";
import { summarizeTokenBurnRate, type NormalizedTokenUsageEvent } from "@/domain/token-control/token-control";
import type { FounderOsRuntime } from "@/server/founder-os-runtime";
import { handleAiKeyReferenceInventory } from "@/server/project-ai-api-services";

const alertListSchema = z.object({
  projectKey: z.string().min(2).optional(),
  asOf: z.string().datetime().optional(),
  tokenWindowHours: z.number().min(1).max(24 * 31).default(24)
});

export type FounderOsAlert = {
  id: string;
  type: "budget_breach" | "key_rotation_overdue" | "provider_spend_anomaly" | "campaign_delivery_failed" | "emergency_mode_enabled";
  severity: "critical" | "high" | "medium";
  projectKey: string;
  provider?: string;
  title: string;
  detail: string;
  evidence: Record<string, unknown>;
  occurredAt: string;
};

export async function handleAlertList(runtime: FounderOsRuntime, payload: unknown) {
  const input = alertListSchema.parse(payload ?? {});
  const asOf = input.asOf ?? new Date().toISOString();
  const alerts = [
    ...await buildBudgetAlerts(runtime, input.projectKey, input.tokenWindowHours, asOf),
    ...await buildKeyRotationAlerts(runtime, input.projectKey, asOf),
    ...buildProviderSpendAlerts(runtime, input.projectKey),
    ...buildCampaignDeliveryAlerts(runtime, input.projectKey),
    ...buildEmergencyModeAlerts(runtime, input.projectKey)
  ].sort(compareAlerts);

  return {
    status: "listed" as const,
    alertCount: alerts.length,
    alerts: alerts.map(sanitizeAlert)
  };
}

async function buildBudgetAlerts(
  runtime: FounderOsRuntime,
  projectKey: string | undefined,
  windowHours: number,
  asOf: string
): Promise<FounderOsAlert[]> {
  const projects = projectKey
    ? [{ key: projectKey }]
    : await runtime.repositories.projects.allProjects();
  const alerts: FounderOsAlert[] = [];
  const policyEvents = runtime.events
    .all()
    .filter((event) => event.event === "token.policy.changed")
    .filter((event) => !projectKey || event.project === projectKey)
    .filter((event) => event.facts.emergency_mode !== true);

  for (const project of projects) {
    const usage = await runtime.repositories.tokenUsage.findByProject(project.key);
    if (usage.length === 0) {
      continue;
    }

    const usageEvents = usage as NormalizedTokenUsageEvent[];
    const assistantKeys = uniqueSorted(usageEvents.map((event) => event.assistantKey));

    for (const assistantKey of assistantKeys) {
      const assistantUsage = usageEvents.filter((event) => event.assistantKey === assistantKey);
      const policy = latestPolicyEvent(policyEvents, project.key, assistantKey);
      const dailyBudgetUsd = Number(policy?.facts.daily_budget_usd);

      if (!Number.isFinite(dailyBudgetUsd) || dailyBudgetUsd <= 0) {
        continue;
      }

      const burnRate = summarizeTokenBurnRate({
        windowHours,
        events: assistantUsage.map((event) => ({
          costUsd: event.costUsd,
          totalTokens: event.totalTokens
        }))
      });
      const projectedDailySpendUsd = roundMoney(burnRate.projectedDailySpendUsd);

      if (projectedDailySpendUsd <= dailyBudgetUsd) {
        continue;
      }

      alerts.push({
        id: `budget-breach:${project.key}:${assistantKey}`,
        type: "budget_breach",
        severity: "critical",
        projectKey: project.key,
        provider: undefined,
        title: "Projected token spend exceeds daily budget",
        detail: `${project.key}/${assistantKey} projects ${formatUsd(projectedDailySpendUsd)} daily spend against a ${formatUsd(dailyBudgetUsd)} budget.`,
        evidence: {
          assistantKey,
          projectedDailySpendUsd,
          dailyBudgetUsd,
          windowHours
        },
        occurredAt: asOf
      });
    }
  }

  return alerts;
}

async function buildKeyRotationAlerts(
  runtime: FounderOsRuntime,
  projectKey: string | undefined,
  asOf: string
): Promise<FounderOsAlert[]> {
  const inventory = await handleAiKeyReferenceInventory(runtime, { projectKey, asOf });

  return inventory.projects.flatMap((project) =>
    project.references
      .filter((reference) => reference.rotationStatus === "overdue")
      .map((reference) => ({
        id: `key-rotation-overdue:${project.projectKey}:${reference.provider}`,
        type: "key_rotation_overdue" as const,
        severity: "high" as const,
        projectKey: project.projectKey,
        provider: reference.provider,
        title: "AI key rotation overdue",
        detail: `${project.projectKey}/${reference.provider} rotation was due ${reference.rotationDueAt}.`,
        evidence: {
          rotationDueAt: reference.rotationDueAt,
          environment: reference.environment,
          status: reference.status
        },
        occurredAt: asOf
      }))
  );
}

function buildProviderSpendAlerts(runtime: FounderOsRuntime, projectKey: string | undefined): FounderOsAlert[] {
  const events = runtime.events
    .all()
    .filter((event) => event.event === "provider.spend.imported")
    .filter((event) => !projectKey || event.project === projectKey)
    .filter(isSafeProviderSpendEvent);
  const groups = new Map<string, StructuredEvent[]>();

  for (const event of events) {
    const provider = String(event.facts.provider);
    const key = `${event.project}:${provider}`;
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }

  return [...groups.values()].flatMap((group) => {
    const sorted = group.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
    const previous = sorted.at(-2);
    const latest = sorted.at(-1);

    if (!previous || !latest) {
      return [];
    }

    const previousCostUsd = Number(previous.facts.cost_usd);
    const latestCostUsd = Number(latest.facts.cost_usd);
    if (!Number.isFinite(previousCostUsd) || !Number.isFinite(latestCostUsd) || previousCostUsd <= 0) {
      return [];
    }

    const increaseRatio = roundMoney(latestCostUsd / previousCostUsd);
    if (increaseRatio < 2 || latestCostUsd - previousCostUsd < 10) {
      return [];
    }

    const project = String(latest.project);
    const provider = String(latest.facts.provider);
    return [{
      id: `provider-spend-anomaly:${project}:${provider}`,
      type: "provider_spend_anomaly" as const,
      severity: "high" as const,
      projectKey: project,
      provider,
      title: "Provider spend anomaly detected",
      detail: `${project}/${provider} provider spend increased from ${formatUsd(previousCostUsd)} to ${formatUsd(latestCostUsd)}.`,
      evidence: {
        previousCostUsd,
        latestCostUsd,
        increaseRatio,
        source: latest.facts.source
      },
      occurredAt: latest.occurredAt
    }];
  });
}

function buildEmergencyModeAlerts(runtime: FounderOsRuntime, projectKey: string | undefined): FounderOsAlert[] {
  const events = runtime.events
    .all()
    .filter((event) => event.event === "token.policy.changed")
    .filter((event) => !projectKey || event.project === projectKey)
    .filter((event) => event.facts.emergency_mode === true);
  const latestBySubject = new Map<string, StructuredEvent>();

  for (const event of events) {
    const assistantKey = String(event.facts.assistant_key ?? "*");
    const key = `${event.project}:${assistantKey}`;
    const current = latestBySubject.get(key);
    if (!current || current.occurredAt.localeCompare(event.occurredAt) <= 0) {
      latestBySubject.set(key, event);
    }
  }

  return [...latestBySubject.values()].map((event) => {
    const assistantKey = String(event.facts.assistant_key ?? "*");
    const project = String(event.project);

    return {
      id: `emergency-mode:${project}:${assistantKey}`,
      type: "emergency_mode_enabled" as const,
      severity: "medium" as const,
      projectKey: project,
      provider: undefined,
      title: "Emergency token policy enabled",
      detail: `${project}/${assistantKey} is in emergency mode.`,
      evidence: {
        assistantKey,
        fallbackModel: event.facts.fallback_model,
        reason: event.facts.reason
      },
      occurredAt: event.occurredAt
    };
  });
}

function buildCampaignDeliveryAlerts(runtime: FounderOsRuntime, projectKey: string | undefined): FounderOsAlert[] {
  return runtime.campaigns
    .allWorkflows()
    .filter((workflow) => workflow.status === "failed")
    .map((workflow) => ({
      id: `campaign-delivery-failed:${workflow.campaignKey}`,
      type: "campaign_delivery_failed" as const,
      severity: "medium" as const,
      projectKey: "campaigns",
      provider: workflow.channel === "telegram" ? "telegram" : undefined,
      title: "Campaign delivery failed",
      detail: `${workflow.campaignKey} ended with failed ${formatChannel(workflow.channel)} delivery.`,
      evidence: {
        campaignKey: workflow.campaignKey,
        channel: workflow.channel,
        plannedRecipients: workflow.plannedRecipients,
        blockedReasons: workflow.blockedReasons
      },
      occurredAt: workflow.updatedAt
    }));
}

function latestPolicyEvent(events: StructuredEvent[], projectKey: string, assistantKey: string) {
  return events
    .filter((event) => event.project === projectKey)
    .filter((event) => event.facts.assistant_key === assistantKey)
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
    .at(-1);
}

function isSafeProviderSpendEvent(event: StructuredEvent): boolean {
  return Boolean(event.project) &&
    typeof event.facts.provider === "string" &&
    typeof event.facts.source === "string" &&
    Number.isFinite(Number(event.facts.cost_usd));
}

function sanitizeAlert(alert: FounderOsAlert): FounderOsAlert {
  return {
    ...alert,
    evidence: sanitizeEvidence(alert.evidence)
  };
}

function sanitizeEvidence(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !isUnsafeKey(key))
  );
}

function isUnsafeKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return normalized.includes("secret") ||
    normalized.includes("token") && normalized !== "assistantkey" ||
    normalized.includes("invoice") ||
    normalized.includes("raw");
}

function compareAlerts(left: FounderOsAlert, right: FounderOsAlert): number {
  const severityOrder = { critical: 0, high: 1, medium: 2 };
  return severityOrder[left.severity] - severityOrder[right.severity] ||
    left.type.localeCompare(right.type) ||
    left.id.localeCompare(right.id);
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatChannel(channel: string): string {
  return channel.charAt(0).toUpperCase() + channel.slice(1);
}

function roundMoney(value: number): number {
  return Math.round(value * 10000) / 10000;
}
