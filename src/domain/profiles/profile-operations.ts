export type IdentityKind = "telegram" | "email" | "phone" | "app_account" | "external";
export type ConsentChannel = "telegram" | "email" | "sms" | "web";
export type ConsentPurpose = "product_updates" | "marketing" | "support" | "token_metering";

export type PersonRecord = {
  id: string;
  displayName?: string;
  tags: string[];
  facts: Record<string, unknown>;
  identities: Array<{
    kind: IdentityKind;
    externalId: string;
  }>;
};

export type ConsentRecord = {
  personId: string;
  channel: ConsentChannel;
  purpose: ConsentPurpose;
  granted: boolean;
  source: string;
  recordedAt: string;
};

export type FeedbackRecord = {
  id: string;
  personId?: string;
  projectKey?: string;
  source: string;
  kind: string;
  summary: string;
  tags: string[];
  status: "new";
  createdAt: string;
};

export type AuditRecord = {
  action: string;
  actor: string;
  subjectId: string;
  reason?: string;
  createdAt: string;
};

export class InMemoryProfileOperationsStore {
  private nextPersonNumber = 1;
  private nextFeedbackNumber = 1;
  private readonly people = new Map<string, PersonRecord>();
  private readonly identityIndex = new Map<string, string>();
  private readonly consents: ConsentRecord[] = [];
  private readonly feedback: FeedbackRecord[] = [];
  private readonly audit: AuditRecord[] = [];

  createPerson(input: { displayName?: string; tags?: string[]; facts?: Record<string, unknown> }) {
    const person: PersonRecord = {
      id: `person_${this.nextPersonNumber++}`,
      displayName: input.displayName,
      tags: input.tags ?? [],
      facts: input.facts ?? {},
      identities: []
    };

    this.people.set(person.id, person);
    return person;
  }

  getPerson(personId: string): PersonRecord | undefined {
    return this.people.get(personId);
  }

  upsertIdentity(input: {
    kind: IdentityKind;
    externalId: string;
    displayName?: string;
    tags?: string[];
    facts?: Record<string, unknown>;
  }): { personId: string } {
    const indexKey = identityKey(input.kind, input.externalId);
    const existingPersonId = this.identityIndex.get(indexKey);

    if (existingPersonId) {
      return { personId: existingPersonId };
    }

    const person = this.createPerson({
      displayName: input.displayName,
      tags: input.tags,
      facts: input.facts
    });

    person.identities.push({
      kind: input.kind,
      externalId: input.externalId
    });
    this.identityIndex.set(indexKey, person.id);
    return { personId: person.id };
  }

  replacePerson(person: PersonRecord): PersonRecord {
    this.people.set(person.id, person);
    for (const identity of person.identities) {
      this.identityIndex.set(identityKey(identity.kind, identity.externalId), person.id);
    }
    return person;
  }

  removePerson(personId: string): void {
    this.people.delete(personId);
  }

  addConsent(consent: ConsentRecord): ConsentRecord {
    this.consents.push(consent);
    return consent;
  }

  latestConsent(input: {
    personId: string;
    channel: ConsentChannel;
    purpose: ConsentPurpose;
  }): ConsentRecord | undefined {
    return this.consents
      .filter(
        (consent) =>
          consent.personId === input.personId &&
          consent.channel === input.channel &&
          consent.purpose === input.purpose
      )
      .at(-1);
  }

  addFeedback(feedback: FeedbackRecord): FeedbackRecord {
    this.feedback.push(feedback);
    return feedback;
  }

  allPeople(): PersonRecord[] {
    return Array.from(this.people.values());
  }

  addAudit(record: AuditRecord): AuditRecord {
    this.audit.push(record);
    return record;
  }

  auditTrail(): AuditRecord[] {
    return this.audit;
  }

  nextFeedbackId(): string {
    return `feedback_${this.nextFeedbackNumber++}`;
  }
}

export function linkIdentity(
  store: InMemoryProfileOperationsStore,
  input: {
    kind: IdentityKind;
    externalId: string;
    displayName?: string;
    tags?: string[];
    facts?: Record<string, unknown>;
  }
): { personId: string } {
  return store.upsertIdentity(input);
}

export function mergePersonIdentities(
  store: InMemoryProfileOperationsStore,
  input: {
    primaryPersonId: string;
    secondaryPersonId: string;
    reason: string;
    actor: string;
  }
): PersonRecord {
  const primary = store.getPerson(input.primaryPersonId);
  const secondary = store.getPerson(input.secondaryPersonId);

  if (!primary || !secondary) {
    throw new Error("Cannot merge missing people");
  }

  const merged: PersonRecord = {
    ...primary,
    displayName: primary.displayName ?? secondary.displayName,
    tags: Array.from(new Set([...primary.tags, ...secondary.tags])),
    facts: {
      ...secondary.facts,
      ...primary.facts
    },
    identities: dedupeIdentities([...primary.identities, ...secondary.identities])
  };

  store.replacePerson(merged);
  store.removePerson(secondary.id);
  store.addAudit({
    action: "person.identities.merged",
    actor: input.actor,
    subjectId: primary.id,
    reason: input.reason,
    createdAt: new Date().toISOString()
  });

  return merged;
}

export function grantConsent(
  store: InMemoryProfileOperationsStore,
  input: {
    personId: string;
    channel: ConsentChannel;
    purpose: ConsentPurpose;
    granted: boolean;
    source: string;
    actor: string;
  }
): ConsentRecord {
  const consent = store.addConsent({
    personId: input.personId,
    channel: input.channel,
    purpose: input.purpose,
    granted: input.granted,
    source: input.source,
    recordedAt: new Date().toISOString()
  });

  store.addAudit({
    action: "consent.recorded",
    actor: input.actor,
    subjectId: input.personId,
    reason: input.source,
    createdAt: consent.recordedAt
  });

  return consent;
}

export function mayContactPerson(
  store: InMemoryProfileOperationsStore,
  input: {
    personId: string;
    channel: ConsentChannel;
    purpose: ConsentPurpose;
  }
): { allowed: boolean; reasons: string[] } {
  const latest = store.latestConsent(input);

  if (!latest?.granted) {
    return {
      allowed: false,
      reasons: ["consent_not_granted"]
    };
  }

  return { allowed: true, reasons: [] };
}

export function captureFeedback(
  store: InMemoryProfileOperationsStore,
  input: {
    personId?: string;
    projectKey?: string;
    source: string;
    kind: string;
    summary: string;
    tags?: string[];
  }
): FeedbackRecord {
  return store.addFeedback({
    id: store.nextFeedbackId(),
    personId: input.personId,
    projectKey: input.projectKey,
    source: input.source,
    kind: input.kind,
    summary: input.summary,
    tags: input.tags ?? [],
    status: "new",
    createdAt: new Date().toISOString()
  });
}

export function evaluateSegment(
  store: InMemoryProfileOperationsStore,
  input: {
    key: string;
    name: string;
    requiredTags: string[];
  }
): {
  key: string;
  name: string;
  members: string[];
} {
  return {
    key: input.key,
    name: input.name,
    members: store
      .allPeople()
      .filter((person) => input.requiredTags.every((tag) => person.tags.includes(tag)))
      .map((person) => person.id)
  };
}

function identityKey(kind: IdentityKind, externalId: string): string {
  return `${kind}:${externalId}`;
}

function dedupeIdentities(identities: PersonRecord["identities"]): PersonRecord["identities"] {
  const seen = new Set<string>();
  return identities.filter((identity) => {
    const key = identityKey(identity.kind, identity.externalId);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
