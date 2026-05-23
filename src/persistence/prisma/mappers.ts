import type { StructuredEvent } from "@/domain/events/event-ingestion";

type EnvironmentInput = "local" | "staging" | "production" | "client-isolated";

const environmentMap: Record<EnvironmentInput, string> = {
  local: "LOCAL",
  staging: "STAGING",
  production: "PRODUCTION",
  "client-isolated": "CLIENT_ISOLATED"
};

export function mapStructuredEventToPrismaCreate(event: StructuredEvent) {
  return {
    source: event.source,
    idempotencyKey: event.idempotencyKey,
    name: event.event,
    personRef: event.personRef,
    summary: event.summary,
    tags: event.tags,
    facts: event.facts,
    occurredAt: new Date(event.occurredAt),
    storedAt: new Date(event.storedAt)
  };
}

export function mapTokenUsageToPrismaCreate(input: {
  projectId: string;
  assistantId?: string;
  personId?: string;
  environment: EnvironmentInput;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  occurredAt: string;
}) {
  return {
    projectId: input.projectId,
    assistantId: input.assistantId,
    personId: input.personId,
    environment: environmentMap[input.environment],
    model: input.model,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    totalTokens: input.totalTokens,
    costUsd: input.costUsd.toString(),
    occurredAt: new Date(input.occurredAt)
  };
}

export function mapTokenPolicyToPrismaCreate(input: {
  projectId: string;
  assistantId?: string;
  preferredModel: string;
  fallbackModel: string;
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
  maxTokensPerRequest: number;
  emergencyMode: boolean;
}) {
  return {
    projectId: input.projectId,
    assistantId: input.assistantId,
    preferredModel: input.preferredModel,
    fallbackModel: input.fallbackModel,
    dailyBudgetUsd: input.dailyBudgetUsd.toString(),
    monthlyBudgetUsd: input.monthlyBudgetUsd.toString(),
    maxTokensPerRequest: input.maxTokensPerRequest,
    emergencyMode: input.emergencyMode,
    emergencyAction: input.emergencyMode ? "DOWNGRADE_MODEL" : "NONE"
  };
}
