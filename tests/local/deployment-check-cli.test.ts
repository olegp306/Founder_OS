import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
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
        "--dry-run",
        "--write-report",
        "C:\\Repos\\Founder_OS\\.founderos\\deployment-report.json"
      ])
    ).toEqual({
      baseUrl: "https://founder-os.example.com",
      token: "admin-token",
      expectedPersistence: "prisma",
      production: true,
      dryRun: true,
      writeReportPath: "C:\\Repos\\Founder_OS\\.founderos\\deployment-report.json"
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
      dryRun: false,
      writeReportPath: undefined
    });
  });

  it("builds a dry-run check plan without calling health", async () => {
    const result = await runDeploymentCheckCli({
      options: {
        baseUrl: "https://founder-os.example.com",
        token: "admin-token",
        expectedPersistence: "prisma",
        production: false,
        dryRun: true,
        writeReportPath: undefined
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

  it("writes a sanitized deployment report artifact after a passing production check", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "founder-os-deployment-check-"));
    const reportPath = join(tempDir, "deployment-report.json");

    try {
      const result = await runDeploymentCheckCli({
        options: {
          baseUrl: "https://founder-os.example.com",
          token: "admin-token",
          expectedPersistence: "prisma",
          production: true,
          dryRun: false,
          writeReportPath: reportPath
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
            bulkTokenPolicy: true,
            providerSpendImport: true
          }
        })
      });
      const report = JSON.parse(readFileSync(reportPath, "utf8"));

      expect(result).toMatchObject({
        report: {
          path: reportPath,
          written: true
        }
      });
      expect(report).toMatchObject({
        mode: "checked",
        ready: true,
        endpoint: "https://founder-os.example.com/api/health",
        health: {
          status: "ok",
          persistenceMode: "prisma",
          repositoryKind: "prisma",
          environment: {
            adminTokenConfigured: true,
            dashboardDemoEnabled: false
          }
        }
      });
      expect(JSON.stringify(report)).not.toContain("admin-token");
      expect(JSON.stringify(report)).not.toContain("Authorization");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
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
