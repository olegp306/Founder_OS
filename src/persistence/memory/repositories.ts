import { InMemoryEventStore, type StructuredEvent } from "@/domain/events/event-ingestion";
import {
  InMemoryTokenControlStore,
  type TokenPolicyRecord,
  recordTokenUsage
} from "@/domain/token-control/token-control-service";
import type { TokenUsageInput } from "@/domain/token-control/token-control";
import type { RepositorySet } from "@/persistence/repositories";

export class MemoryRepositorySet implements RepositorySet {
  readonly kind = "memory" as const;
  readonly events: MemoryEventRepository;
  readonly tokenUsage: MemoryTokenUsageRepository;
  readonly tokenPolicies: MemoryTokenPolicyRepository;

  constructor(
    private readonly eventStore = new InMemoryEventStore(),
    private readonly tokenStore = new InMemoryTokenControlStore()
  ) {
    this.events = new MemoryEventRepository(this.eventStore);
    this.tokenUsage = new MemoryTokenUsageRepository(this.tokenStore);
    this.tokenPolicies = new MemoryTokenPolicyRepository(this.tokenStore);
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
