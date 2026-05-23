import { InMemoryCampaignStore } from "@/domain/campaigns/campaign-center";
import { InMemoryEventStore } from "@/domain/events/event-ingestion";
import { InMemoryProfileStore } from "@/domain/profiles/profile-builder";
import { InMemoryProjectOnboardingStore } from "@/domain/projects/project-onboarding";
import { InMemoryProfileOperationsStore } from "@/domain/profiles/profile-operations";
import { InMemoryTokenControlStore } from "@/domain/token-control/token-control-service";
import { MemoryRepositorySet } from "@/persistence/memory/repositories";
import { getPrismaClient } from "@/persistence/prisma/client";
import { PrismaRepositorySet, type PrismaLike } from "@/persistence/prisma/repositories";
import type { RepositorySet } from "@/persistence/repositories";

const globalForFounderOs = globalThis as typeof globalThis & {
  founderOsRuntime?: FounderOsRuntime;
};

export type PersistenceMode = "memory" | "prisma";

export type FounderOsRuntime = {
  persistenceMode: PersistenceMode;
  events: InMemoryEventStore;
  profiles: InMemoryProfileStore;
  profileOps: InMemoryProfileOperationsStore;
  tokens: InMemoryTokenControlStore;
  campaigns: InMemoryCampaignStore;
  projectOnboarding: InMemoryProjectOnboardingStore;
  repositories: RepositorySet;
};

export function selectPersistenceMode(env: {
  DATABASE_URL?: string;
  FOUNDER_OS_FORCE_MEMORY?: string;
}): PersistenceMode {
  if (env.FOUNDER_OS_FORCE_MEMORY === "true") {
    return "memory";
  }

  return env.DATABASE_URL ? "prisma" : "memory";
}

export function createFounderOsRuntime(env: {
  DATABASE_URL?: string;
  FOUNDER_OS_FORCE_MEMORY?: string;
  prismaClient?: PrismaLike;
}): FounderOsRuntime {
  const events = new InMemoryEventStore();
  const tokens = new InMemoryTokenControlStore();
  const projectOnboarding = new InMemoryProjectOnboardingStore();
  const persistenceMode = selectPersistenceMode(env);
  const repositories = persistenceMode === "prisma"
    ? new PrismaRepositorySet(env.prismaClient ?? getPrismaClient())
    : new MemoryRepositorySet(events, tokens, projectOnboarding);

  return {
    persistenceMode,
    events,
    profiles: new InMemoryProfileStore(),
    profileOps: new InMemoryProfileOperationsStore(),
    tokens,
    campaigns: new InMemoryCampaignStore(),
    projectOnboarding,
    repositories
  };
}

export function getFounderOsRuntime() {
  globalForFounderOs.founderOsRuntime ??= createFounderOsRuntime({
    DATABASE_URL: process.env.DATABASE_URL,
    FOUNDER_OS_FORCE_MEMORY: process.env.FOUNDER_OS_FORCE_MEMORY
  });

  return globalForFounderOs.founderOsRuntime;
}
