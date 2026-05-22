import { InMemoryCampaignStore } from "@/domain/campaigns/campaign-center";
import { InMemoryEventStore } from "@/domain/events/event-ingestion";
import { InMemoryProfileStore } from "@/domain/profiles/profile-builder";
import { InMemoryProfileOperationsStore } from "@/domain/profiles/profile-operations";
import { InMemoryTokenControlStore } from "@/domain/token-control/token-control-service";

const globalForFounderOs = globalThis as typeof globalThis & {
  founderOsRuntime?: {
    events: InMemoryEventStore;
    profiles: InMemoryProfileStore;
    profileOps: InMemoryProfileOperationsStore;
    tokens: InMemoryTokenControlStore;
    campaigns: InMemoryCampaignStore;
  };
};

export function getFounderOsRuntime() {
  globalForFounderOs.founderOsRuntime ??= {
    events: new InMemoryEventStore(),
    profiles: new InMemoryProfileStore(),
    profileOps: new InMemoryProfileOperationsStore(),
    tokens: new InMemoryTokenControlStore(),
    campaigns: new InMemoryCampaignStore()
  };

  return globalForFounderOs.founderOsRuntime;
}
