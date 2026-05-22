import { z } from "zod";
import type { InMemoryProfileStore } from "@/domain/profiles/profile-builder";

const rawFieldPattern = /(^raw|rawmessage|raw_message|conversationtranscript|transcript|messagetext|message_text|fullmessage|full_message)/i;

const structuredEventSchema = z.object({
  idempotencyKey: z.string().min(8),
  event: z.string().min(3),
  source: z.string().min(2),
  personRef: z.string().min(3).optional(),
  project: z.string().min(2).optional(),
  summary: z.string().min(1).max(2000).optional(),
  tags: z.array(z.string().min(1)).default([]),
  facts: z.record(z.unknown()).default({}),
  occurredAt: z.string().datetime()
});

export type StructuredEvent = z.infer<typeof structuredEventSchema> & {
  storedAt: string;
};

export type IngestStructuredEventInput = {
  events: InMemoryEventStore;
  profiles: InMemoryProfileStore;
  payload: unknown;
};

export type IngestStructuredEventResult = {
  status: "stored" | "duplicate";
  event: StructuredEvent;
};

export class InMemoryEventStore {
  private readonly events = new Map<string, StructuredEvent>();

  append(event: StructuredEvent): "stored" | "duplicate" {
    const key = this.keyFor(event.source, event.idempotencyKey);

    if (this.events.has(key)) {
      return "duplicate";
    }

    this.events.set(key, event);
    return "stored";
  }

  find(source: string, idempotencyKey: string): StructuredEvent | undefined {
    return this.events.get(this.keyFor(source, idempotencyKey));
  }

  all(): StructuredEvent[] {
    return Array.from(this.events.values());
  }

  private keyFor(source: string, idempotencyKey: string): string {
    return `${source}:${idempotencyKey}`;
  }
}

export async function ingestStructuredEvent(
  input: IngestStructuredEventInput
): Promise<IngestStructuredEventResult> {
  rejectUnsafeRawPayload(input.payload);

  const parsed = structuredEventSchema.parse(input.payload);
  const duplicate = input.events.find(parsed.source, parsed.idempotencyKey);

  if (duplicate) {
    return {
      status: "duplicate",
      event: duplicate
    };
  }

  const event = {
    ...parsed,
    storedAt: new Date().toISOString()
  };

  const status = input.events.append(event);

  if (status === "stored" && event.event === "user.profile.updated" && event.personRef) {
    input.profiles.applyProfileUpdate({
      personRef: event.personRef,
      summary: event.summary,
      tags: event.tags,
      facts: event.facts,
      occurredAt: event.occurredAt
    });
  }

  return {
    status,
    event
  };
}

export function rejectUnsafeRawPayload(payload: unknown): void {
  scanForUnsafeRawPayload(payload);
}

function scanForUnsafeRawPayload(payload: unknown, path: string[] = []): void {
  if (!payload || typeof payload !== "object") {
    return;
  }

  for (const [key, value] of Object.entries(payload)) {
    const nextPath = [...path, key];

    if (rawFieldPattern.test(key)) {
      throw new Error(`Raw conversation content is not allowed at ${nextPath.join(".")}`);
    }

    if (value && typeof value === "object") {
      scanForUnsafeRawPayload(value, nextPath);
    }
  }
}
