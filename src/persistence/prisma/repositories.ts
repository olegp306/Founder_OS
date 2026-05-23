import type { StructuredEvent } from "@/domain/events/event-ingestion";
import {
  type AiKeyReference,
  type OnboardedProject,
  type OnboardedRepository,
  type ProjectControls
} from "@/domain/projects/project-onboarding";
import {
  normalizeTokenUsageEvent,
  type NormalizedTokenUsageEvent,
  type TokenUsageInput
} from "@/domain/token-control/token-control";
import type { TokenPolicyRecord } from "@/domain/token-control/token-control-service";
import type { PersistedTokenUsageInput, RepositorySet } from "@/persistence/repositories";
import {
  mapStructuredEventToPrismaCreate,
  mapTokenPolicyToPrismaCreate,
  mapTokenUsageToPrismaCreate
} from "@/persistence/prisma/mappers";

export type PrismaLike = {
  project?: {
    upsert?(input: unknown): Promise<unknown>;
    findUnique?(input: unknown): Promise<unknown>;
    findMany?(input: unknown): Promise<unknown[]>;
  };
  assistant?: {
    findFirst?(input: unknown): Promise<unknown>;
  };
  repository?: {
    upsert?(input: unknown): Promise<unknown>;
    findFirst?(input: unknown): Promise<unknown>;
  };
  projectControl?: {
    upsert?(input: unknown): Promise<unknown>;
    findFirst?(input: unknown): Promise<unknown>;
  };
  aiKeyReference?: {
    upsert?(input: unknown): Promise<unknown>;
    findMany?(input: unknown): Promise<unknown[]>;
  };
  event?: {
    findUnique?(input: unknown): Promise<unknown>;
    create?(input: unknown): Promise<unknown>;
  };
  tokenUsageEvent?: {
    create?(input: unknown): Promise<unknown>;
    findMany?(input: unknown): Promise<unknown[]>;
  };
  tokenPolicy?: {
    create?(input: unknown): Promise<unknown>;
    findFirst?(input: unknown): Promise<unknown>;
  };
};

export class PrismaRepositorySet implements RepositorySet {
  readonly kind = "prisma" as const;
  readonly events: PrismaEventRepository;
  readonly tokenUsage: PrismaTokenUsageRepository;
  readonly tokenPolicies: PrismaTokenPolicyRepository;
  readonly projects: PrismaProjectOnboardingRepository;

  constructor(private readonly prisma: PrismaLike) {
    this.events = new PrismaEventRepository(prisma);
    this.tokenUsage = new PrismaTokenUsageRepository(prisma);
    this.tokenPolicies = new PrismaTokenPolicyRepository(prisma);
    this.projects = new PrismaProjectOnboardingRepository(prisma);
  }
}

class PrismaEventRepository {
  constructor(private readonly prisma: PrismaLike) {}

  async append(event: StructuredEvent) {
    if (!this.prisma.event?.findUnique || !this.prisma.event.create) {
      throw new Error("Prisma event delegate is unavailable");
    }

    const existing = await this.prisma.event.findUnique({
      where: {
        source_idempotencyKey: {
          source: event.source,
          idempotencyKey: event.idempotencyKey
        }
      }
    });

    if (existing) {
      return "duplicate";
    }

    await this.prisma.event.create({
      data: mapStructuredEventToPrismaCreate(event)
    });

    return "stored";
  }

  async findByIdempotencyKey(source: string, idempotencyKey: string) {
    if (!this.prisma.event?.findUnique) {
      throw new Error("Prisma event delegate is unavailable");
    }

    return this.prisma.event.findUnique({
      where: {
        source_idempotencyKey: {
          source,
          idempotencyKey
        }
      }
    }) as Promise<StructuredEvent | undefined>;
  }
}

class PrismaTokenUsageRepository {
  constructor(private readonly prisma: PrismaLike) {}

  async record(usage: TokenUsageInput | PersistedTokenUsageInput) {
    if (!this.prisma.tokenUsageEvent?.create) {
      throw new Error("Prisma tokenUsageEvent delegate is unavailable");
    }

    if ("projectKey" in usage) {
      const normalized = normalizeTokenUsageEvent(usage);
      const project = await resolveProjectByKey(this.prisma, usage.projectKey);
      const assistant = await resolveAssistantByKey(this.prisma, project.id, usage.assistantKey);
      const row = await this.prisma.tokenUsageEvent.create({
        data: mapTokenUsageToPrismaCreate({
          projectId: project.id,
          assistantId: assistant?.id,
          environment: usage.environment,
          model: usage.model,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: normalized.totalTokens,
          costUsd: usage.costUsd,
          occurredAt: usage.occurredAt
        }),
        include: {
          project: { select: { key: true } },
          assistant: { select: { key: true } }
        }
      });

      return mapPrismaTokenUsage(row);
    }

    return this.prisma.tokenUsageEvent.create({
      data: mapTokenUsageToPrismaCreate(usage)
    });
  }

