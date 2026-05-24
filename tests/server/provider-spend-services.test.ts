import { describe, expect, it } from "vitest";
import { createFounderOsRuntime } from "@/server/founder-os-runtime";
import { handleProviderSpendImport } from "@/server/provider-spend-services";

describe("provider spend services", () => {
  it("imports provider spend totals as safe structured events", async () => {
    const runtime = createFounderOsRuntime({ FOUNDER_OS_FORCE_MEMORY: "true" });

    await expect(
      handleProviderSpendImport(runtime, {
        imports: [
          {
            projectKey: "booking_assistant",
            provider: "openai",
            periodStart: "2026-05-23T00:00:00.000Z",
            periodEnd: "2026-05-24T00:00:00.000Z",
            costUsd: 12.34,
            source: "openai_usage_export",
            importedAt: "2026-05-24T08:00:00.000Z"
          },
          {
            projectKey: "sales_copilot",
            provider: "anthropic",
            periodStart: "2026-05-23T00:00:00.000Z",
            periodEnd: "2026-05-24T00:00:00.000Z",
            costUsd: 4.56,
            source: "anthropic_usage_export",
            importedAt: "2026-05-24T08:00:00.000Z"
          }
        ]
      })
    ).resolves.toEqual({
      status: "imported",
      importedCount: 2,
      duplicateCount: 0,
      events: [
        {
          projectKey: "booking_assistant",
          provider: "openai",
          costUsd: 12.34,
          status: "stored"
        },
        {
          projectKey: "sales_copilot",
          provider: "anthropic",
          costUsd: 4.56,
          status: "stored"
        }
      ]
    });

    expect(runtime.events.all()).toEqual([
      expect.objectContaining({
        event: "provider.spend.imported",
        source: "openai_usage_export",
        project: "booking_assistant",
        summary: "Provider spend imported for booking_assistant/openai: $12.34.",
        tags: ["provider_spend", "openai", "cost_monitoring"],
        facts: {
          project_key: "booking_assistant",
          provider: "openai",
          period_start: "2026-05-23T00:00:00.000Z",
          period_end: "2026-05-24T00:00:00.000Z",
          cost_usd: 12.34,
          source: "openai_usage_export"
        },
        occurredAt: "2026-05-24T08:00:00.000Z"
      }),
      expect.objectContaining({
        event: "provider.spend.imported",
        source: "anthropic_usage_export",
        project: "sales_copilot",
        tags: ["provider_spend", "anthropic", "cost_monitoring"],
        facts: expect.objectContaining({
          provider: "anthropic",
          cost_usd: 4.56
        })
      })
    ]);
    expect(JSON.stringify(runtime.events.all())).not.toContain("invoice");
    expect(JSON.stringify(runtime.events.all())).not.toContain("sk-");
  });

  it("deduplicates provider spend imports by project provider period and source", async () => {
    const runtime = createFounderOsRuntime({ FOUNDER_OS_FORCE_MEMORY: "true" });
    const payload = {
      imports: [
        {
          projectKey: "booking_assistant",
          provider: "openai",
          periodStart: "2026-05-23T00:00:00.000Z",
          periodEnd: "2026-05-24T00:00:00.000Z",
          costUsd: 12.34,
          source: "openai_usage_export"
        }
      ]
    };

    await handleProviderSpendImport(runtime, payload);

    await expect(handleProviderSpendImport(runtime, payload)).resolves.toEqual({
      status: "imported",
      importedCount: 0,
      duplicateCount: 1,
      events: [
        {
          projectKey: "booking_assistant",
          provider: "openai",
          costUsd: 12.34,
          status: "duplicate"
        }
      ]
    });
  });

  it("rejects unsafe provider spend payload keys", async () => {
    const runtime = createFounderOsRuntime({ FOUNDER_OS_FORCE_MEMORY: "true" });

    await expect(
      handleProviderSpendImport(runtime, {
        imports: [
          {
            projectKey: "booking_assistant",
            provider: "openai",
            periodStart: "2026-05-23T00:00:00.000Z",
            periodEnd: "2026-05-24T00:00:00.000Z",
            costUsd: 12.34,
            source: "openai_usage_export",
            rawInvoice: "invoice with sk-never-store"
          }
        ]
      })
    ).rejects.toThrow("Provider spend payload must not include raw invoices or secrets");
  });
});
