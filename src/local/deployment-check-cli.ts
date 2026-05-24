import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type DeploymentCheckCliOptions = {
  baseUrl: string;
  token?: string;
  expectedPersistence: "memory" | "prisma";
  production: boolean;
  dryRun: boolean;
  writeReportPath?: string;
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
    dashboardDemoEnabled?: boolean;
  };
  privateMvpReadiness?: {
    plaintextSecretsStored?: boolean;
    projectOnboarding?: boolean;
    aiKeyReferences?: boolean;
    projectConnectionBundle?: boolean;
    [key: string]: boolean | undefined;
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
    production: args.includes("--production"),
    dryRun: args.includes("--dry-run"),
    writeReportPath: readOption(args, "--write-report")
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
    return withOptionalReport(dependencies.options, healthEndpoint, {
      mode: "dry-run" as const,
      checks: baseChecks
    });
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
    },
    ...productionChecks(dependencies.options, health)
  ];
  const ready = checks.every((check) => check.passed);
  const result = {
    mode: "checked" as const,
    ready,
    checks,
    health
  };

  if (!ready) {
    withOptionalReport(dependencies.options, healthEndpoint, result);
    throw new Error(`Deployment check failed: ${JSON.stringify(checks.filter((check) => !check.passed))}`);
  }

  return withOptionalReport(dependencies.options, healthEndpoint, result);
}

function withOptionalReport<
  T extends {
    mode: "dry-run" | "checked";
    checks: DeploymentCheck[];
    ready?: boolean;
    health?: DeploymentHealthResponse;
  }
>(options: DeploymentCheckCliOptions, endpoint: string, result: T) {
  if (!options.writeReportPath) {
    return result;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: result.mode,
    ready: result.ready ?? false,
    endpoint,
    checks: sanitizeForReport(result.checks),
    ...(result.health ? { health: sanitizeForReport(result.health) } : {})
  };

  mkdirSync(dirname(options.writeReportPath), { recursive: true });
  writeFileSync(options.writeReportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return {
    ...result,
    report: {
      path: options.writeReportPath,
      written: true
    }
  };
}

function sanitizeForReport(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForReport(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !isSensitiveReportKey(key))
      .map(([key, nestedValue]) => [key, sanitizeForReport(nestedValue)])
  );
}

function isSensitiveReportKey(key: string) {
  const normalized = key.toLowerCase();
  return (
    normalized === "authorization" ||
    normalized === "token" ||
    normalized === "accesstoken" ||
    normalized === "refreshtoken" ||
    normalized === "authtoken" ||
    normalized === "bearertoken" ||
    normalized.includes("secret") ||
    normalized.includes("password") ||
    normalized.includes("apikey") ||
    normalized.includes("api_key")
  );
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

function productionChecks(
  options: DeploymentCheckCliOptions,
  health: DeploymentHealthResponse
): DeploymentCheck[] {
  if (!options.production) {
    return [];
  }

  return [
    {
      name: "productionPersistenceMode",
      passed: health.persistenceMode === "prisma",
      actual: health.persistenceMode,
      expected: "prisma"
    },
    {
      name: "productionRepositoryKind",
      passed: health.repositoryKind === "prisma",
      actual: health.repositoryKind,
      expected: "prisma"
    },
    {
      name: "dashboardDemoDisabled",
      passed: health.environment?.dashboardDemoEnabled === false,
      actual: health.environment?.dashboardDemoEnabled,
      expected: false
    },
    ...privateReadinessChecks(health.privateMvpReadiness)
  ];
}

function privateReadinessChecks(
  readiness: DeploymentHealthResponse["privateMvpReadiness"]
): DeploymentCheck[] {
  if (!readiness) {
    return [
      {
        name: "privateReadiness",
        passed: false,
        actual: undefined,
        expected: "all readiness flags"
      }
    ];
  }

  return Object.entries(readiness).map(([name, value]) => {
    const expected = name === "plaintextSecretsStored" ? false : true;

    return {
      name: `privateReadiness:${name}`,
      passed: value === expected,
      actual: value,
      expected
    };
  });
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