  async findByProject(projectKey: string): Promise<NormalizedTokenUsageEvent[]> {
    if (!this.prisma.tokenUsageEvent?.findMany) {
      throw new Error("Prisma tokenUsageEvent delegate is unavailable");
    }

    const rows = await this.prisma.tokenUsageEvent.findMany({
      where: { project: { key: projectKey } },
      include: {
        project: { select: { key: true } },
        assistant: { select: { key: true } }
      },
      orderBy: { occurredAt: "asc" }
    });

    return rows.map(mapPrismaTokenUsage);
  }
}

class PrismaTokenPolicyRepository {
  constructor(private readonly prisma: PrismaLike) {}

  async save(policy: TokenPolicyRecord & { projectId?: string; assistantId?: string }) {
    if (!this.prisma.tokenPolicy?.create) {
      throw new Error("Prisma tokenPolicy delegate is unavailable");
    }

    if (!policy.projectId) {
      const project = await resolveProjectByKey(this.prisma, policy.projectKey);
      const assistant = policy.assistantKey
        ? await resolveAssistantByKey(this.prisma, project.id, policy.assistantKey)
        : undefined;
      const row = await this.prisma.tokenPolicy.create({
        data: mapTokenPolicyToPrismaCreate({
          projectId: project.id,
          assistantId: assistant?.id,
          preferredModel: policy.preferredModel,
          fallbackModel: policy.fallbackModel,
          dailyBudgetUsd: policy.dailyBudgetUsd,
          monthlyBudgetUsd: policy.monthlyBudgetUsd,
          maxTokensPerRequest: policy.maxTokensPerRequest,
          emergencyMode: policy.emergencyMode
        }),
        include: {
          project: { select: { key: true } },
          assistant: { select: { key: true } }
        }
      });

      return mapPrismaTokenPolicy(row);
    }

    return this.prisma.tokenPolicy.create({
      data: mapTokenPolicyToPrismaCreate({
        projectId: policy.projectId,
        assistantId: policy.assistantId,
        preferredModel: policy.preferredModel,
        fallbackModel: policy.fallbackModel,
        dailyBudgetUsd: policy.dailyBudgetUsd,
        monthlyBudgetUsd: policy.monthlyBudgetUsd,
        maxTokensPerRequest: policy.maxTokensPerRequest,
        emergencyMode: policy.emergencyMode
      })
    }) as Promise<TokenPolicyRecord>;
  }

  async find(input: { projectKey: string; assistantKey?: string }) {
    if (!this.prisma.tokenPolicy?.findFirst) {
      throw new Error("Prisma tokenPolicy delegate is unavailable");
    }

    const row = await this.prisma.tokenPolicy.findFirst({
      where: {
        project: { key: input.projectKey },
        OR: [{ assistant: { key: input.assistantKey } }, { assistantId: null }]
      },
      orderBy: [{ assistantId: "desc" }, { updatedAt: "desc" }],
      include: {
        project: { select: { key: true } },
        assistant: { select: { key: true } }
      }
    });

    return row ? mapPrismaTokenPolicy(row) : undefined;
  }
}

class PrismaProjectOnboardingRepository {
  constructor(private readonly prisma: PrismaLike) {}

  async saveProject(input: {
    project: OnboardedProject;
    repository?: OnboardedRepository;
    controls: ProjectControls;
  }) {
    if (!this.prisma.project?.upsert || !this.prisma.projectControl?.upsert) {
      throw new Error("Prisma project onboarding delegates are unavailable");
    }

    const project = await this.prisma.project.upsert({
      where: { key: input.project.key },
      update: {
        name: input.project.name,
        owner: input.project.owner,
        category: input.project.category,
        workspace: input.project.workspace,
        status: mapProjectStatusToPrisma(input.project.status)
      },
      create: {
        key: input.project.key,
        name: input.project.name,
        owner: input.project.owner,
        category: input.project.category,
        workspace: input.project.workspace,
        runtime: "founder_os_connected",
        status: mapProjectStatusToPrisma(input.project.status)
      }
    }) as { id: string };

    if (input.repository) {
      if (!this.prisma.repository?.upsert) {
        throw new Error("Prisma repository delegate is unavailable");
      }

      await this.prisma.repository.upsert({
        where: {
          projectId_name: {
            projectId: project.id,
            name: input.repository.name
          }
        },
        update: {
          provider: input.repository.provider,
          localPath: input.repository.localPath
        },
        create: {
          projectId: project.id,
          provider: input.repository.provider,
          name: input.repository.name,
          localPath: input.repository.localPath
        }
      });
    }

    await this.prisma.projectControl.upsert({
      where: { projectId: project.id },
      update: {
        assistantEnabled: input.controls.assistantEnabled,
        tokenTrackingRequired: input.controls.tokenTrackingRequired,
        feedbackCaptureRequired: input.controls.feedbackCaptureRequired,
        rawMessageStorage: input.controls.rawMessageStorage,
        consentRequiredForMarketing: input.controls.consentRequiredForMarketing
      },
      create: {
        projectId: project.id,
        assistantEnabled: input.controls.assistantEnabled,
        tokenTrackingRequired: input.controls.tokenTrackingRequired,
        feedbackCaptureRequired: input.controls.feedbackCaptureRequired,
        rawMessageStorage: input.controls.rawMessageStorage,
        consentRequiredForMarketing: input.controls.consentRequiredForMarketing
      }
    });

    return input;
  }

