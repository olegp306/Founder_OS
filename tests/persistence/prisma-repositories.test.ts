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

  it("resolves project and assistant keys when recording token usage with Prisma", async () => {
    const prisma = {
      project: {
        findUnique: vi.fn().mockResolvedValue({ id: "project_1", key: "booking_photoshop_studio" })
      },
      assistant: {
        findFirst: vi.fn().mockResolvedValue({ id: "assistant_1", key: "booking_assistant" })
      },
      tokenUsageEvent: {
        create: vi.fn().mockResolvedValue({
          id: "usage_1",
          project: { key: "booking_photoshop_studio" },
          assistant: { key: "booking_assistant" },
          environment: "PRODUCTION",
          model: "gpt-5.4",
          inputTokens: 1400,
          outputTokens: 620,
          totalTokens: 2020,
          costUsd: "0.0124",
          occurredAt: new Date("2026-05-22T19:45:00.000Z")
        })
      }
    };
    const repositories = new PrismaRepositorySet(prisma);

    await expect(
      repositories.tokenUsage.record({
        projectKey: "booking_photoshop_studio",
        assistantKey: "booking_assistant",
        environment: "production",
        model: "gpt-5.4",
        inputTokens: 1400,
        outputTokens: 620,
        costUsd: 0.0124,
        occurredAt: "2026-05-22T19:45:00.000Z"
      })
    ).resolves.toMatchObject({
      projectKey: "booking_photoshop_studio",
      assistantKey: "booking_assistant",
      totalTokens: 2020
    });

    expect(prisma.project.findUnique).toHaveBeenCalledWith({
      where: { key: "booking_photoshop_studio" },
      select: { id: true, key: true }
    });
    expect(prisma.assistant.findFirst).toHaveBeenCalledWith({
      where: {
        projectId: "project_1",
        key: "booking_assistant"
      },
      select: { id: true, key: true }
    });
    expect(prisma.tokenUsageEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: "project_1",
        assistantId: "assistant_1",
        totalTokens: 2020
      }),
      include: {
        project: { select: { key: true } },
        assistant: { select: { key: true } }
      }
    });
  });

  it("resolves project and assistant keys when saving token policies with Prisma", async () => {
    const prisma = {
      project: {
        findUnique: vi.fn().mockResolvedValue({ id: "project_1", key: "booking_photoshop_studio" })
      },
      assistant: {
        findFirst: vi.fn().mockResolvedValue({ id: "assistant_1", key: "booking_assistant" })
      },
      tokenPolicy: {
        create: vi.fn().mockResolvedValue({
          project: { key: "booking_photoshop_studio" },
          assistant: { key: "booking_assistant" },
          preferredModel: "gpt-5.4",
          fallbackModel: "gpt-5.4-mini",
          dailyBudgetUsd: "25",
          monthlyBudgetUsd: "500",
          maxTokensPerRequest: 8000,
          emergencyMode: true
        }),
        findFirst: vi.fn()
      }
    };
    const repositories = new PrismaRepositorySet(prisma);

    await expect(
      repositories.tokenPolicies.save({
        projectKey: "booking_photoshop_studio",
        assistantKey: "booking_assistant",
        preferredModel: "gpt-5.4",
        fallbackModel: "gpt-5.4-mini",
        dailyBudgetUsd: 25,
        monthlyBudgetUsd: 500,
        maxTokensPerRequest: 8000,
        emergencyMode: true
      })
    ).resolves.toMatchObject({
      projectKey: "booking_photoshop_studio",
      assistantKey: "booking_assistant",
      emergencyMode: true
    });

    expect(prisma.tokenPolicy.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: "project_1",
        assistantId: "assistant_1",
        emergencyAction: "DOWNGRADE_MODEL"
      }),
      include: {
        project: { select: { key: true } },
        assistant: { select: { key: true } }
      }
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
          environment: "production",
          rotationDueAt: new Date("2026-06-10T00:00:00.000Z"),
          lastVerifiedAt: new Date("2026-05-20T00:00:00.000Z"),
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
            environment: "production",
            rotationDueAt: new Date("2026-06-10T00:00:00.000Z"),
            lastVerifiedAt: new Date("2026-05-20T00:00:00.000Z"),
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
      environment: "production",
      rotationDueAt: "2026-06-10T00:00:00.000Z",
      lastVerifiedAt: "2026-05-20T00:00:00.000Z",
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
      expect.objectContaining({
        secretRef: "vercel:BOOKING_ASSISTANT_OPENAI_API_KEY",
        environment: "production",
        rotationDueAt: "2026-06-10T00:00:00.000Z",
        lastVerifiedAt: "2026-05-20T00:00:00.000Z"
      })
    ]);

    expect(prisma.project.upsert).toHaveBeenCalledOnce();
    expect(prisma.repository.upsert).toHaveBeenCalledOnce();
    expect(prisma.projectControl.upsert).toHaveBeenCalledOnce();
    expect(prisma.aiKeyReference.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        environment: "production",
        rotationDueAt: new Date("2026-06-10T00:00:00.000Z"),
        lastVerifiedAt: new Date("2026-05-20T00:00:00.000Z")
      }),
      update: expect.objectContaining({
        environment: "production",
        rotationDueAt: new Date("2026-06-10T00:00:00.000Z"),
        lastVerifiedAt: new Date("2026-05-20T00:00:00.000Z")
      })
    }));
  });
});
