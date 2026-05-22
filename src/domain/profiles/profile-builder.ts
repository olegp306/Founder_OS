export type ProfileProjection = {
  personRef: string;
  summaries: string[];
  tags: string[];
  facts: Record<string, unknown>;
  lastActivityAt?: string;
};

export class InMemoryProfileStore {
  private readonly profiles = new Map<string, ProfileProjection>();

  get(personRef: string): ProfileProjection | undefined {
    return this.profiles.get(personRef);
  }

  applyProfileUpdate(input: {
    personRef: string;
    summary?: string;
    tags?: string[];
    facts?: Record<string, unknown>;
    occurredAt: string;
  }): ProfileProjection {
    const current = this.profiles.get(input.personRef) ?? {
      personRef: input.personRef,
      summaries: [],
      tags: [],
      facts: {}
    };

    const summaries = input.summary
      ? [...current.summaries, input.summary]
      : current.summaries;

    const tags = Array.from(new Set([...current.tags, ...(input.tags ?? [])]));

    const updated = {
      ...current,
      summaries,
      tags,
      facts: {
        ...current.facts,
        ...(input.facts ?? {})
      },
      lastActivityAt: input.occurredAt
    };

    this.profiles.set(input.personRef, updated);
    return updated;
  }
}