  async saveAiKey(key: AiKeyReference) {
    if (!this.prisma.project?.findUnique || !this.prisma.aiKeyReference?.upsert) {
      throw new Error("Prisma AI key reference delegates are unavailable");
    }

    const project = await this.prisma.project.findUnique({
      where: { key: key.projectKey },
      select: { id: true }
    }) as { id: string } | undefined;

    if (!project) {
      throw new Error(`Project ${key.projectKey} must be onboarded before registering AI keys`);
    }

    await this.prisma.aiKeyReference.upsert({
      where: {
        projectId_secretRef: {
          projectId: project.id,
          secretRef: key.secretRef
        }
      },
      update: {
        provider: key.provider,
        displayName: key.displayName,
        allowedModels: key.allowedModels,
        defaultModel: key.defaultModel,
        monthlyBudgetUsd: key.monthlyBudgetUsd,
        status: key.status
      },
      create: {
        projectId: project.id,
        provider: key.provider,
        secretRef: key.secretRef,
        displayName: key.displayName,
        allowedModels: key.allowedModels,
        defaultModel: key.defaultModel,
        monthlyBudgetUsd: key.monthlyBudgetUsd,
        status: key.status
      }
    });

    return key;
  }

  async aiKeysForProject(projectKey: string) {
    if (!this.prisma.aiKeyReference?.findMany) {
      throw new Error("Prisma AI key reference delegate is unavailable");
    }

    const rows = await this.prisma.aiKeyReference.findMany({
      where: { project: { key: projectKey } },
      orderBy: { displayName: "asc" }
    });

    return rows.map((row) => mapPrismaAiKey(projectKey, row));
  }

  async allProjects() {
    if (!this.prisma.project?.findMany) {
      throw new Error("Prisma project delegate is unavailable");
    }

    const rows = await this.prisma.project.findMany({
      orderBy: { key: "asc" }
    });

    return rows.map(mapPrismaProject);
  }

  async project(projectKey: string) {
    if (!this.prisma.project?.findUnique) {
      throw new Error("Prisma project delegate is unavailable");
    }

    const row = await this.prisma.project.findUnique({
      where: { key: projectKey }
    });

    return row ? mapPrismaProject(row) : undefined;
  }

  async repository(projectKey: string) {
    if (!this.prisma.repository?.findFirst) {
      throw new Error("Prisma repository delegate is unavailable");
    }

    const row = await this.prisma.repository.findFirst({
      where: { project: { key: projectKey } },
      orderBy: { createdAt: "asc" }
    });

    return row ? mapPrismaRepository(projectKey, row) : undefined;
  }

  async projectControls(projectKey: string) {
    if (!this.prisma.projectControl?.findFirst) {
      throw new Error("Prisma projectControl delegate is unavailable");
    }

    const row = await this.prisma.projectControl.findFirst({
      where: { project: { key: projectKey } }
    });

    return row ? mapPrismaProjectControls(projectKey, row) : undefined;
  }
}

function mapProjectStatusToPrisma(status: string) {
  const normalized = status.toUpperCase();
  return normalized === "PAUSED" || normalized === "ARCHIVED" ? normalized : "ACTIVE";
}

async function resolveProjectByKey(prisma: PrismaLike, projectKey: string) {
  if (!prisma.project?.findUnique) {
    throw new Error("Prisma project delegate is unavailable");
  }

  const project = await prisma.project.findUnique({
    where: { key: projectKey },
    select: { id: true, key: true }
  }) as { id: string; key: string } | undefined;

  if (!project) {
    throw new Error(`Project ${projectKey} must be onboarded before token operations`);
  }

  return project;
}

