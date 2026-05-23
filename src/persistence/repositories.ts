import type { StructuredEvent } from "@/domain/events/event-ingestion";
import type {
  AiKeyReference,
  OnboardedProject,
  OnboardedRepository,
  ProjectControls
} from "@/domain/projects/project-onboarding";
import type { NormalizedTokenUsageEvent, TokenUsageInput } from "@/domain/token-control/token-control";
import type {
  TokenPolicyRecord
} from "@/domain/token-control/token-control-service";

export type EventAppendResult = "stored" | "duplicate";

export type EventRepository = {
  append(event: StructuredEvent): Promise<EventAppendResult>;
  findByIdempotencyKey(source: string, idempotencyKey: string): Promise<StructuredEvent | undefined>;
};

export type TokenUsageRepository = {
  record(usage: TokenUsageInput | PersistedTokenUsageInput): Promise<NormalizedTokenUsageEvent | unknown>;
  findByProject(projectKey: string): Promise<NormalizedTokenUsageEvent[]>;
};

export type TokenPolicyRepository = {
  save(policy: TokenPolicyRecord): Promise<TokenPolicyRecord>;
  find(input: { projectKey: string; assistantKey?: string }): Promise<TokenPolicyRecord | undefined>;
};

export type ProjectOnboardingRepository = {
  saveProject(input: {
    project: OnboardedProject;
    repository?: OnboardedRepository;
    controls: ProjectControls;
  }): Promise<{
    project: OnboardedProject;
    repository?: OnboardedRepository;
    controls: ProjectControls;
  }>;
  saveAiKey(key: AiKeyReference): Promise<AiKeyReference>;
  aiKeysForProject(projectKey: string): Promise<AiKeyReference[]>;
  allProjects(): Promise<OnboardedProject[]>;
  project(projectKey: string): Promise<OnboardedProject | undefined>;
  repository(projectKey: string): Promise<OnboardedRepository | undefined>;
  projectControls(projectKey: string): Promise<ProjectControls | undefined>;
};

export type RepositorySet = {
  kind: "memory" | "prisma";
  events: EventRepository;
  tokenUsage: TokenUsageRepository;
  tokenPolicies: TokenPolicyRepository;
  projects: ProjectOnboardingRepository;
};

export type PersistedTokenUsageInput = {
  projectId: string;
  assistantId?: string;
  personId?: string;
  environment: "local" | "staging" | "production" | "client-isolated";
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  occurredAt: string;
};
