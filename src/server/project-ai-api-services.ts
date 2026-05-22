import { z } from "zod";
import { assessAiUsageRequest } from "@/domain/ai-usage/abuse-protection";
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

export async function handleBulkProjectImport(runtime: FounderOsRuntime, payload: unknown) {
  const input = bulkProjectImportSchema.parse(payload);
  const report = importProjectManifests(runtime.projectOnboarding, input.manifests);
  const readiness = buildProjectImportReadiness(
    runtime.projectOnboarding,
    report.imported.map((item) => item.projectKey)
  );

  return { status: "imported" as const, report, readiness };
}
