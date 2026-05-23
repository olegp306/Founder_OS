import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type DeploymentCheckCliOptions = {
  baseUrl: string;
  token?: string;
  expectedPersistence: "memory" | "prisma";
  dryRun: boolean;
};

export type DeploymentCheck = {
  name: string;
  passed: boolean;
  endpoint?: string;
  actual?: unknown;
  expected?: unknown;
};

export type DeploymentHealthResponse = {
  status?: string;
  persistenceMode?: string;
  repositoryKind?: string;
  environment?: {
    adminTokenConfigured?: boolean;
  };
  privateMvpReadiness?: {
    plaintextSecretsStored?: boolean;
    projectOnboarding?: boolean;
    aiKeyReferences?: boolean;
    projectConnectionBundle?: boolean;
  };
};

export type DeploymentCheckCliDependencies = {
  options: DeploymentCheckCliOptions;
  get?: (endpoint: string, headers: Record<string, string>) => Promise<DeploymentHealthResponse>;
  hasMigrationDeployScript?: () => boolean;
};

export function parseDeploymentCheckCliArgs(
  args: string[],
  env: Record<string, string | undefined> = {}
): DeploymentCheckCliOptions {
  return {
    baseUrl: stripTrailingSlash(
      readOption(args, "--base-url") ?? env.FOUNDER_OS_BASE_URL ?? "http://localhost:3000"
    ),
    token: readOption(args, "--token") ?? env.FOUNDER_OS_ADMIN_TOKEN,
    expectedPersistence: parseExpectedPersistence(
      readOption(args, "--expected-persistence") ?? env.FOUNDER_OS_EXPECTED_PERSISTENCE ?? "prisma"
    ),
    dryRun: args.includes("--dry-run")
  };
}

export async function runDeploymentCheckCli(dependencies: DeploymentCheckCliDependencies) {
  const get = dependencies.get ?? getJson;
  const hasMigrationDeployScript =
    dependencies.hasMigrationDeployScript ?? defaultHasMigrationDeployScript;
  const healthEndpoint = `${dependencies.options.baseUrl}/api/health`;
  const baseChecks: DeploymentCheck[] = [
    {
      name: "migrationDeployScript",
      passed: hasMigrationDeployScript()
    },
    {
      name: "adminToken",
      passed: Boolean(dependencies.options.token)
    },
    {
      name: "healthEndpoint",
      passed: true,
      endpoint: healthEndpoint
    }
  ];

  if (dependencies.options.dryRun) {
    return {
      mode: "dry-run" as const,
      checks: baseChecks
    };
  }

  const health = await get(healthEndpoint, buildHeaders(dependencies.options.token));
  const checks = [
    ...baseChecks,
    {
      name: "healthStatus",
      passed: health.status === "ok",
      actual: health.status,
      expected: "ok"
    },
    {
      name: "persistenceMode",
      passed: health.persistenceMode === dependencies.options.expectedPersistence,
      actual: health.persistenceMode,
      expected: dependencies.options.expectedPersistence
    },
    {
      name: "repositoryKind",
      passed: health.repositoryKind === dependencies.options.expectedPersistence,
      actual: health.repositoryKind,
      expected: dependencies.options.expectedPersistence
    },
    {
      name: "adminTokenConfigured",
      passed: health.environment?.adminTokenConfigured === true,
      actual: health.environment?.adminTokenConfigured,
      expected: true
    },
    {
      name: "plaintextSecretsStored",
      passed: health.privateMvpReadiness?.plaintextSecretsStored === false,
      actual: health.privateMvpReadiness?.plaintextSecretsStored,
      expected: false
    },
    {
      name: "projectOnboarding",
      passed: health.privateMvpReadiness?.projectOnboarding === true,
      actual: health.privateMvpReadiness?.projectOnboarding,
      expected: true
    },
    {
      name: "aiKeyReferences",
      passed: health.privateMvpReadiness?.aiKeyReferences === true,
      actual: health.privateMvpReadiness?.aiKeyReferences,
      expected: true
    },
    {
      name: "projectConnectionBundle",
      passed: health.privateMvpReadiness?.projectConnectionBundle === true,
      actual: health.privateMvpReadiness?.projectConnectionBundle,
      expected: true
    }
  ];
  const ready = checks.every((check) => check.passed);

  if (!ready) {
    throw new Error(`Deployment check failed: ${JSON.stringify(checks.filter((check) => !check.passed))}`);
  }

  return {
    mode: "checked" as const,
    ready,
    checks,
    health
  };
}

async function getJson(endpoint: string, headers: Record<string, string>) {
  const response = await fetch(endpoint, { method: "GET", headers });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(`Deployment health check failed with ${response.status}: ${JSON.stringify(body)}`);
  }

  return body as DeploymentHealthResponse;
}

function defaultHasMigrationDeployScript() {
  const packageJsonPath = join(process.cwd(), "package.json");

  if (!existsSync(packageJsonPath)) {
    return false;
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    scripts?: Record<string, string>;
  };

  return packageJson.scripts?.["prisma:migrate:deploy"] === "prisma migrate deploy";
}

function buildHeaders(token: string | undefined): Record<string, string> {
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Content-Type": "application/json"
  };
}

function parseExpectedPersistence(value: string): DeploymentCheckCliOptions["expectedPersistence"] {
  return value === "memory" ? "memory" : "prisma";
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
