import {
  type FounderOsProjectManifest,
  type InMemoryProjectOnboardingStore,
  onboardProjectManifest
} from "@/domain/projects/project-onboarding";

export type ManifestFile = {
  path: string;
  content: string;
};

export type ProjectImportReport = {
  imported: Array<{
    projectKey: string;
    name: string;
    manifestPath: string;
  }>;
  skipped: Array<{
    manifestPath: string;
    reason: "missing_required_fields";
  }>;
  invalid: Array<{
    manifestPath: string;
    reason: "invalid_json";
  }>;
};

export function importProjectManifests(
  store: InMemoryProjectOnboardingStore,
  files: ManifestFile[]
): ProjectImportReport {
  const report: ProjectImportReport = {
    imported: [],
    skipped: [],
    invalid: []
  };

  for (const file of files) {
    const parsed = parseManifestFile(file);

    if (parsed === "invalid_json") {
      report.invalid.push({
        manifestPath: file.path,
        reason: "invalid_json"
      });
      continue;
    }

    if (!hasRequiredIdentity(parsed)) {
      report.skipped.push({
        manifestPath: file.path,
        reason: "missing_required_fields"
      });
      continue;
    }

    const result = onboardProjectManifest(store, parsed);
    report.imported.push({
      projectKey: result.project.key,
      name: result.project.name,
      manifestPath: file.path
    });
  }

  return report;
}

export function buildProjectImportReadiness(
  store: InMemoryProjectOnboardingStore,
  projectKeys: string[]
) {
  return projectKeys.map((projectKey) => {
    const controls = store.projectControls(projectKey);

    return {
      projectKey,
      manifestImported: Boolean(store.project(projectKey)),
      aiKeyConfigured: store.aiKeysForProject(projectKey).length > 0,
      tokenTrackingRequired: controls?.tokenTrackingRequired ?? false,
      feedbackCaptureRequired: controls?.feedbackCaptureRequired ?? false,
      rawMessageStorage: controls?.rawMessageStorage ?? "unknown"
    };
  });
}

function parseManifestFile(file: ManifestFile): FounderOsProjectManifest | "invalid_json" {
  try {
    return JSON.parse(file.content) as FounderOsProjectManifest;
  } catch {
    return "invalid_json";
  }
}

function hasRequiredIdentity(manifest: FounderOsProjectManifest): manifest is FounderOsProjectManifest {
  return Boolean(manifest.project_id && manifest.name && manifest.status && manifest.owner);
}
