import { describe, expect, it } from "vitest";
import {
  parseProjectAiSetupCliArgs,
  runProjectAiSetupCli
} from "@/local/project-ai-setup-cli";

describe("project AI setup CLI", () => {
  it("parses config, endpoint, token, and dry-run options", () => {
    expect(
      parseProjectAiSetupCliArgs([
        "--config",
        "C:\\Repos\\booking\\.founderos\\ai-setup.json",
        "--endpoint",
        "http://localhost:3000/api/projects/ai-setup",
        "--token",
        "admin-token",
        "--dry-run"
      ])
    ).toEqual({
      configPath: "C:\\Repos\\booking\\.founderos\\ai-setup.json",
      endpoint: "http://localhost:3000/api/projects/ai-setup",
      token: "admin-token",
      dryRun: true
    });
  });

  it("uses safe defaults for local setup", () => {
    expect(parseProjectAiSetupCliArgs([])).toEqual({
      configPath: ".founderos/ai-setup.json",
      endpoint: "http://localhost:3000/api/projects/ai-setup",
      token: undefined,
      dryRun: false
    });
  });

  it("does not post setup payloads during a dry run", async () => {
    const payload = {
      projectKey: "booking_assistant",
      assistantKey: "support_bot",
      aiKey: {
        provider: "openai",
        secretRef: "vercel:BOOKING_ASSISTANT_OPENAI_API_KEY",
        displayName: "Booking Assistant OpenAI key",
        allowedModels: ["gpt-5.4-mini", "gpt-5.4"],
        defaultModel: "gpt-5.4-mini",
        monthlyBudgetUsd: 250
      },
      tokenPolicy: {
        preferredModel: "gpt-5.4",
        fallbackModel: "gpt-5.4-mini",
        dailyBudgetUsd: 20,
        monthlyBudgetUsd: 250,
        maxTokensPerRequest: 2000,
        emergencyMode: false
      }
    };

    const result = await runProjectAiSetupCli({
      options: {
        configPath: ".founderos/ai-setup.json",
        endpoint: "http://localhost:3000/api/projects/ai-setup",
        dryRun: true
      },
      readConfig: async () => JSON.stringify(payload),
      post: async () => {
        throw new Error("dry-run should not call post");
      }
    });

    expect(result).toEqual({
      mode: "dry-run",
      payload
    });
  });

  it("posts setup payloads with an authorization header when a token is configured", async () => {
    const calls: unknown[] = [];
    const payload = {
      projectKey: "booking_assistant",
      assistantKey: "support_bot",
      aiKey: {
        provider: "openai",
        secretRef: "vercel:BOOKING_ASSISTANT_OPENAI_API_KEY",
        displayName: "Booking Assistant OpenAI key",
        allowedModels: ["gpt-5.4-mini", "gpt-5.4"],
        defaultModel: "gpt-5.4-mini",
        monthlyBudgetUsd: 250,
        plaintextSecret: "sk-not-sent-to-founder-os"
      },
      tokenPolicy: {
        preferredModel: "gpt-5.4",
        fallbackModel: "gpt-5.4-mini",
        dailyBudgetUsd: 20,
        monthlyBudgetUsd: 250,
        maxTokensPerRequest: 2000,
        emergencyMode: false
      }
    };

    const result = await runProjectAiSetupCli({
      options: {
        configPath: ".founderos/ai-setup.json",
        endpoint: "http://localhost:3000/api/projects/ai-setup",
        token: "admin-token",
        dryRun: false
      },
      readConfig: async () => JSON.stringify(payload),
      post: async (endpoint, postedPayload, headers) => {
        calls.push({ endpoint, payload: postedPayload, headers });
        return {
          status: "configured",
          bundle: {
            projectKey: "booking_assistant",
            ready: true
          }
        };
      }
    });

    expect(calls).toEqual([
      {
        endpoint: "http://localhost:3000/api/projects/ai-setup",
        payload: {
          ...payload,
          aiKey: {
            ...payload.aiKey,
            plaintextSecret: undefined
          }
        },
        headers: {
          Authorization: "Bearer admin-token",
          "Content-Type": "application/json"
        }
      }
    ]);
    expect(result).toEqual({
      mode: "configured",
      response: {
        status: "configured",
        bundle: {
          projectKey: "booking_assistant",
          ready: true
        }
      }
    });
  });
});
