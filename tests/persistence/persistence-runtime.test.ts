import { describe, expect, it } from "vitest";
import {
  createFounderOsRuntime,
  selectPersistenceMode
} from "@/server/founder-os-runtime";

describe("Founder OS persistence runtime", () => {
  it("uses in-memory persistence when DATABASE_URL is not configured", () => {
    expect(selectPersistenceMode({ DATABASE_URL: undefined })).toBe("memory");
  });

  it("uses prisma persistence when DATABASE_URL is configured and memory mode is not forced", () => {
    expect(
      selectPersistenceMode({
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/founder_os"
      })
    ).toBe("prisma");
  });

  it("allows forcing memory mode for local smoke tests even with DATABASE_URL configured", () => {
    expect(
      selectPersistenceMode({
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/founder_os",
        FOUNDER_OS_FORCE_MEMORY: "true"
      })
    ).toBe("memory");
  });

  it("creates a runtime that exposes persistence mode and stores", () => {
    const runtime = createFounderOsRuntime({ FOUNDER_OS_FORCE_MEMORY: "true" });

    expect(runtime.persistenceMode).toBe("memory");
    expect(runtime.events).toBeDefined();
    expect(runtime.profiles).toBeDefined();
    expect(runtime.profileOps).toBeDefined();
    expect(runtime.tokens).toBeDefined();
    expect(runtime.campaigns).toBeDefined();
  });

  it("uses Prisma repositories when DATABASE_URL is configured", () => {
    const runtime = createFounderOsRuntime({
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/founder_os",
      prismaClient: {}
    });

    expect(runtime.persistenceMode).toBe("prisma");
    expect(runtime.repositories.kind).toBe("prisma");
  });

  it("keeps memory repositories when memory mode is forced", () => {
    const runtime = createFounderOsRuntime({
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/founder_os",
      FOUNDER_OS_FORCE_MEMORY: "true",
      prismaClient: {}
    });

    expect(runtime.persistenceMode).toBe("memory");
    expect(runtime.repositories.kind).toBe("memory");
  });
});
