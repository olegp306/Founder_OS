import { z } from "zod";
import { randomUUID } from "node:crypto";
import { assessAiUsageRequest } from "@/domain/ai-usage/abuse-protection";
import type { StructuredEvent } from "@/domain/events/event-ingestion";
import {
  hasRequiredIdentity,
  parseManifestFile,
  type ManifestFile,
  type ProjectImportReport
} from "@/domain/projects/project-bulk-import";
import {
  handleTokenPolicySave,
  tokenPolicyRequestSchema
} from "@/server/api-services";
import {
  buildAiKeyReference,
  buildProjectOnboardingRecord
} from "@/domain/projects/project-onboarding";
import { getSafeTokenPolicy } from "@/domain/token-control/token-control-service";
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
  environment: z.enum(["local", "staging", "production"]).default("production"),
  rotationDueAt: z.string().datetime().optional(),
  lastVerifiedAt: z.string().datetime().optional(),
  plaintextSecret: z.string().optional()
});

export const aiKeyReferenceInventorySchema = z.object({
  projectKey: z.string().min(2).optional(),
  provider: z.enum(["openai", "anthropic", "google", "other"]).optional(),
  asOf: z.string().datetime().optional()
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

export const projectReadinessListSchema = z.object({
  projectKeys: z.array(z.string().min(2)).min(1),
  assistantKey: z.string().min(2).optional()
});

export const projectConnectionBundleSchema = z.object({
  projectKey: z.string().min(2),
  assistantKey: z.string().min(2)
});

export const projectListSchema = z.object({
  assistantKey: z.string().min(2).optional()
});

export const projectAiSetupSchema = z.object({
  projectKey: z.string().min(2),
  assistantKey: z.string().min(2),
  aiKey: aiKeyReferenceSchema.omit({ projectKey: true }),
  tokenPolicy: tokenPolicyRequestSchema.omit({
    projectKey: true,
    assistantKey: true
  })
});

export async function handleProjectManifestOnboarding(
  runtime: FounderOsRuntime,
  payload: unknown
) {
  const result = await runtime.repositories.projects.saveProject(
    buildProjectOnboardingRecord(projectManifestSchema.parse(payload))
  );
  return { status: "onboarded" as const, ...result };
}

export async function handleAiKeyReferenceRegistration(
  runtime: FounderOsRuntime,
  payload: unknown
) {
  const key = await runtime.repositories.projects.saveAiKey(
    buildAiKeyReference(aiKeyReferenceSchema.parse(payload))
  );
  return { status: "registered" as const, key };
}

export async function handleAiKeyReferenceInventory(
  runtime: FounderOsRuntime,
  payload: unknown
) {
  const input = aiKeyReferenceInventorySchema.parse(payload ?? {});
  const asOf = input.asOf ? new Date(input.asOf) : new Date();
  const projects = (await runtime.repositories.projects.allProjects())
    .filter((project) => !input.projectKey || project.key === input.projectKey);
  const inventoryProjects = await Promise.all(projects.map(async (project) => {
    const references = (await runtime.repositories.projects.aiKeysForProject(project.key))
      .filter((reference) => !input.provider || reference.provider === input.provider)
      .map((reference) => ({
        provider: reference.provider,
        secretRef: reference.secretRef,
        displayName: reference.displayName,
        allowedModels: reference.allowedModels,
        defaultModel: reference.defaultModel,
        monthlyBudgetUsd: reference.monthlyBudgetUsd,
        environment: reference.environment ?? "production",
        rotationDueAt: reference.rotationDueAt,
        lastVerifiedAt: reference.lastVerifiedAt,
        rotationStatus: rotationStatusFor(reference.rotationDueAt, asOf),
        status: reference.status
      }))
      .sort((left, right) =>
        left.provider.localeCompare(right.provider) ||
        left.displayName.localeCompare(right.displayName)
      );
    const monthlyBudgetUsd = sum(references, (reference) => reference.monthlyBudgetUsd);

    return {
      projectKey: project.key,
      name: project.name,
      referenceCount: references.length,
      monthlyBudgetUsd,
      references
    };
  }));
  const visibleProjects = inventoryProjects.filter((project) =>
    project.referenceCount > 0 || input.projectKey
  );
  const references = visibleProjects.flatMap((project) => project.references);

  return {
    status: "listed" as const,
    totalReferences: references.length,
    totalMonthlyBudgetUsd: sum(references, (reference) => reference.monthlyBudgetUsd),
    byProvider: summarizeAiKeyProviders(references),
    projects: visibleProjects
  };
}

export async function handleProjectAiControlResolve(
  runtime: FounderOsRuntime,
  payload: unknown
) {
  return {
    status: "resolved" as const,
    control: await resolveProjectAiControlFromRepository(
      runtime,
      aiControlResolveSchema.parse(payload)
    )
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

  const policy = await runtime.repositories.tokenPolicies.find({
    projectKey: input.projectKey,
    assistantKey: input.assistantKey
  });
  const policyDecision = policy
    ? getSafeTokenPolicy({
        activePolicy: {
          projectKey: policy.projectKey,
          preferredModel: policy.preferredModel,
          fallbackModel: policy.fallbackModel,
          maxTokensPerRequest: policy.maxTokensPerRequest,
          emergencyMode: policy.emergencyMode
        },
        lastKnownSafePolicy: {
          projectKey: policy.projectKey,
          preferredModel: policy.preferredModel,
          fallbackModel: policy.fallbackModel,
          maxTokensPerRequest: policy.maxTokensPerRequest,
          emergencyMode: policy.emergencyMode
        },
        requestedTokens: input.estimatedTokens
      })
    : undefined;

  if (policyDecision && !policyDecision.allowed) {
    const decision = {
      allowed: false,
      action: "block" as const,
      provider: undefined,
      model: undefined,
      secretRef: undefined,
      monthlyBudgetUsd: undefined,
      reasons: policyDecision.reasons,
      userFacingResponse: assessment.userFacingResponse,
      policySource: policyDecision.source
    };
    recordAiExecutionDecision(runtime, input, assessment, decision);

    return {
      status: "decided" as const,
      decision
    };
  }

  const requestedModel = selectExecutionModel(
    input.requestedModel,
    assessment,
    policyDecision,
    policy
  );
  const control = await resolveProjectAiControlFromRepository(runtime, {
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
    action: policyDecision?.reasons.length
      ? "downgrade" as const
      : assessment.recommendedAction,
    provider: control.provider,
    model: control.model,
    secretRef: control.secretRef,
    monthlyBudgetUsd: control.monthlyBudgetUsd,
    reasons: [...assessment.reasons, ...(policyDecision?.reasons ?? []), ...control.reasons],
    userFacingResponse: assessment.userFacingResponse,
    policySource: policyDecision?.source
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
    policySource?: string;
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
      policy_source: decision.policySource,
      reasons: decision.reasons,
      requested_model: input.requestedModel,
      risk_level: assessment.riskLevel
    },
    occurredAt: now,
    storedAt: now
  };

  runtime.events.append(event);
}

function selectExecutionModel(
  requestedModel: string,
  assessment: ReturnType<typeof assessAiUsageRequest>,
  policyDecision?: ReturnType<typeof getSafeTokenPolicy>,
  policy?: { fallbackModel: string }
): string | undefined {
  if (!policyDecision) {
    return assessment.modelDirective === "fallback" ? undefined : requestedModel;
  }

  if (assessment.modelDirective === "fallback") {
    return policy?.fallbackModel ?? policyDecision.model;
  }

  return policyDecision.model;
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function sum<T>(items: T[], valueFor: (item: T) => number): number {
  return items.reduce((total, item) => total + valueFor(item), 0);
}

function summarizeAiKeyProviders(
  references: Array<{
    provider: string;
    monthlyBudgetUsd: number;
    rotationStatus: string;
  }>
) {
  const providers = new Map<string, {
    provider: string;
    referenceCount: number;
    monthlyBudgetUsd: number;
    rotationDueSoonCount: number;
    rotationOverdueCount: number;
  }>();

  for (const reference of references) {
    const current = providers.get(reference.provider) ?? {
      provider: reference.provider,
      referenceCount: 0,
      monthlyBudgetUsd: 0,
      rotationDueSoonCount: 0,
      rotationOverdueCount: 0
    };
    providers.set(reference.provider, {
      provider: reference.provider,
      referenceCount: current.referenceCount + 1,
      monthlyBudgetUsd: current.monthlyBudgetUsd + reference.monthlyBudgetUsd,
      rotationDueSoonCount: current.rotationDueSoonCount + (reference.rotationStatus === "due_soon" ? 1 : 0),
      rotationOverdueCount: current.rotationOverdueCount + (reference.rotationStatus === "overdue" ? 1 : 0)
    });
  }

  return [...providers.values()].sort((left, right) => left.provider.localeCompare(right.provider));
}

function rotationStatusFor(rotationDueAt: string | undefined, asOf: Date) {
  if (!rotationDueAt) {
    return "unknown" as const;
  }

  const dueAt = new Date(rotationDueAt);
  if (Number.isNaN(dueAt.valueOf())) {
    return "unknown" as const;
  }

  if (dueAt.getTime() < asOf.getTime()) {
    return "overdue" as const;
  }

  const daysUntilDue = (dueAt.getTime() - asOf.getTime()) / (1000 * 60 * 60 * 24);
  return daysUntilDue <= 30 ? "due_soon" as const : "ok" as const;
}

async function resolveProjectAiControlFromRepository(
  runtime: FounderOsRuntime,
  input: {
    projectKey: string;
    requestedModel?: string;
  }
) {
  const key = (await runtime.repositories.projects.aiKeysForProject(input.projectKey))
    .find((item) => item.status === "active");

  if (!key) {
    return {
      allowed: false,
      provider: undefined,
      model: undefined,
      secretRef: undefined,
      monthlyBudgetUsd: undefined,
      reasons: ["ai_key_not_configured"]
    };
  }

  const requestedAllowed = input.requestedModel
    ? key.allowedModels.includes(input.requestedModel)
    : true;

  return {
    allowed: true,
    provider: key.provider,
    model: requestedAllowed ? input.requestedModel ?? key.defaultModel : key.defaultModel,
    secretRef: key.secretRef,
    monthlyBudgetUsd: key.monthlyBudgetUsd,
    reasons: requestedAllowed ? [] : ["requested_model_not_allowed"]
  };
}

async function importProjectManifestsWithRepository(
  runtime: FounderOsRuntime,
  files: ManifestFile[]
): Promise<ProjectImportReport> {
  const report: ProjectImportReport = {
    imported: [],
    skipped: [],
    invalid: []
  };

  for (const file of files) {
    const parsed = parseManifestFile(file);

    if (parsed === "invalid_json") {
      report.invalid.push({
        manifestPath: file.path,
        reason: "invalid_json"
      });
      continue;
    }

    if (!hasRequiredIdentity(parsed)) {
      report.skipped.push({
        manifestPath: file.path,
        reason: "missing_required_fields"
      });
      continue;
    }

    const result = await runtime.repositories.projects.saveProject(
      buildProjectOnboardingRecord(parsed)
    );
    report.imported.push({
      projectKey: result.project.key,
      name: result.project.name,
      manifestPath: file.path
    });
  }

  return report;
}

async function buildProjectImportReadinessFromRepository(
  runtime: FounderOsRuntime,
  projectKeys: string[]
) {
  return Promise.all(projectKeys.map(async (projectKey) => {
    const [project, aiKeys, controls] = await Promise.all([
      runtime.repositories.projects.project(projectKey),
      runtime.repositories.projects.aiKeysForProject(projectKey),
      runtime.repositories.projects.projectControls(projectKey)
    ]);

    return {
      projectKey,
      manifestImported: Boolean(project),
      aiKeyConfigured: aiKeys.length > 0,
      tokenTrackingRequired: controls?.tokenTrackingRequired ?? false,
      feedbackCaptureRequired: controls?.feedbackCaptureRequired ?? false,
      rawMessageStorage: controls?.rawMessageStorage ?? "unknown"
    };
  }));
}

export async function handleBulkProjectImport(runtime: FounderOsRuntime, payload: unknown) {
  const input = bulkProjectImportSchema.parse(payload);
  const report = await importProjectManifestsWithRepository(runtime, input.manifests);
  const { readiness } = await handleProjectReadinessList(runtime, {
    projectKeys: report.imported.map((item) => item.projectKey)
  });

  return { status: "imported" as const, report, readiness };
}

export async function handleProjectReadinessList(
  runtime: FounderOsRuntime,
  payload: unknown
) {
  const input = projectReadinessListSchema.parse(payload);
  const baseReadiness = await buildProjectImportReadinessFromRepository(runtime, input.projectKeys);
  const readiness = await Promise.all(
    baseReadiness.map(async (project) => {
      const policy = await runtime.repositories.tokenPolicies.find({
        projectKey: project.projectKey,
        assistantKey: input.assistantKey
      });

      return {
        ...project,
        tokenPolicyConfigured: Boolean(policy)
      };
    })
  );

  return {
    status: "listed" as const,
    readiness
  };
}

export async function handleProjectList(runtime: FounderOsRuntime, payload: unknown) {
  const input = projectListSchema.parse(payload ?? {});
  const projects = await runtime.repositories.projects.allProjects();
  const { readiness } = projects.length === 0
    ? { readiness: [] }
    : await handleProjectReadinessList(runtime, {
        projectKeys: projects.map((project) => project.key),
        assistantKey: input.assistantKey
      });
  const readinessByProject = new Map(
    readiness.map((item) => [item.projectKey, item])
  );

  const projectSummaries = await Promise.all(projects.map(async (project) => {
    const projectReadiness = readinessByProject.get(project.key);
    const missing = readinessMissingLabels(projectReadiness);

    return {
      projectKey: project.key,
      name: project.name,
      status: project.status,
      owner: project.owner,
      category: project.category,
      workspace: project.workspace,
      repository: summarizeRepository(await runtime.repositories.projects.repository(project.key)),
      readyCount: 6 - missing.length,
      totalCount: 6,
      ready: missing.length === 0,
      missing
    };
  }));

  return {
    status: "listed" as const,
    projects: projectSummaries
  };
}

function summarizeRepository(repository:
  | {
      provider: string;
      name: string;
      localPath?: string;
    }
  | undefined
) {
  return repository
    ? {
        provider: repository.provider,
        name: repository.name,
        localPath: repository.localPath
      }
    : undefined;
}

export async function handleProjectConnectionBundle(
  runtime: FounderOsRuntime,
  payload: unknown
) {
  const input = projectConnectionBundleSchema.parse(payload);
  const project = await runtime.repositories.projects.project(input.projectKey);
  const aiKeyReferences = (await runtime.repositories.projects.aiKeysForProject(input.projectKey))
    .map((key) => ({
      provider: key.provider,
      secretRef: key.secretRef,
      displayName: key.displayName,
      allowedModels: key.allowedModels,
      defaultModel: key.defaultModel,
      monthlyBudgetUsd: key.monthlyBudgetUsd,
      status: key.status
    }));
  const { readiness } = await handleProjectReadinessList(runtime, {
    projectKeys: [input.projectKey],
    assistantKey: input.assistantKey
  });
  const projectReadiness = readiness[0];
  const policy = await runtime.repositories.tokenPolicies.find({
    projectKey: input.projectKey,
    assistantKey: input.assistantKey
  });
  const nextSteps = [
    ...(projectReadiness.manifestImported ? [] : ["Import .founderos/project.json"]),
    ...(projectReadiness.aiKeyConfigured ? [] : ["Register AI key reference in Founder OS"]),
    ...(projectReadiness.tokenPolicyConfigured ? [] : ["Configure token policy for this assistant"]),
    ...(projectReadiness.tokenTrackingRequired ? [] : ["Enable token tracking in the project manifest"]),
    ...(projectReadiness.feedbackCaptureRequired ? [] : ["Enable feedback capture in the project manifest"]),
    ...(projectReadiness.rawMessageStorage === "disabled_by_default"
      ? []
      : ["Disable raw message storage by default"])
  ];

  return {
    status: "built" as const,
    bundle: {
      projectKey: input.projectKey,
      assistantKey: input.assistantKey,
      ready: nextSteps.length === 0,
      project: {
        name: project?.name ?? input.projectKey,
        status: project?.status ?? "unknown",
        owner: project?.owner ?? "unknown"
      },
      environment: [
        { name: "FOUNDER_OS_BASE_URL", required: true, valueHint: "https://<founder-os-host>" },
        { name: "FOUNDER_OS_ADMIN_TOKEN", required: true, valueHint: "secret-manager-ref" },
        { name: "FOUNDER_OS_PROJECT_KEY", required: true, valueHint: input.projectKey },
        { name: "FOUNDER_OS_ASSISTANT_KEY", required: true, valueHint: input.assistantKey }
      ],
      routes: [
        {
          method: "POST",
          path: "/api/ai-execution/decide",
          purpose: "preflight model, budget, and abuse control before provider execution"
        },
        {
          method: "POST",
          path: "/api/token-usage",
          purpose: "record token usage after provider execution"
        },
        {
          method: "GET",
          path: "/api/token-usage/summary",
          purpose: "inspect token spend, burn rate, and projected daily spend"
        },
        {
          method: "GET",
          path: "/api/projects/readiness",
          purpose: "verify project transfer readiness"
        },
        {
          method: "GET",
          path: "/api/projects/launch-evidence",
          purpose: "collect safe launch evidence before routing live traffic"
        }
      ],
      aiKeyReferences,
      readiness: {
        manifestImported: projectReadiness.manifestImported,
        aiKeyConfigured: projectReadiness.aiKeyConfigured,
        tokenPolicyConfigured: projectReadiness.tokenPolicyConfigured,
        tokenTrackingRequired: projectReadiness.tokenTrackingRequired,
        feedbackCaptureRequired: projectReadiness.feedbackCaptureRequired,
        rawMessageStorage: projectReadiness.rawMessageStorage
      },
      tokenPolicy: policy
        ? {
            configured: true,
            preferredModel: policy.preferredModel,
            fallbackModel: policy.fallbackModel,
            dailyBudgetUsd: policy.dailyBudgetUsd,
            monthlyBudgetUsd: policy.monthlyBudgetUsd,
            maxTokensPerRequest: policy.maxTokensPerRequest,
            emergencyMode: policy.emergencyMode
          }
        : {
            configured: false,
            preferredModel: undefined,
            fallbackModel: undefined,
            dailyBudgetUsd: undefined,
            monthlyBudgetUsd: undefined,
            maxTokensPerRequest: undefined,
            emergencyMode: undefined
          },
      nextSteps
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

export async function handleProjectAiSetup(
  runtime: FounderOsRuntime,
  payload: unknown
) {
  const input = projectAiSetupSchema.parse(payload);
  const key = await runtime.repositories.projects.saveAiKey(
    buildAiKeyReference({
      projectKey: input.projectKey,
      ...input.aiKey
    })
  );
  const { policy } = await handleTokenPolicySave(runtime, {
    projectKey: input.projectKey,
    assistantKey: input.assistantKey,
    ...input.tokenPolicy
  });
  const { bundle } = await handleProjectConnectionBundle(runtime, {
    projectKey: input.projectKey,
    assistantKey: input.assistantKey
  });

  return {
    status: "configured" as const,
    key,
    policy,
    bundle
  };
}
