import { z } from "zod";
import { randomUUID } from "node:crypto";
import { assessAiUsageRequest } from "@/domain/ai-usage/abuse-protection";
import type { StructuredEvent } from "@/domain/events/event-ingestion";
import {
  buildProjectImportReadiness,
  importProjectManifests
} from "@/domain/projects/project-bulk-import";
import {
  onboardProjectManifest,
  registerAiKeyReference,
  resolveProjectAiControl
} from "@/domain/projects/project-onboarding";
import type { FounderOsRuntime } from "@/server/founder-os-runtime";

export const projectManifestSchema = z.object({
  project_id: z.string().min(2),
  name: z.string().min(2),
  status: z.string().min(2),
  category: z.string().optional(),
  owner: z.string().min(2),
  workspace: z.string().optional(),
  repository: z
    .object({
      provider: z.string().min(2),
      name: z.string().min(2),
      local_path: z.string().optional()
    })
    .optional(),
  assistant: z
    .object({
      enabled: z.boolean().optional(),
      token_tracking_required: z.boolean().optional(),
      feedback_capture_required: z.boolean().optional()
    })
    .optional(),
  user_data: z
    .object({
      raw_message_storage: z.string().optional(),
      consent_required_for_marketing: z.boolean().optional()
    })
    .optional()
});

export const aiKeyReferenceSchema = z.object({
  projectKey: z.string().min(2),
  provider: z.enum(["openai", "anthropic", "google", "other"]),
  secretRef: z.string().min(4),
  displayName: z.string().min(2),
  allowedModels: z.array(z.string().min(2)).min(1),
  defaultModel: z.string().min(2),
  monthlyBudgetUsd: z.number().min(0),
  plaintextSecret: z.string().optional()
});

export const aiControlResolveSchema = z.object({
  projectKey: z.string().min(2),
  requestedModel: z.string().min(2).optional()
});

export const aiUsageAssessmentSchema = z.object({
  projectKey: z.string().min(2),
  assistantKey: z.string().min(2),
  userRef: z.string().optional(),
  productScope: z.string().min(10),
  requestSummary: z.string().min(2),
  requestedModel: z.string().min(2),
  estimatedTokens: z.number().int().min(0),
  recentRequestsInHour: z.number().int().min(0)
});

export const aiExecutionDecisionSchema = aiUsageAssessmentSchema;

export const aiExecutionDecisionAuditListSchema = z.object({
  projectKey: z.string().min(2).optional(),
  limit: z.number().int().min(1).max(100).default(25)
});

export const aiExecutionSummarySchema = z.object({
  projectKey: z.string().min(2).optional()
});

export const bulkProjectImportSchema = z.object({
  manifests: z.array(
    z.object({
      path: z.string().min(1),
      content: z.string().min(1)
    })
  )
});

export async function handleProjectManifestOnboarding(
  runtime: FounderOsRuntime,
  payload: unknown
) {
  const result = onboardProjectManifest(runtime.projectOnboarding, projectManifestSchema.parse(payload));
  return { status: "onboarded" as const, ...result };
}

export async function handleAiKeyReferenceRegistration(
  runtime: FounderOsRuntime,
  payload: unknown
) {
  const key = registerAiKeyReference(runtime.projectOnboarding, aiKeyReferenceSchema.parse(payload));
  return { status: "registered" as const, key };
}

export async function handleProjectAiControlResolve(
  runtime: FounderOsRuntime,
  payload: unknown
) {
  return {
    status: "resolved" as const,
    control: resolveProjectAiControl(runtime.projectOnboarding, aiControlResolveSchema.parse(payload))
  };
}

export async function handleAiUsageAssessment(_runtime: FounderOsRuntime, payload: unknown) {
  return {
    status: "assessed" as const,
    assessment: assessAiUsageRequest(aiUsageAssessmentSchema.parse(payload))
  };
}

export async function handleAiExecutionDecision(runtime: FounderOsRuntime, payload: unknown) {
  const input = aiExecutionDecisionSchema.parse(payload);
  const assessment = assessAiUsageRequest(input);

  if (!assessment.allowed) {
    const decision = {
      allowed: false,
      action: assessment.recommendedAction,
      provider: undefined,
      model: undefined,
      secretRef: undefined,
      monthlyBudgetUsd: undefined,
      reasons: assessment.reasons,
      userFacingResponse: assessment.userFacingResponse
    };
    recordAiExecutionDecision(runtime, input, assessment, decision);

    return {
      status: "decided" as const,
      decision
    };
  }

  const requestedModel =
    assessment.modelDirective === "fallback" ? undefined : input.requestedModel;
  const control = resolveProjectAiControl(runtime.projectOnboarding, {
    projectKey: input.projectKey,
    requestedModel
  });

  if (!control.allowed) {
    const decision = {
      allowed: false,
      action: "block" as const,
      provider: undefined,
      model: undefined,
      secretRef: undefined,
      monthlyBudgetUsd: undefined,
      reasons: control.reasons,
      userFacingResponse: assessment.userFacingResponse
    };
    recordAiExecutionDecision(runtime, input, assessment, decision);

    return {
      status: "decided" as const,
      decision
    };
  }

  const decision = {
    allowed: true,
    action: assessment.recommendedAction,
    provider: control.provider,
    model: control.model,
    secretRef: control.secretRef,
    monthlyBudgetUsd: control.monthlyBudgetUsd,
    reasons: [...assessment.reasons, ...control.reasons],
    userFacingResponse: assessment.userFacingResponse
  };
  recordAiExecutionDecision(runtime, input, assessment, decision);

  return {
    status: "decided" as const,
    decision
  };
}

