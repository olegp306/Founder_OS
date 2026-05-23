import { randomUUID } from "node:crypto";
import { z } from "zod";
import { rejectUnsafeRawPayload, type StructuredEvent } from "@/domain/events/event-ingestion";
import {
  summarizeTokenBurnRate,
  type NormalizedTokenUsageEvent,
  type TokenUsageInput
} from "@/domain/token-control/token-control";
import type { FounderOsRuntime } from "@/server/founder-os-runtime";

export const structuredEventSchema = z.object({
  idempotencyKey: z.string().min(8),
  event: z.string().min(3),
  source: z.string().min(2),
  personRef: z.string().min(3).optional(),
  project: z.string().min(2).optional(),
  summary: z.string().min(1).max(2000).optional(),
  tags: z.array(z.string().min(1)).default([]),
  facts: z.record(z.unknown()).default({}),
  occurredAt: z.string().datetime()
});

export const tokenUsageRequestSchema = z.object({
  projectKey: z.string().min(2),
  assistantKey: z.string().min(2),
  environment: z.enum(["local", "staging", "production", "client-isolated"]),
  model: z.string().min(2),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  costUsd: z.number().min(0),
  occurredAt: z.string().datetime()
});

export const tokenPolicyRequestSchema = z.object({
  projectKey: z.string().min(2),
  assistantKey: z.string().min(2).optional(),
  preferredModel: z.string().min(2),
  fallbackModel: z.string().min(2),
  dailyBudgetUsd: z.number().min(0),
  monthlyBudgetUsd: z.number().min(0),
  maxTokensPerRequest: z.number().int().min(1),
  emergencyMode: z.boolean().default(false)
});

export const bulkTokenPolicyRequestSchema = z.object({
  targets: z.array(
    z.object({
      projectKey: z.string().min(2),
      assistantKey: z.string().min(2).optional()
    })
  ).min(1),
  policy: tokenPolicyRequestSchema.omit({
    projectKey: true,
    assistantKey: true
  }),
  reason: z.string().min(2).max(500).optional()
});

export const tokenUsageSummarySchema = z.object({
  projectKey: z.string().min(2),
  windowHours: z.number().min(1).max(24 * 31).default(24)
});

export async function handleStructuredEventIngestion(
  runtime: FounderOsRuntime,
  payload: unknown
) {
  rejectUnsafeRawPayload(payload);
  const parsed = structuredEventSchema.parse(payload);
  const existing = await runtime.repositories.events.findByIdempotencyKey(
    parsed.source,
    parsed.idempotencyKey
  );

  if (existing) {
    return {
      status: "duplicate" as const,
      event: eventResponse(existing)
    };
  }

  const event = {
    ...parsed,
    storedAt: new Date().toISOString()
  };
  const status = await runtime.repositories.events.append(event);

  if (status === "stored" && event.event === "user.profile.updated" && event.personRef) {
    runtime.profiles.applyProfileUpdate({
      personRef: event.personRef,
      summary: event.summary,
      tags: event.tags,
      facts: event.facts,
      occurredAt: event.occurredAt
    });
  }

  return {
    status,
    event: eventResponse(event)
  };
}

export async function handleTokenUsageRecord(runtime: FounderOsRuntime, payload: unknown) {
  const usageInput = tokenUsageRequestSchema.parse(payload);
  const usage = await runtime.repositories.tokenUsage.record(usageInput);
  const policy = await runtime.repositories.tokenPolicies.find({
    projectKey: usageInput.projectKey,
    assistantKey: usageInput.assistantKey
  });

  return {
    status: "recorded" as const,
    usage,
    policy: policy
      ? {
          preferredModel: policy.preferredModel,
          fallbackModel: policy.fallbackModel,
          emergencyMode: policy.emergencyMode,
          maxTokensPerRequest: policy.maxTokensPerRequest
        }
      : null
  };
}

export async function handleTokenUsageSummary(runtime: FounderOsRuntime, payload: unknown) {
  const input = tokenUsageSummarySchema.parse(payload ?? {});
  const usage = await runtime.repositories.tokenUsage.findByProject(input.projectKey);
  const events = usage as NormalizedTokenUsageEvent[];
  const burnRate = summarizeTokenBurnRate({
    windowHours: input.windowHours,
    events: events.map((event) => ({
      costUsd: event.costUsd,
      totalTokens: event.totalTokens
    }))
  });

  return {
    status: "summarized" as const,
    summary: {
      projectKey: input.projectKey,
      windowHours: input.windowHours,
      eventCount: events.length,
      totalTokens: sum(events, (event) => event.totalTokens),
      totalCostUsd: roundMoney(sum(events, (event) => event.costUsd)),
      spendPerHourUsd: roundMoney(burnRate.spendPerHourUsd),
      tokensPerHour: burnRate.tokensPerHour,
      projectedDailySpendUsd: roundMoney(burnRate.projectedDailySpendUsd),
      byAssistant: groupUsage(events, (event) => event.assistantKey),
      byModel: groupUsage(events, (event) => event.model),
      byEnvironment: groupUsage(events, (event) => event.environment)
    }
  };
}

