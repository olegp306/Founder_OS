import { describe, expect, it, vi } from "vitest";
import { PrismaRepositorySet } from "@/persistence/prisma/repositories";

describe("Prisma repository set", () => {
  it("uses event upsert semantics for idempotent appends", async () => {
    const prisma = {
      event: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "event_1" })
      }
    };
    const repositories = new PrismaRepositorySet(prisma);

    await expect(
      repositories.events.append({
        source: "telegram_booking_bot",
        idempotencyKey: "telegram_booking_bot:profile:123456:1",
        event: "user.profile.updated",
        personRef: "telegram:123456",
        summary: "User is interested in booking automation.",
        tags: ["booking_interest"],
        facts: { business_type: "photo_studio" },
        occurredAt: "2026-05-22T18:30:00.000Z",
        storedAt: "2026-05-22T18:30:01.000Z"
      })
    ).resolves.toBe("stored");

    expect(prisma.event.findUnique).toHaveBeenCalledWith({
      where: {
        source_idempotencyKey: {
          source: "telegram_booking_bot",
          idempotencyKey: "telegram_booking_bot:profile:123456:1"
        }
      }
    });
    expect(prisma.event.create).toHaveBeenCalledOnce();
  });

  it("records token usage through Prisma create", async () => {
    const prisma = {
      tokenUsageEvent: {
        create: vi.fn().mockResolvedValue({ id: "usage_1" })
      }
    };
    const repositories = new PrismaRepositorySet(prisma);

    await repositories.tokenUsage.record({
      projectId: "project_1",
      assistantId: "assistant_1",
      environment: "production",
      model: "gpt-5.4",
      inputTokens: 1400,
      outputTokens: 620,
      totalTokens: 2020,
      costUsd: 0.0124,
      occurredAt: "2026-05-22T19:45:00.000Z"
    });

    expect(prisma.tokenUsageEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: "project_1",
        environment: "PRODUCTION",
        totalTokens: 2020
      })
    });
  });
});
