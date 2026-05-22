import type { StructuredEvent } from "@/domain/events/event-ingestion";
import {
  type AiKeyReference,
  type OnboardedProject,
  type OnboardedRepository,
  type ProjectControls
} from "@/domain/projects/project-onboarding";
import type { NormalizedTokenUsageEvent } from "@/domain/token-control/token-control";
import type { TokenPolicyRecord } from "@/domain/token-control/token-control-service";
import type { PersistedTokenUsageInput, RepositorySet } from "@/persistence/repositories";
import {
  mapStructuredEventToPrismaCreate,
  mapTokenPolicyToPrismaCreate,
  mapTokenUsageToPrismaCreate
} from "@/persistence/prisma/mappers";

type PrismaLike = {
  project?: {
    upsert(input: unknown): Promise<unknown>;
    findUnique(input: unknown): Promise<unknown>;
    findMany(input: unknown): Promise<unknown[]>;
  };
  repository?: {
    upsert(input: unknown): Promise<unknown>;
    findFirst(input: unknown): Promise<unknown>;
  };
  projectControl?: {
    upsert(input: unknown): Promise<unknown>;
    findFirst(input: unknown): Promise<unknown>;
  };
  aiKeyReference?: {
    upsert(input: unknown): Promise<unknown>;
    findMany(input: unknown): Promise<unknown[]>;
  };
  event?: {
    findUnique(input: unknown): Promise<unknown>;
    create(input: unknown): Promise<unknown>;
  };
  tokenUsageEvent?: {
    create(input: unknown): Promise<unknown>;
  };
  tokenPolicy?: {
    create(input: unknown): Promise<unknown>;
    findFirst(input: unknown): Promise<unknown>;
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
    if (!this.prisma.event) {
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
    if (!this.prisma.event) {
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

  async record(usage: PersistedTokenUsageInput) {
    if (!this.prisma.tokenUsageEvent) {
      throw new Error("Prisma tokenUsageEvent delegate is unavailable");
    }

    return this.prisma.tokenUsageEvent.create({
      data: mapTokenUsageToPrismaCreate(usage)
    });
  }

  async findByProject(_projectKey: string): Promise<NormalizedTokenUsageEvent[]> {
    throw new Error("Prisma token usage lookup by project key requires project resolution");
  }
}

class PrismaTokenPolicyRepository {
  constructor(private readonly prisma: PrismaLike) {}

  async save(policy: TokenPolicyRecord & { projectId?: string; assistantId?: string }) {
    if (!this.prisma.tokenPolicy) {
      throw new Error("Prisma tokenPolicy delegate is unavailable");
    }

    if (!policy.projectId) {
      throw new Error("Prisma token policy save requires projectId");
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
    if (!this.prisma.tokenPolicy) {
      throw new Error("Prisma tokenPolicy delegate is unavailable");
    }

    return this.prisma.tokenPolicy.findFirst({
      where: {
        project: { key: input.projectKey },
        OR: [{ assistant: { key: input.assistantKey } }, { assistantId: null }]
      },
      orderBy: [{ assistantId: "desc" }, { updatedAt: "desc" }]
    }) as Promise<TokenPolicyRecord | undefined>;
  }
}

class PrismaProjectOnboardingRepository {
  constructor(private readonly prisma: PrismaLike) {}

  async saveProject(input: {
    project: OnboardedProject;
    repository?: OnboardedRepository;
    controls: ProjectControls;
  }) {
    if (!this.prisma.project || !this.prisma.projectControl) {
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
      if (!this.prisma.repository) {
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
    if (!this.prisma.project || !this.prisma.aiKeyReference) {
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
    if (!this.prisma.aiKeyReference) {
      throw new Error("Prisma AI key reference delegate is unavailable");
    }

    const rows = await this.prisma.aiKeyReference.findMany({
      where: { project: { key: projectKey } },
      orderBy: { displayName: "asc" }
    });

    return rows.map((row) => mapPrismaAiKey(projectKey, row));
  }

  async allProjects() {
    if (!this.prisma.project) {
      throw new Error("Prisma project delegate is unavailable");
    }

    const rows = await this.prisma.project.findMany({
      orderBy: { key: "asc" }
    });

    return rows.map(mapPrismaProject);
  }

  async project(projectKey: string) {
    if (!this.prisma.project) {
      throw new Error("Prisma project delegate is unavailable");
    }

    const row = await this.prisma.project.findUnique({
      where: { key: projectKey }
    });

    return row ? mapPrismaProject(row) : undefined;
  }

  async repository(projectKey: string) {
    if (!this.prisma.repository) {
      throw new Error("Prisma repository delegate is unavailable");
    }

    const row = await this.prisma.repository.findFirst({
      where: { project: { key: projectKey } },
      orderBy: { createdAt: "asc" }
    });

    return row ? mapPrismaRepository(projectKey, row) : undefined;
  }

  async projectControls(projectKey: string) {
    if (!this.prisma.projectControl) {
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