export async function handleTokenPolicySave(runtime: FounderOsRuntime, payload: unknown) {
  const input = tokenPolicyRequestSchema.parse(payload);
  const policy = await runtime.repositories.tokenPolicies.save(input);
  await recordTokenPolicyChange(runtime, policy, {});

  return {
    status: "saved" as const,
    policy
  };
}

export async function handleBulkTokenPolicySave(runtime: FounderOsRuntime, payload: unknown) {
  const input = bulkTokenPolicyRequestSchema.parse(payload);
  const policies = [];

  for (const target of input.targets) {
    const policy = await runtime.repositories.tokenPolicies.save({
      projectKey: target.projectKey,
      assistantKey: target.assistantKey,
      ...input.policy
    });
    await recordTokenPolicyChange(runtime, policy, {
      bulkApply: true,
      reason: input.reason
    });
    policies.push(policy);
  }

  return {
    status: "saved" as const,
    appliedCount: policies.length,
    policies
  };
}

export async function handleTokenPolicyLookup(
  runtime: FounderOsRuntime,
  input: {
    projectKey?: string | null;
    assistantKey?: string | null;
  }
) {
  if (!input.projectKey) {
    throw new Error("projectKey is required");
  }

  const policy = await runtime.repositories.tokenPolicies.find({
    projectKey: input.projectKey,
    assistantKey: input.assistantKey ?? undefined
  });

  if (!policy) {
    throw new Error("Token policy not found");
  }

  return { policy };
}

async function recordTokenPolicyChange(
  runtime: FounderOsRuntime,
  policy: z.infer<typeof tokenPolicyRequestSchema>,
  context: {
    bulkApply?: boolean;
    reason?: string;
  }
) {
  const now = new Date().toISOString();
  const subject = policy.assistantKey
    ? `${policy.projectKey}/${policy.assistantKey}`
    : policy.projectKey;
  const event: StructuredEvent = {
    idempotencyKey: `token-policy:${policy.projectKey}:${policy.assistantKey ?? "*"}:${randomUUID()}`,
    event: "token.policy.changed",
    source: "founder_os",
    project: policy.projectKey,
    summary: `Token policy changed for ${subject}.`,
    tags: [
      "token_policy",
      "ai_control",
      ...(policy.emergencyMode ? ["emergency_mode"] : [])
    ],
    facts: {
      assistant_key: policy.assistantKey,
      preferred_model: policy.preferredModel,
      fallback_model: policy.fallbackModel,
      daily_budget_usd: policy.dailyBudgetUsd,
      monthly_budget_usd: policy.monthlyBudgetUsd,
      max_tokens_per_request: policy.maxTokensPerRequest,
      emergency_mode: policy.emergencyMode,
      bulk_apply: context.bulkApply,
      reason: context.reason
    },
    occurredAt: now,
    storedAt: now
  };

  await runtime.repositories.events.append(event);
}

function groupUsage(
  events: NormalizedTokenUsageEvent[],
  keyFor: (event: NormalizedTokenUsageEvent) => string
) {
  const groups = new Map<string, { totalTokens: number; totalCostUsd: number; eventCount: number }>();

  for (const event of events) {
    const key = keyFor(event);
    const current = groups.get(key) ?? { totalTokens: 0, totalCostUsd: 0, eventCount: 0 };
    groups.set(key, {
      totalTokens: current.totalTokens + event.totalTokens,
      totalCostUsd: current.totalCostUsd + event.costUsd,
      eventCount: current.eventCount + 1
    });
  }

  return [...groups.entries()]
    .map(([key, value]) => ({
      key,
      totalTokens: value.totalTokens,
      totalCostUsd: roundMoney(value.totalCostUsd),
      eventCount: value.eventCount
    }))
    .sort((left, right) => right.totalCostUsd - left.totalCostUsd || left.key.localeCompare(right.key));
}

function sum<T>(items: T[], valueFor: (item: T) => number): number {
  return items.reduce((total, item) => total + valueFor(item), 0);
}

function roundMoney(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function eventResponse(event: {
  source: string;
  idempotencyKey: string;
  event: string;
  storedAt: string;
}) {
  return {
    source: event.source,
    idempotencyKey: event.idempotencyKey,
    name: event.event,
    storedAt: event.storedAt
  };
}
