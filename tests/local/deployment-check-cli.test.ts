import { describe, expect, it } from "vitest";
import {
  parseDeploymentCheckCliArgs,
  runDeploymentCheckCli
} from "@/local/deployment-check-cli";

describe("deployment check CLI", () => {
  it("parses base URL, token, expected persistence, and dry-run options", () => {
    expect(
      parseDeploymentCheckCliArgs([
        "--base-url",
        "https://founder-os.example.com/",
        "--token",
        "admin-token",
        "--expected-persistence",
        "prisma",
        "--production",
        "--dry-run"
      ])
    ).toEqual({
      baseUrl: "https://founder-os.example.com",
      token: "admin-token",
      expectedPersistence: "prisma",
      production: true,
      dryRun: true
    });
  });

  it("uses deployment-safe defaults from env", () => {
    expect(
      parseDeploymentCheckCliArgs([], {
        FOUNDER_OS_BASE_URL: "https://founder-os.example.com",
        FOUNDER_OS_ADMIN_TOKEN: "admin-token"
      })
    ).toEqual({
      baseUrl: "https://founder-os.example.com",
      token: "admin-token",
      expectedPersistence: "prisma",
      production: false,
      dryRun: false
    });
  });

  it("builds a dry-run check plan without calling health", async () => {
    const result = await runDeploymentCheckCli({
      options: {
        baseUrl: "https://founder-os.example.com",
        token: "admin-token",
        expectedPersistence: "prisma",
        production: false,
        dryRun: true
      },
      get: async () => {
        throw new Error("dry-run should not fetch");
      },
      hasMigrationDeployScript: () => true
    });

    expect(result).toEqual({
      mode: "dry-run",
      checks: [
        { name: "migrationDeployScript", passed: true },
        { name: "adminToken", passed: true },
        {
          name: "healthEndpoint",
          passed: true,
          endpoint: "https://founder-os.example.com/api/health"
        }
      ]
    });
  });

  it("passes when production health reports prisma repositories", async () => {
    const calls: unknown[] = [];

    const result = await runDeploymentCheckCli({
      options: {
        baseUrl: "https://founder-os.example.com",
        token: "admin-token",
        expectedPersistence: "prisma",
        production: true,
        dryRun: false
      },
      hasMigrationDeployScript: () => true,
      get: async (endpoint, headers) => {
        calls.push({ endpoint, headers });
        return {
          status: "ok",
          persistenceMode: "prisma",
          repositoryKind: "prisma",
          environment: {
            adminTokenConfigured: true,
            dashboardDemoEnabled: false
          },
          privateMvpReadiness: {
            plaintextSecretsStored: false,
            projectOnboarding: true,
            aiKeyReferences: true,
            projectConnectionBundle: true,
            bulkTokenPolicy: true,
            providerSpendImport: true
          }
        };
      }
    });

    expect(calls).toEqual([
      {
        endpoint: "https://founder-os.example.com/api/health",
        headers: {
          Authorization: "Bearer admin-token",
          "Content-Type": "application/json"
        }
      }
    ]);
    expect(result).toMatchObject({
      mode: "checked",
      ready: true,
      health: {
        persistenceMode: "prisma",
        repositoryKind: "prisma"
      }
    });
  });

  it("fails when production is still running memory repositories", async () => {
    await expect(
      runDeploymentCheckCli({
        options: {
          baseUrl: "https://founder-os.example.com",
          token: "admin-token",
          expectedPersistence: "prisma",
          production: true,
          dryRun: false
        },
        hasMigrationDeployScript: () => true,
        get: async () => ({
          status: "ok",
          persistenceMode: "memory",
          repositoryKind: "memory",
          environment: {
            adminTokenConfigured: true,
            dashboardDemoEnabled: false
          },
          privateMvpReadiness: {
            plaintextSecretsStored: false,
            projectOnboarding: true,
            aiKeyReferences: true,
            projectConnectionBundle: true,
            bulkTokenPolicy: true,
            providerSpendImport: true
          }
        })
      })
    ).rejects.toThrow("Deployment check failed");
  });

  it("fails production checks when dashboard demo mode is enabled", async () => {
    await expect(
      runDeploymentCheckCli({
        options: {
          baseUrl: "https://founder-os.example.com",
          token: "admin-token",
          expectedPersistence: "prisma",
          production: true,
          dryRun: false
        },
        hasMigrationDeployScript: () => true,
        get: async () => ({
          status: "ok",
          persistenceMode: "prisma",
          repositoryKind: "prisma",
          environment: {
            adminTokenConfigured: true,
            dashboardDemoEnabled: true
          },
          privateMvpReadiness: {
            plaintextSecretsStored: false,
            projectOnboarding: true,
            aiKeyReferences: true,
            projectConnectionBundle: true,
            bulkTokenPolicy: true,
            providerSpendImport: true
          }
        })
      })
    ).rejects.toThrow("dashboardDemoDisabled");
  });

  it("fails production checks when any private readiness flag is not ready", async () => {
    await expect(
      runDeploymentCheckCli({
        options: {
          baseUrl: "https://founder-os.example.com",
          token: "admin-token",
          expectedPersistence: "prisma",
          production: true,
          dryRun: false
        },
        hasMigrationDeployScript: () => true,
        get: async () => ({
          status: "ok",
          persistenceMode: "prisma",
          repositoryKind: "prisma",
          environment: {
            adminTokenConfigured: true,
            dashboardDemoEnabled: false
          },
          privateMvpReadiness: {
            plaintextSecretsStored: false,
            projectOnboarding: true,
            aiKeyReferences: true,
            projectConnectionBundle: true,
            bulkTokenPolicy: false,
            providerSpendImport: true
          }
        })
      })
    ).rejects.toThrow("privateReadiness:bulkTokenPolicy");
  });
});
