import {
  buildBulkProjectImportPayload,
  discoverProjectManifestFiles,
  type BulkProjectImportPayload
} from "@/local/project-manifest-scanner";
import type { ProjectAiSetupPayload } from "@/local/project-ai-setup-cli";

export type ProjectTransferCliOptions = {
  rootPath: string;
  setupConfigPath: string;
  baseUrl: string;
  token?: string;
  dryRun: boolean;
};

export type ProjectTransferCliDependencies = {
  options: ProjectTransferCliOptions;
  discover?: (rootPath: string) => Promise<BulkProjectImportPayload["manifests"]>;
  readSetupConfig?: (configPath: string) => Promise<string>;
  post?: (
    endpoint: string,
    payload: unknown,
    headers: Record<string, string>
  ) => Promise<unknown>;
  get?: (endpoint: string, headers: Record<string, string>) => Promise<unknown>;
};

export function parseProjectTransferCliArgs(
  args: string[],
  env: Record<string, string | undefined> = {}
): ProjectTransferCliOptions {
  return {
    rootPath: readOption(args, "--root") ?? env.FOUNDER_OS_PROJECT_ROOT ?? "C:\\Repos",
    setupConfigPath:
      readOption(args, "--setup-config") ??
      env.FOUNDER_OS_PROJECT_AI_SETUP_CONFIG ??
      ".founderos/ai-setup.json",
    baseUrl: stripTrailingSlash(
      readOption(args, "--base-url") ?? env.FOUNDER_OS_BASE_URL ?? "http://localhost:3000"
    ),
    token: readOption(args, "--token") ?? env.FOUNDER_OS_ADMIN_TOKEN,
    dryRun: args.includes("--dry-run")
  };
}

export async function runProjectTransferCli(dependencies: ProjectTransferCliDependencies) {
  const discover = dependencies.discover ?? discoverProjectManifestFiles;
  const readSetupConfig = dependencies.readSetupConfig ?? readFileAsUtf8;
  const post = dependencies.post ?? postJson;
  const get = dependencies.get ?? getJson;
  const manifests = await discover(dependencies.options.rootPath);
  const setupPayload = sanitizeSetupPayload(
    JSON.parse(await readSetupConfig(dependencies.options.setupConfigPath))
  );
  const importEndpoint = `${dependencies.options.baseUrl}/api/projects/bulk-import`;
  const setupEndpoint = `${dependencies.options.baseUrl}/api/projects/ai-setup`;
  const connectionEndpoint = buildConnectionEndpoint(dependencies.options.baseUrl, setupPayload);
  const headers = buildHeaders(dependencies.options.token);

  if (dependencies.options.dryRun) {
    return {
      mode: "dry-run" as const,
      import: {
        manifestCount: manifests.length,
        endpoint: importEndpoint
      },
      setup: {
        endpoint: setupEndpoint,
        payload: setupPayload
      },
      connection: {
        endpoint: connectionEndpoint
      }
    };
  }

  return {
    mode: "transferred" as const,
    import: await post(importEndpoint, buildBulkProjectImportPayload(manifests), headers),
    setup: await post(setupEndpoint, setupPayload, headers),
    connection: await get(connectionEndpoint, headers)
  };
}

async function postJson(endpoint: string, payload: unknown, headers: Record<string, string>) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(`Project transfer POST failed with ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

async function getJson(endpoint: string, headers: Record<string, string>) {
  const response = await fetch(endpoint, { method: "GET", headers });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(`Project transfer GET failed with ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

function buildConnectionEndpoint(baseUrl: string, payload: ProjectAiSetupPayload): string {
  const params = new URLSearchParams({
    projectKey: payload.projectKey,
    assistantKey: payload.assistantKey
  });

  return `${baseUrl}/api/projects/connection?${params.toString()}`;
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
  const { readFile } = await import("node:fs/promises");
  return readFile(path, "utf8");
}

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function readOption(args: string[], optionName: string): string | undefined {
  const index = args.indexOf(optionName);
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}
