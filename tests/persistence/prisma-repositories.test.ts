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

  it("persists project onboarding through Prisma delegates", async () => {
    const project = {
      id: "project_1",
      key: "booking_assistant",
      name: "Booking Assistant",
      owner: "olegp306",
      category: "operations",
      workspace: "founder",
      runtime: "nextjs",
      status: "ACTIVE"
    };
    const prisma = {
      project: {
        upsert: vi.fn().mockResolvedValue(project),
        findUnique: vi.fn().mockResolvedValue(project),
        findMany: vi.fn().mockResolvedValue([project])
      },
      repository: {
        upsert: vi.fn().mockResolvedValue({
          projectId: "project_1",
          provider: "github",
          name: "booking-assistant",
          localPath: "C:\\Repos\\booking-assistant"
        }),
        findFirst: vi.fn().mockResolvedValue({
          provider: "github",
          name: "booking-assistant",
          localPath: "C:\\Repos\\booking-assistant"
        })
      },
      projectControl: {
        upsert: vi.fn().mockResolvedValue({
          projectId: "project_1",
          assistantEnabled: true,
          tokenTrackingRequired: true,
          feedbackCaptureRequired: true,
          rawMessageStorage: "disabled_by_default",
          consentRequiredForMarketing: true
        }),
        findFirst: vi.fn().mockResolvedValue({
          assistantEnabled: true,
          tokenTrackingRequired: true,
          feedbackCaptureRequired: true,
          rawMessageStorage: "disabled_by_default",
          consentRequiredForMarketing: true
        })
      },
      aiKeyReference: {
        upsert: vi.fn().mockResolvedValue({
          projectId: "project_1",
          provider: "openai",
          secretRef: "vercel:BOOKING_ASSISTANT_OPENAI_API_KEY",
          displayName: "Booking Assistant OpenAI key",
          allowedModels: ["gpt-5.4-mini"],
          defaultModel: "gpt-5.4-mini",
          monthlyBudgetUsd: "250",
          status: "active"
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            provider: "openai",
            secretRef: "vercel:BOOKING_ASSISTANT_OPENAI_API_KEY",
            displayName: "Booking Assistant OpenAI key",
            allowedModels: ["gpt-5.4-mini"],
            defaultModel: "gpt-5.4-mini",
            monthlyBudgetUsd: "250",
            status: "active"
          }
        ])
      }
    };
    const repositories = new PrismaRepositorySet(prisma);

    await repositories.projects.saveProject({
      project: {
        key: "booking_assistant",
        name: "Booking Assistant",
        status: "active",
        owner: "olegp306",
        category: "operations",
        workspace: "founder"
      },
      repository: {
        projectKey: "booking_assistant",
        provider: "github",
        name: "booking-assistant",
        localPath: "C:\\Repos\\booking-assistant"
      },
      controls: {
        projectKey: "booking_assistant",
        assistantEnabled: true,
        tokenTrackingRequired: true,
        feedbackCaptureRequired: true,
        rawMessageStorage: "disabled_by_default",
        consentRequiredForMarketing: true
      }
    });
    await repositories.projects.saveAiKey({
      projectKey: "booking_assistant",
      provider: "openai",
      secretRef: "vercel:BOOKING_ASSISTANT_OPENAI_API_KEY",
      displayName: "Booking Assistant OpenAI key",
      allowedModels: ["gpt-5.4-mini"],
      defaultModel: "gpt-5.4-mini",
      monthlyBudgetUsd: 250,
      status: "active"
    });

    await expect(repositories.projects.allProjects()).resolves.toEqual([
      expect.objectContaining({ key: "booking_assistant" })
    ]);
    await expect(repositories.projects.project("booking_assistant")).resolves.toMatchObject({
      key: "booking_assistant"
    });
    await expect(repositories.projects.repository("booking_assistant")).resolves.toMatchObject({
      name: "booking-assistant"
    });
    await expect(repositories.projects.projectControls("booking_assistant")).resolves.toMatchObject({
      tokenTrackingRequired: true
    });
    await expect(repositories.projects.aiKeysForProject("booking_assistant")).resolves.toEqual([
      expect.objectContaining({ secretRef: "vercel:BOOKING_ASSISTANT_OPENAI_API_KEY" })
    ]);

    expect(prisma.project.upsert).toHaveBeenCalledOnce();
    expect(prisma.repository.upsert).toHaveBeenCalledOnce();
    expect(prisma.projectControl.upsert).toHaveBeenCalledOnce();
    expect(prisma.aiKeyReference.upsert).toHaveBeenCalledOnce();
  });
});
