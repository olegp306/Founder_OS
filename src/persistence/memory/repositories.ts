import { InMemoryEventStore, type StructuredEvent } from "@/domain/events/event-ingestion";
import {
  InMemoryTokenControlStore,
  type TokenPolicyRecord,
  recordTokenUsage
} from "@/domain/token-control/token-control-service";
import {
  InMemoryProjectOnboardingStore,
  type AiKeyReference,
  type OnboardedProject,
  type OnboardedRepository,
  type ProjectControls
} from "@/domain/projects/project-onboarding";
import type { TokenUsageInput } from "@/domain/token-control/token-control";
import type { RepositorySet } from "@/persistence/repositories";

export class MemoryRepositorySet implements RepositorySet {
  readonly kind = "memory" as const;
  readonly events: MemoryEventRepository;
  readonly tokenUsage: MemoryTokenUsageRepository;
  readonly tokenPolicies: MemoryTokenPolicyRepository;
  readonly projects: MemoryProjectOnboardingRepository;

  constructor(
    private readonly eventStore = new InMemoryEventStore(),
    private readonly tokenStore = new InMemoryTokenControlStore(),
    private readonly projectStore = new InMemoryProjectOnboardingStore()
  ) {
    this.events = new MemoryEventRepository(this.eventStore);
    this.tokenUsage = new MemoryTokenUsageRepository(this.tokenStore);
    this.tokenPolicies = new MemoryTokenPolicyRepository(this.tokenStore);
    this.projects = new MemoryProjectOnboardingRepository(this.projectStore);
  }
}

class MemoryEventRepository {
  constructor(private readonly store: InMemoryEventStore) {}

  async append(event: StructuredEvent) {
    return this.store.append(event);
  }

  async findByIdempotencyKey(source: string, idempotencyKey: string) {
    return this.store.find(source, idempotencyKey);
  }
}

class MemoryTokenUsageRepository {
  constructor(private readonly store: InMemoryTokenControlStore) {}

  async record(usage: TokenUsageInput) {
    return recordTokenUsage(this.store, usage);
  }

  async findByProject(projectKey: string) {
    return this.store.usageForProject(projectKey);
  }
}

class MemoryTokenPolicyRepository {
  constructor(private readonly store: InMemoryTokenControlStore) {}

  async save(policy: TokenPolicyRecord) {
    return this.store.setPolicy(policy);
  }

  async find(input: { projectKey: string; assistantKey?: string }) {
    return this.store.findPolicy(input);
  }
}

class MemoryProjectOnboardingRepository {
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
