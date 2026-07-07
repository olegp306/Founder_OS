import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  parseLaunchBundleCliArgs,
  runLaunchBundleCli
} from "@/local/launch-bundle-cli";

describe("launch bundle CLI", () => {
  it("parses deployment, transfer, launch evidence, and summary paths", () => {
    expect(
      parseLaunchBundleCliArgs([
        "--deployment-report",
        "C:\\Repos\\booking\\.founderos\\deployment-report.json",
        "--transfer-report",
        "C:\\Repos\\booking\\.founderos\\transfer-report.json",
        "--launch-evidence",
        "C:\\Repos\\booking\\.founderos\\launch-evidence.json",
        "--write-summary",
        "C:\\Repos\\booking\\.founderos\\launch-summary.json"
      ])
    ).toEqual({
      deploymentReportPath: "C:\\Repos\\booking\\.founderos\\deployment-report.json",
      transferReportPath: "C:\\Repos\\booking\\.founderos\\transfer-report.json",
      launchEvidencePath: "C:\\Repos\\booking\\.founderos\\launch-evidence.json",
      writeSummaryPath: "C:\\Repos\\booking\\.founderos\\launch-summary.json"
    });
  });

  it("passes and writes a sanitized summary when all launch artifacts are ready", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "founder-os-launch-bundle-"));
    const deploymentReportPath = join(tempDir, "deployment-report.json");
    const transferReportPath = join(tempDir, "transfer-report.json");
    const launchEvidencePath = join(tempDir, "launch-evidence.json");
    const summaryPath = join(tempDir, "launch-summary.json");

    try {
      await writeJson(deploymentReportPath, {
        ready: true,
        failedChecks: [],
        health: {
          status: "ok",
          persistenceMode: "prisma",
          environment: {
            adminTokenConfigured: true
          }
        }
      });
      await writeJson(transferReportPath, {
        mode: "transferred",
        project: {
          projectKey: "booking_assistant",
          assistantKey: "support_bot"
        },
        readiness: {
          ready: true,
          missing: []
        },
        setup: {
          result: {
            plaintextSecret: "sk-never-write"
          }
        }
      });
      await writeJson(launchEvidencePath, {
        status: "built",
        projectKey: "booking_assistant",
        assistantKey: "support_bot",
        ready: true,
        launchBlockers: [],
        secretRef: "vercel:SHOULD_NOT_WRITE"
      });

      const result = await runLaunchBundleCli({
        options: {
          deploymentReportPath,
          transferReportPath,
          launchEvidencePath,
          writeSummaryPath: summaryPath
        }
      });
      const summary = JSON.parse(await readFile(summaryPath, "utf8"));

      expect(result).toMatchObject({
        ready: true,
        project: {
          projectKey: "booking_assistant",
          assistantKey: "support_bot"
        },
        summary: {
          path: summaryPath,
          written: true
        }
      });
      expect(summary).toMatchObject({
        ready: true,
        project: {
          projectKey: "booking_assistant",
          assistantKey: "support_bot"
        },
        checks: {
          deployment: { ready: true, blockers: [] },
          transfer: { ready: true, blockers: [] },
          launchEvidence: { ready: true, blockers: [] }
        }
      });
      expect(JSON.stringify(summary)).not.toContain("sk-never-write");
      expect(JSON.stringify(summary)).not.toContain("secretRef");
      expect(JSON.stringify(summary)).not.toContain("vercel:");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("fails with a written summary when any launch artifact has blockers", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "founder-os-launch-bundle-"));
    const deploymentReportPath = join(tempDir, "deployment-report.json");
    const transferReportPath = join(tempDir, "transfer-report.json");
    const launchEvidencePath = join(tempDir, "launch-evidence.json");
    const summaryPath = join(tempDir, "launch-summary.json");

    try {
      await writeJson(deploymentReportPath, {
        ready: false,
        failedChecks: [{ name: "persistenceMode", actual: "memory", expected: "prisma" }]
      });
      await writeJson(transferReportPath, {
        project: { projectKey: "booking_assistant", assistantKey: "support_bot" },
        readiness: { ready: false, missing: ["token usage tracking"] }
      });
      await writeJson(launchEvidencePath, {
        ready: false,
        launchBlockers: ["critical alerts present"]
      });

      await expect(
        runLaunchBundleCli({
          options: {
            deploymentReportPath,
            transferReportPath,
            launchEvidencePath,
            writeSummaryPath: summaryPath
          }
        })
      ).rejects.toThrow(
        `Launch bundle check failed; summary written to ${summaryPath}: deployment:persistenceMode, transfer:token usage tracking, launchEvidence:critical alerts present`
      );

      const summary = JSON.parse(await readFile(summaryPath, "utf8"));
      expect(summary).toMatchObject({
        ready: false,
        blockers: [
          "deployment:persistenceMode",
          "transfer:token usage tracking",
          "launchEvidence:critical alerts present"
        ]
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

async function writeJson(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
