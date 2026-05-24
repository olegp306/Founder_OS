import { z } from "zod";
import type { StructuredEvent } from "@/domain/events/event-ingestion";
import type { FounderOsRuntime } from "@/server/founder-os-runtime";

const providerSpendEntrySchema = z.object({
  projectKey: z.string().min(2),
  provider: z.enum(["openai", "anthropic", "google", "other"]),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  costUsd: z.number().min(0),
  source: z.string().min(2),
  importedAt: z.string().datetime().optional()
}).strict();

const providerSpendImportSchema = z.object({
  imports: z.array(providerSpendEntrySchema).min(1)
}).strict();

type ProviderSpendEntry = z.infer<typeof providerSpendEntrySchema>;

export async function handleProviderSpendImport(runtime: FounderOsRuntime, payload: unknown) {
  rejectUnsafeProviderSpendPayload(payload);
  const input = providerSpendImportSchema.parse(payload);
  const events = [];
  let importedCount = 0;
  let duplicateCount = 0;

  for (const entry of input.imports) {
    const event = buildProviderSpendEvent(entry);
    const status = await runtime.repositories.events.append(event);

    if (status === "stored") {
      importedCount += 1;
    } else {
      duplicateCount += 1;
    }

    events.push({
      projectKey: entry.projectKey,
      provider: entry.provider,
      costUsd: entry.costUsd,
      status
    });
  }

  return {
    status: "imported" as const,
    importedCount,
    duplicateCount,
    events
  };
}

function buildProviderSpendEvent(entry: ProviderSpendEntry): StructuredEvent {
  const occurredAt = entry.importedAt ?? new Date().toISOString();

  return {
    idempotencyKey: [
      "provider-spend",
      entry.projectKey,
      entry.provider,
      entry.periodStart,
      entry.periodEnd,
      entry.source
    ].join(":"),
    event: "provider.spend.imported",
    source: entry.source,
    project: entry.projectKey,
    summary: `Provider spend imported for ${entry.projectKey}/${entry.provider}: $${entry.costUsd.toFixed(2)}.`,
    tags: ["provider_spend", entry.provider, "cost_monitoring"],
    facts: {
      project_key: entry.projectKey,
      provider: entry.provider,
      period_start: entry.periodStart,
      period_end: entry.periodEnd,
      cost_usd: entry.costUsd,
      source: entry.source
    },
    occurredAt,
    storedAt: occurredAt
  };
}

function rejectUnsafeProviderSpendPayload(payload: unknown): void {
  scanProviderSpendPayload(payload);
}

function scanProviderSpendPayload(value: unknown, path: string[] = []): void {
  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();

    if (
      normalizedKey !== "projectkey" &&
      (
        normalizedKey.includes("raw") ||
        normalizedKey.includes("invoice") ||
        normalizedKey.includes("secret") ||
        normalizedKey.includes("token") ||
        normalizedKey.includes("apikey") ||
        normalizedKey.includes("api_key") ||
        normalizedKey.includes("plaintext")
      )
    ) {
      throw new Error("Provider spend payload must not include raw invoices or secrets");
    }

    scanProviderSpendPayload(nestedValue, [...path, key]);
  }
}
