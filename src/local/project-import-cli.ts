import {
  buildBulkProjectImportPayload,
  discoverProjectManifestFiles,
  type BulkProjectImportPayload
} from "@/local/project-manifest-scanner";

export type ProjectImportCliOptions = {
  rootPath: string;
  endpoint: string;
  token?: string;
  dryRun: boolean;
};

export type ProjectImportCliDependencies = {
  options: ProjectImportCliOptions;
  discover?: (rootPath: string) => Promise<BulkProjectImportPayload["manifests"]>;
  post?: (
    endpoint: string,
    payload: BulkProjectImportPayload,
    headers: Record<string, string>
  ) => Promise<unknown>;
};

export function parseProjectImportCliArgs(
  args: string[],
  env: Record<string, string | undefined> = {}
): ProjectImportCliOptions {
  return {
    rootPath: readOption(args, "--root") ?? env.FOUNDER_OS_PROJECT_ROOT ?? "C:\\Repos",
    endpoint:
      readOption(args, "--endpoint") ??
      env.FOUNDER_OS_BULK_IMPORT_ENDPOINT ??
      "http://localhost:3000/api/projects/bulk-import",
    token: readOption(args, "--token") ?? env.FOUNDER_OS_ADMIN_TOKEN,
    dryRun: args.includes("--dry-run")
  };
}

export async function runProjectImportCli(dependencies: ProjectImportCliDependencies) {
  const discover = dependencies.discover ?? discoverProjectManifestFiles;
  const post = dependencies.post ?? postBulkProjectImport;
  const manifests = await discover(dependencies.options.rootPath);
  const payload = buildBulkProjectImportPayload(manifests);

  if (dependencies.options.dryRun) {
    return {
      mode: "dry-run" as const,
      manifestCount: manifests.length,
      payload
    };
  }

  return {
    mode: "imported" as const,
    manifestCount: manifests.length,
    response: await post(
      dependencies.options.endpoint,
      payload,
      buildHeaders(dependencies.options.token)
    )
  };
}

export async function postBulkProjectImport(
  endpoint: string,
  payload: BulkProjectImportPayload,
  headers: Record<string, string>
) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(`Bulk project import failed with ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

function buildHeaders(token: string | undefined): Record<string, string> {
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Content-Type": "application/json"
  };
}

function readOption(args: string[], optionName: string): string | undefined {
  const index = args.indexOf(optionName);
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}
