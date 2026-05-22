import { randomUUID } from "node:crypto";
import { z } from "zod";
import { rejectUnsafeRawPayload, type StructuredEvent } from "@/domain/events/event-ingestion";
import type { TokenUsageInput } from "@/domain/token-control/token-control";
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

export async function handleTokenPolicySave(runtime: FounderOsRuntime, payload: unknown) {
  const input = tokenPolicyRequestSchema.parse(payload);
  const policy = await runtime.repositories.tokenPolicies.save(input);
  await recordTokenPolicyChange(runtime, policy);

  return {
    status: "saved" as const,
    policy
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
  policy: z.infer<typeof tokenPolicyRequestSchema>
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
      emergency_mode: policy.emergencyMode
    },
    occurredAt: now,
    storedAt: now
  };

  await runtime.repositories.events.append(event);
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
