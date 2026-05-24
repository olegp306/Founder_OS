export type LaunchBundleCliOptions = {
  deploymentReportPath: string;
  transferReportPath: string;
  launchEvidencePath: string;
  writeSummaryPath?: string;
};

export type LaunchBundleCliDependencies = {
  options: LaunchBundleCliOptions;
  readFile?: (path: string) => Promise<string>;
};

export function parseLaunchBundleCliArgs(args: string[]): LaunchBundleCliOptions {
  return {
    deploymentReportPath: requireOption(args, "--deployment-report"),
    transferReportPath: requireOption(args, "--transfer-report"),
    launchEvidencePath: requireOption(args, "--launch-evidence"),
    writeSummaryPath: readOption(args, "--write-summary")
  };
}

export async function runLaunchBundleCli(dependencies: LaunchBundleCliDependencies) {
  const readFile = dependencies.readFile ?? readFileAsUtf8;
  const deploymentReport = JSON.parse(await readFile(dependencies.options.deploymentReportPath));
  const transferReport = JSON.parse(await readFile(dependencies.options.transferReportPath));
  const launchEvidence = JSON.parse(await readFile(dependencies.options.launchEvidencePath));
  const summary = buildLaunchBundleSummary(deploymentReport, transferReport, launchEvidence);
  const result = await withOptionalSummary(dependencies.options.writeSummaryPath, summary);

  if (!summary.ready) {
    const summarySuffix = dependencies.options.writeSummaryPath
      ? `; summary written to ${dependencies.options.writeSummaryPath}`
      : "";
    throw new Error(`Launch bundle check failed${summarySuffix}: ${summary.blockers.join(", ")}`);
  }

  return result;
}

function buildLaunchBundleSummary(
  deploymentReport: unknown,
  transferReport: unknown,
  launchEvidence: unknown
) {
  const deploymentBlockers = deploymentReportReady(deploymentReport)
    ? []
    : extractDeploymentBlockers(deploymentReport);
  const transferBlockers = transferReportReady(transferReport)
    ? []
    : extractTransferBlockers(transferReport);
  const launchEvidenceBlockers = launchEvidenceReady(launchEvidence)
    ? []
    : extractLaunchEvidenceBlockers(launchEvidence);
  const blockers = [
    ...deploymentBlockers.map((blocker) => `deployment:${blocker}`),
    ...transferBlockers.map((blocker) => `transfer:${blocker}`),
    ...launchEvidenceBlockers.map((blocker) => `launchEvidence:${blocker}`)
  ];

  return {
    generatedAt: new Date().toISOString(),
    ready: blockers.length === 0,
    project: extractProject(transferReport, launchEvidence),
    blockers,
    checks: {
      deployment: {
        ready: deploymentBlockers.length === 0,
        blockers: deploymentBlockers
      },
      transfer: {
        ready: transferBlockers.length === 0,
        blockers: transferBlockers
      },
      launchEvidence: {
        ready: launchEvidenceBlockers.length === 0,
        blockers: launchEvidenceBlockers
      }
    }
  };
}

async function withOptionalSummary<T extends { ready: boolean; blockers: string[]; project?: unknown }>(
  summaryPath: string | undefined,
  summary: T
) {
  if (!summaryPath) {
    return summary;
  }

  const { mkdir, writeFile } = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  const sanitizedSummary = sanitizeUnknown(summary);

  await mkdir(dirname(summaryPath), { recursive: true });
  await writeFile(summaryPath, `${JSON.stringify(sanitizedSummary, null, 2)}\n`, "utf8");

  return {
    ...summary,
    summary: {
      path: summaryPath,
      written: true as const
    }
  };
}

function deploymentReportReady(value: unknown) {
  return isRecord(value) && value.ready === true;
}

function transferReportReady(value: unknown) {
  if (!isRecord(value) || !isRecord(value.readiness)) {
    return false;
  }

  return value.readiness.ready === true;
}

function launchEvidenceReady(value: unknown) {
  return isRecord(value) && value.ready === true;
}

function extractDeploymentBlockers(value: unknown) {
  if (!isRecord(value)) {
    return ["deployment report unreadable"];
  }

  const failedChecks = Array.isArray(value.failedChecks) ? value.failedChecks : [];
  const names = failedChecks
    .map((check) => isRecord(check) && typeof check.name === "string" ? check.name : undefined)
    .filter((name): name is string => Boolean(name));

  return names.length > 0 ? names : ["deployment report not ready"];
}

function extractTransferBlockers(value: unknown) {
  if (!isRecord(value) || !isRecord(value.readiness)) {
    return ["transfer readiness not reported"];
  }

  const missing = Array.isArray(value.readiness.missing) ? value.readiness.missing : [];
  const labels = missing.filter((item): item is string => typeof item === "string");

  return labels.length > 0 ? labels : ["transfer report not ready"];
}

function extractLaunchEvidenceBlockers(value: unknown) {
  if (!isRecord(value)) {
    return ["launch evidence unreadable"];
  }

  const blockers = Array.isArray(value.launchBlockers) ? value.launchBlockers : [];
  const labels = blockers.filter((item): item is string => typeof item === "string");

  return labels.length > 0 ? labels : ["launch evidence not ready"];
}

function extractProject(transferReport: unknown, launchEvidence: unknown) {
  const transferProject = isRecord(transferReport) && isRecord(transferReport.project)
    ? transferReport.project
    : undefined;
  const projectKey = isRecord(transferProject) && typeof transferProject.projectKey === "string"
    ? transferProject.projectKey
    : isRecord(launchEvidence) && typeof launchEvidence.projectKey === "string"
      ? launchEvidence.projectKey
      : undefined;
  const assistantKey = isRecord(transferProject) && typeof transferProject.assistantKey === "string"
    ? transferProject.assistantKey
    : isRecord(launchEvidence) && typeof launchEvidence.assistantKey === "string"
      ? launchEvidence.assistantKey
      : undefined;

  return {
    projectKey,
    assistantKey
  };
}

function sanitizeUnknown(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeUnknown(item));
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !isUnsafeSummaryKey(key))
      .map(([key, nestedValue]) => [key, sanitizeUnknown(nestedValue)])
  );
}

function isUnsafeSummaryKey(key: string) {
  const normalized = key.toLowerCase();
  return normalized.includes("plaintext") ||
    normalized.includes("secret") ||
    normalized === "token" ||
    normalized === "authorization" ||
    normalized === "apikey" ||
    normalized === "api_key";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function readFileAsUtf8(path: string) {
  const { readFile } = await import("node:fs/promises");
  return readFile(path, "utf8");
}

function requireOption(args: string[], optionName: string) {
  const value = readOption(args, optionName);

  if (!value) {
    throw new Error(`Missing required option ${optionName}`);
  }

  return value;
}

function readOption(args: string[], optionName: string): string | undefined {
  const index = args.indexOf(optionName);
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}