export async function handleAiExecutionDecisionAuditList(
  runtime: FounderOsRuntime,
  payload: unknown
) {
  const input = aiExecutionDecisionAuditListSchema.parse(payload ?? {});
  const events = runtime.events
    .all()
    .filter((event) => event.event === "assistant.ai_execution.decided")
    .filter((event) => !input.projectKey || event.project === input.projectKey)
    .slice(-input.limit)
    .reverse();

  return {
    status: "listed" as const,
    decisions: events.map((event) => ({
      occurredAt: event.occurredAt,
      projectKey: event.project,
      assistantKey: event.facts.assistant_key,
      personRef: event.personRef,
      action: event.facts.action,
      allowed: event.facts.allowed,
      riskLevel: event.facts.risk_level,
      reasons: event.facts.reasons,
      requestedModel: event.facts.requested_model,
      model: event.facts.model,
      provider: event.facts.provider,
      estimatedTokens: event.facts.estimated_tokens
    }))
  };
}

export async function handleAiExecutionSummary(runtime: FounderOsRuntime, payload: unknown) {
  const input = aiExecutionSummarySchema.parse(payload ?? {});
  const decisions = runtime.events
    .all()
    .filter((event) => event.event === "assistant.ai_execution.decided")
    .filter((event) => !input.projectKey || event.project === input.projectKey);

  const actionCounts = countBy(decisions.map((event) => String(event.facts.action)));
  const riskCounts = countBy(decisions.map((event) => String(event.facts.risk_level)));
  const reasonCounts = countBy(
    decisions.flatMap((event) =>
      Array.isArray(event.facts.reasons) ? event.facts.reasons.map(String) : []
    )
  );
  const estimatedTokensTotal = decisions.reduce(
    (sum, event) => sum + Number(event.facts.estimated_tokens ?? 0),
    0
  );
  const estimatedTokensUnderRisk = decisions
    .filter((event) => event.facts.risk_level !== "low")
    .reduce((sum, event) => sum + Number(event.facts.estimated_tokens ?? 0), 0);
  const lastDecision = decisions.at(-1);

  return {
    status: "summarized" as const,
    summary: {
      projectKey: input.projectKey,
      totalDecisions: decisions.length,
      allowedDecisions: decisions.filter((event) => event.facts.allowed === true).length,
      blockedDecisions: decisions.filter((event) => event.facts.allowed === false).length,
      actionCounts,
      riskCounts,
      estimatedTokensTotal,
      estimatedTokensUnderRisk,
      topReasons: Object.entries(reasonCounts).map(([reason, count]) => ({ reason, count })),
      lastAction: lastDecision?.facts.action
    }
  };
}

function recordAiExecutionDecision(
  runtime: FounderOsRuntime,
  input: z.infer<typeof aiExecutionDecisionSchema>,
  assessment: ReturnType<typeof assessAiUsageRequest>,
  decision: {
    allowed: boolean;
    action: string;
    provider?: string;
    model?: string;
    reasons: string[];
  }
) {
  const now = new Date().toISOString();
  const event: StructuredEvent = {
    idempotencyKey: `ai-execution:${input.projectKey}:${input.assistantKey}:${randomUUID()}`,
    event: "assistant.ai_execution.decided",
    source: "founder_os",
    personRef: input.userRef,
    project: input.projectKey,
    summary: `AI execution decision: ${decision.action} for ${input.projectKey}/${input.assistantKey}.`,
    tags: ["ai_execution", decision.action, `risk:${assessment.riskLevel}`],
    facts: {
      action: decision.action,
      allowed: decision.allowed,
      assistant_key: input.assistantKey,
      estimated_tokens: input.estimatedTokens,
      model: decision.model,
      model_directive: assessment.modelDirective,
      provider: decision.provider,
      reasons: decision.reasons,
      requested_model: input.requestedModel,
      risk_level: assessment.riskLevel
    },
    occurredAt: now,
    storedAt: now
  };

  runtime.events.append(event);
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

export async function handleBulkProjectImport(runtime: FounderOsRuntime, payload: unknown) {
  const input = bulkProjectImportSchema.parse(payload);
  const report = importProjectManifests(runtime.projectOnboarding, input.manifests);
  const readiness = buildProjectImportReadiness(
    runtime.projectOnboarding,
    report.imported.map((item) => item.projectKey)
  );

  return { status: "imported" as const, report, readiness };
}
