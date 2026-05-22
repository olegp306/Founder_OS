import type { StructuredEvent } from "@/domain/events/event-ingestion";
import {
  InMemoryProjectOnboardingStore,
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

  constructor(
    private readonly prisma: PrismaLike,
    private readonly projectStore = new InMemoryProjectOnboardingStore()
  ) {
    this.events = new PrismaEventRepository(prisma);
    this.tokenUsage = new PrismaTokenUsageRepository(prisma);
    this.tokenPolicies = new PrismaTokenPolicyRepository(prisma);
    this.projects = new PrismaProjectOnboardingRepository(this.projectStore);
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
  constructor(private readonly store: InMemoryProjectOnboardingStore) {}

  async saveProject(input: {
    project: OnboardedProject;
    repository?: OnboardedRepository;
    controls: ProjectControls;
  }) {
    return this.store.saveProject(input);
  }

  async saveAiKey(key: AiKeyReference) {
    return this.store.saveAiKey(key);
  }

  async aiKeysForProject(projectKey: string) {
    return this.store.aiKeysForProject(projectKey);
  }

  async allProjects() {
    return this.store.allProjects();
  }

  async project(projectKey: string) {
    return this.store.project(projectKey);
  }

  async repository(projectKey: string) {
    return this.store.repository(projectKey);
  }

  async projectControls(projectKey: string) {
    return this.store.projectControls(projectKey);
  }
}
