import { readFile } from "node:fs/promises";

export type ProjectAiSetupPayload = {
  projectKey: string;
  assistantKey: string;
  aiKey: {
    provider: "openai" | "anthropic" | "google" | "other";
    secretRef: string;
    displayName: string;
    allowedModels: string[];
    defaultModel: string;
    monthlyBudgetUsd: number;
    plaintextSecret?: string;
  };
  tokenPolicy: {
    preferredModel: string;
    fallbackModel: string;
    dailyBudgetUsd: number;
    monthlyBudgetUsd: number;
    maxTokensPerRequest: number;
    emergencyMode: boolean;
  };
};

export type ProjectAiSetupCliOptions = {
  configPath: string;
  endpoint: string;
  token?: string;
  dryRun: boolean;
};

export type ProjectAiSetupCliDependencies = {
  options: ProjectAiSetupCliOptions;
  readConfig?: (configPath: string) => Promise<string>;
  post?: (
    endpoint: string,
    payload: ProjectAiSetupPayload,
    headers: Record<string, string>
  ) => Promise<unknown>;
};

export function parseProjectAiSetupCliArgs(
  args: string[],
  env: Record<string, string | undefined> = {}
): ProjectAiSetupCliOptions {
  return {
    configPath:
      readOption(args, "--config") ??
      env.FOUNDER_OS_PROJECT_AI_SETUP_CONFIG ??
      ".founderos/ai-setup.json",
    endpoint:
      readOption(args, "--endpoint") ??
      env.FOUNDER_OS_AI_SETUP_ENDPOINT ??
      "http://localhost:3000/api/projects/ai-setup",
    token: readOption(args, "--token") ?? env.FOUNDER_OS_ADMIN_TOKEN,
    dryRun: args.includes("--dry-run")
  };
}

export async function runProjectAiSetupCli(dependencies: ProjectAiSetupCliDependencies) {
  const readConfig = dependencies.readConfig ?? readFileAsUtf8;
  const post = dependencies.post ?? postProjectAiSetup;
  const payload = sanitizeSetupPayload(JSON.parse(await readConfig(dependencies.options.configPath)));

  if (dependencies.options.dryRun) {
    return {
      mode: "dry-run" as const,
      payload
    };
  }

  return {
    mode: "configured" as const,
    response: await post(
      dependencies.options.endpoint,
      payload,
      buildHeaders(dependencies.options.token)
    )
  };
}

export async function postProjectAiSetup(
  endpoint: string,
  payload: ProjectAiSetupPayload,
  headers: Record<string, string>
) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(`Project AI setup failed with ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

function sanitizeSetupPayload(payload: ProjectAiSetupPayload): ProjectAiSetupPayload {
  return {
    ...payload,
    aiKey: {
      ...payload.aiKey,
      plaintextSecret: undefined
    }
  };
}

function buildHeaders(token: string | undefined): Record<string, string> {
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Content-Type": "application/json"
  };
}

async function readFileAsUtf8(path: string) {
  return readFile(path, "utf8");
}

function readOption(args: string[], optionName: string): string | undefined {
  const index = args.indexOf(optionName);
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}