async function resolveAssistantByKey(
  prisma: PrismaLike,
  projectId: string,
  assistantKey: string
) {
  if (!prisma.assistant?.findFirst) {
    return undefined;
  }

  return prisma.assistant.findFirst({
    where: {
      projectId,
      key: assistantKey
    },
    select: { id: true, key: true }
  }) as Promise<{ id: string; key: string } | undefined>;
}

function mapPrismaEnvironment(environment: unknown): TokenUsageInput["environment"] {
  const normalized = String(environment ?? "LOCAL").toLowerCase();
  return normalized === "client_isolated"
    ? "client-isolated"
    : normalized as TokenUsageInput["environment"];
}

function mapPrismaDate(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function mapPrismaTokenUsage(row: unknown): NormalizedTokenUsageEvent {
  const usage = row as {
    project?: { key?: string };
    assistant?: { key?: string } | null;
    environment: unknown;
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costUsd: unknown;
    occurredAt: unknown;
  };

  const projectKey = usage.project?.key ?? "unknown";
  const assistantKey = usage.assistant?.key ?? "unknown";
  const costUsd = Number(usage.costUsd);

  return {
    projectKey,
    assistantKey,
    environment: mapPrismaEnvironment(usage.environment),
    model: usage.model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
    costUsd,
    occurredAt: mapPrismaDate(usage.occurredAt),
    costPerThousandTokensUsd: usage.totalTokens === 0 ? 0 : costUsd / (usage.totalTokens / 1000),
    policySubject: `project:${projectKey}`
  };
}

function mapPrismaTokenPolicy(row: unknown): TokenPolicyRecord {
  const policy = row as {
    project?: { key?: string };
    assistant?: { key?: string } | null;
    preferredModel: string;
    fallbackModel: string;
    dailyBudgetUsd: unknown;
    monthlyBudgetUsd: unknown;
    maxTokensPerRequest: number;
    emergencyMode: boolean;
  };

  return {
    projectKey: policy.project?.key ?? "unknown",
    assistantKey: policy.assistant?.key,
    preferredModel: policy.preferredModel,
    fallbackModel: policy.fallbackModel,
    dailyBudgetUsd: Number(policy.dailyBudgetUsd),
    monthlyBudgetUsd: Number(policy.monthlyBudgetUsd),
    maxTokensPerRequest: policy.maxTokensPerRequest,
    emergencyMode: policy.emergencyMode
  };
}

function mapPrismaStatus(status: unknown) {
  return String(status ?? "ACTIVE").toLowerCase();
}

function mapPrismaProject(row: unknown): OnboardedProject {
  const project = row as {
    key: string;
    name: string;
    status?: string;
    owner: string;
    category?: string | null;
    workspace?: string | null;
  };

  return {
    key: project.key,
    name: project.name,
    status: mapPrismaStatus(project.status),
    owner: project.owner,
    category: project.category ?? undefined,
    workspace: project.workspace ?? undefined
  };
}

function mapPrismaRepository(projectKey: string, row: unknown): OnboardedRepository {
  const repository = row as {
    provider: string;
    name: string;
    localPath?: string | null;
  };

  return {
    projectKey,
    provider: repository.provider,
    name: repository.name,
    localPath: repository.localPath ?? undefined
  };
}

function mapPrismaProjectControls(projectKey: string, row: unknown): ProjectControls {
  const controls = row as {
    assistantEnabled: boolean;
    tokenTrackingRequired: boolean;
    feedbackCaptureRequired: boolean;
    rawMessageStorage: string;
    consentRequiredForMarketing: boolean;
  };

  return {
    projectKey,
    assistantEnabled: controls.assistantEnabled,
    tokenTrackingRequired: controls.tokenTrackingRequired,
    feedbackCaptureRequired: controls.feedbackCaptureRequired,
    rawMessageStorage: controls.rawMessageStorage,
    consentRequiredForMarketing: controls.consentRequiredForMarketing
  };
}

function mapPrismaAiKey(projectKey: string, row: unknown): AiKeyReference {
  const key = row as {
    provider: AiKeyReference["provider"];
    secretRef: string;
    displayName: string;
    allowedModels: unknown;
    defaultModel: string;
    monthlyBudgetUsd: unknown;
    status: AiKeyReference["status"];
  };

  return {
    projectKey,
    provider: key.provider,
    secretRef: key.secretRef,
    displayName: key.displayName,
    allowedModels: Array.isArray(key.allowedModels) ? key.allowedModels.map(String) : [],
    defaultModel: key.defaultModel,
    monthlyBudgetUsd: Number(key.monthlyBudgetUsd),
    status: key.status
  };
}
