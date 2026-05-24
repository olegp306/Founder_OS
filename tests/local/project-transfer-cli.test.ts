import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  parseProjectTransferCliArgs,
  runProjectTransferCli
} from "@/local/project-transfer-cli";

const setupPayload = {
  projectKey: "booking_assistant",
  assistantKey: "support_bot",
  aiKey: {
    provider: "openai" as const,
    secretRef: "vercel:BOOKING_ASSISTANT_OPENAI_API_KEY",
    displayName: "Booking Assistant OpenAI key",
    allowedModels: ["gpt-5.4-mini", "gpt-5.4"],
    defaultModel: "gpt-5.4-mini",
    monthlyBudgetUsd: 250,
    plaintextSecret: "sk-never-send"
  },
  tokenPolicy: {
    preferredModel: "gpt-5.4",
    fallbackModel: "gpt-5.4-mini",
    dailyBudgetUsd: 20,
    monthlyBudgetUsd: 250,
    maxTokensPerRequest: 8000,
    emergencyMode: false
  }
};

describe("project transfer CLI", () => {
  it("parses root, setup config, base URL, token, and dry-run options", () => {
    expect(
      parseProjectTransferCliArgs([
        "--root",
        "C:\\Repos",
        "--setup-config",
        "C:\\Repos\\booking\\.founderos\\ai-setup.json",
        "--base-url",
        "https://founder-os.example.com",
        "--token",
        "admin-token",
        "--write-report",
        "C:\\Repos\\booking\\.founderos\\transfer-report.json",
        "--dry-run"
      ])
    ).toEqual({
      rootPath: "C:\\Repos",
      setupConfigPath: "C:\\Repos\\booking\\.founderos\\ai-setup.json",
      baseUrl: "https://founder-os.example.com",
      token: "admin-token",
      writeReportPath: "C:\\Repos\\booking\\.founderos\\transfer-report.json",
      dryRun: true
    });
  });

  it("uses safe local defaults", () => {
    expect(parseProjectTransferCliArgs([])).toEqual({
      rootPath: "C:\\Repos",
      setupConfigPath: ".founderos/ai-setup.json",
      baseUrl: "http://localhost:3000",
      token: undefined,
      writeReportPath: undefined,
      dryRun: false
    });
  });

  it("builds a dry-run transfer plan without posting", async () => {
    const result = await runProjectTransferCli({
      options: {
        rootPath: "C:\\Repos",
        setupConfigPath: ".founderos/ai-setup.json",
        baseUrl: "http://localhost:3000",
        writeReportPath: undefined,
        dryRun: true
      },
      discover: async () => [
        {
          path: "C:\\Repos\\booking\\.founderos\\project.json",
          content: "{\"project_id\":\"booking_assistant\"}"
        }
      ],
      readSetupConfig: async () => JSON.stringify(setupPayload),
      post: async () => {
        throw new Error("dry-run should not call post");
      },
      get: async () => {
        throw new Error("dry-run should not call get");
      }
    });

    expect(result).toEqual({
      mode: "dry-run",
      import: {
        manifestCount: 1,
        endpoint: "http://localhost:3000/api/projects/bulk-import"
      },
      setup: {
        endpoint: "http://localhost:3000/api/projects/ai-setup",
        payload: {
          ...setupPayload,
          aiKey: {
            ...setupPayload.aiKey,
            plaintextSecret: undefined
          }
        }
      },
      connection: {
        endpoint:
          "http://localhost:3000/api/projects/connection?projectKey=booking_assistant&assistantKey=support_bot"
      }
    });
  });

  it("imports manifests, applies AI setup, and checks the connection bundle", async () => {
    const calls: unknown[] = [];

    const result = await runProjectTransferCli({
      options: {
        rootPath: "C:\\Repos",
        setupConfigPath: ".founderos/ai-setup.json",
        baseUrl: "http://localhost:3000",
        token: "admin-token",
        writeReportPath: undefined,
        dryRun: false
      },
      discover: async () => [
        {
          path: "C:\\Repos\\booking\\.founderos\\project.json",
          content: "{\"project_id\":\"booking_assistant\"}"
        }
      ],
      readSetupConfig: async () => JSON.stringify(setupPayload),
      post: async (endpoint, payload, headers) => {
        calls.push({ method: "POST", endpoint, payload, headers });
        return endpoint.endsWith("/api/projects/bulk-import")
          ? { status: "imported" }
          : { status: "configured", bundle: { ready: true } };
      },
      get: async (endpoint, headers) => {
        calls.push({ method: "GET", endpoint, headers });
        return { status: "built", bundle: { projectKey: "booking_assistant", ready: true } };
      }
    });

    expect(calls).toEqual([
      {
        method: "POST",
        endpoint: "http://localhost:3000/api/projects/bulk-import",
        payload: {
          manifests: [
            {
              path: "C:\\Repos\\booking\\.founderos\\project.json",
              content: "{\"project_id\":\"booking_assistant\"}"
            }
          ]
        },
        headers: {
          Authorization: "Bearer admin-token",
          "Content-Type": "application/json"
        }
      },
      {
        method: "POST",
        endpoint: "http://localhost:3000/api/projects/ai-setup",
        payload: {
          ...setupPayload,
          aiKey: {
            ...setupPayload.aiKey,
            plaintextSecret: undefined
          }
        },
        headers: {
          Authorization: "Bearer admin-token",
          "Content-Type": "application/json"
        }
      },
      {
        method: "GET",
        endpoint:
          "http://localhost:3000/api/projects/connection?projectKey=booking_assistant&assistantKey=support_bot",
        headers: {
          Authorization: "Bearer admin-token",
          "Content-Type": "application/json"
        }
      }
    ]);
    expect(result).toEqual({
      mode: "transferred",
      import: { status: "imported" },
      setup: { status: "configured", bundle: { ready: true } },
      connection: { status: "built", bundle: { projectKey: "booking_assistant", ready: true } }
    });
  });

  it("writes a sanitized transfer rehearsal report", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "founder-os-transfer-"));
    const reportPath = join(tempDir, "transfer-report.json");

    try {
      const result = await runProjectTransferCli({
        options: {
          rootPath: "C:\\Repos",
          setupConfigPath: ".founderos/ai-setup.json",
          baseUrl: "http://localhost:3000",
          token: "admin-token",
          writeReportPath: reportPath,
          dryRun: false
        },
        discover: async () => [
          {
            path: "C:\\Repos\\booking\\.founderos\\project.json",
            content: "{\"project_id\":\"booking_assistant\"}"
          }
        ],
        readSetupConfig: async () => JSON.stringify(setupPayload),
        post: async (endpoint) => endpoint.endsWith("/api/projects/bulk-import")
          ? {
              status: "imported",
              imported: [{ projectKey: "booking_assistant" }],
              skipped: [],
              invalid: []
            }
          : {
              status: "configured",
              bundle: {
                readiness: {
                  ready: false,
                  missing: ["token usage tracking"]
                }
              }
            },
        get: async () => ({
          status: "built",
          bundle: {
            projectKey: "booking_assistant",
            assistantKey: "support_bot",
            readiness: {
              ready: false,
              missing: ["token usage tracking"]
            },
            keyReferences: [
              {
                provider: "openai",
                secretRef: "vercel:BOOKING_ASSISTANT_OPENAI_API_KEY"
              }
            ]
          }
        })
      });

      expect(result.report).toEqual({
        path: reportPath,
        written: true
      });

      const report = JSON.parse(await readFile(reportPath, "utf8"));
      expect(report).toEqual({
        generatedAt: expect.any(String),
        mode: "transferred",
        endpoints: {
          import: "http://localhost:3000/api/projects/bulk-import",
          setup: "http://localhost:3000/api/projects/ai-setup",
          connection:
            "http://localhost:3000/api/projects/connection?projectKey=booking_assistant&assistantKey=support_bot"
        },
        project: {
          projectKey: "booking_assistant",
          assistantKey: "support_bot"
        },
        import: {
          manifestCount: 1,
          result: {
            status: "imported",
            imported: [{ projectKey: "booking_assistant" }],
            skipped: [],
            invalid: []
          }
        },
        setup: {
          provider: "openai",
          defaultModel: "gpt-5.4-mini",
          monthlyBudgetUsd: 250,
          tokenPolicy: {
            preferredModel: "gpt-5.4",
            fallbackModel: "gpt-5.4-mini",
            dailyBudgetUsd: 20,
            monthlyBudgetUsd: 250,
            maxTokensPerRequest: 8000,
            emergencyMode: false
          },
          result: {
            status: "configured",
            bundle: {
              readiness: {
                ready: false,
                missing: ["token usage tracking"]
              }
            }
          }
        },
        connection: {
          result: {
            status: "built",
            bundle: {
              projectKey: "booking_assistant",
              assistantKey: "support_bot",
              readiness: {
                ready: false,
                missing: ["token usage tracking"]
              },
              keyReferences: [
                {
                  provider: "openai",
                  secretRef: "vercel:BOOKING_ASSISTANT_OPENAI_API_KEY"
                }
              ]
            }
          }
        },
        readiness: {
          ready: false,
          missing: ["token usage tracking"]
        }
      });
      expect(JSON.stringify(report)).not.toContain("plaintextSecret");
      expect(JSON.stringify(report)).not.toContain("sk-never-send");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
