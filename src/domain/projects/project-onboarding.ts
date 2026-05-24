export type FounderOsProjectManifest = {
  project_id: string;
  name: string;
  status: string;
  category?: string;
  owner: string;
  workspace?: string;
  repository?: {
    provider: string;
    name: string;
    local_path?: string;
  };
  assistant?: {
    enabled?: boolean;
    token_tracking_required?: boolean;
    feedback_capture_required?: boolean;
  };
  user_data?: {
    raw_message_storage?: string;
    consent_required_for_marketing?: boolean;
  };
};

export type OnboardedProject = {
  key: string;
  name: string;
  status: string;
  owner: string;
  category?: string;
  workspace?: string;
};

export type OnboardedRepository = {
  projectKey: string;
  provider: string;
  name: string;
  localPath?: string;
};

export type ProjectControls = {
  projectKey: string;
  assistantEnabled: boolean;
  tokenTrackingRequired: boolean;
  feedbackCaptureRequired: boolean;
  rawMessageStorage: string;
  consentRequiredForMarketing: boolean;
};

export type AiKeyReference = {
  projectKey: string;
  provider: "openai" | "anthropic" | "google" | "other";
  secretRef: string;
  displayName: string;
  allowedModels: string[];
  defaultModel: string;
  monthlyBudgetUsd: number;
  environment?: "local" | "staging" | "production";
  rotationDueAt?: string;
  lastVerifiedAt?: string;
  status: "active";
};

export class InMemoryProjectOnboardingStore {
  private readonly projects = new Map<string, OnboardedProject>();
  private readonly repositories = new Map<string, OnboardedRepository>();
  private readonly controls = new Map<string, ProjectControls>();
  private readonly aiKeys = new Map<string, AiKeyReference[]>();

  saveProject(input: {
    project: OnboardedProject;
    repository?: OnboardedRepository;
    controls: ProjectControls;
  }) {
    this.projects.set(input.project.key, input.project);
    if (input.repository) {
      this.repositories.set(input.project.key, input.repository);
    }
    this.controls.set(input.project.key, input.controls);
    return input;
  }

  saveAiKey(key: AiKeyReference): AiKeyReference {
    const existing = this.aiKeys.get(key.projectKey) ?? [];
    this.aiKeys.set(key.projectKey, [
      ...existing.filter((item) => item.secretRef !== key.secretRef),
      key
    ]);
    return key;
  }

  aiKeysForProject(projectKey: string): AiKeyReference[] {
    return this.aiKeys.get(projectKey) ?? [];
  }

  allProjects(): OnboardedProject[] {
    return [...this.projects.values()].sort((left, right) => left.key.localeCompare(right.key));
  }

  project(projectKey: string): OnboardedProject | undefined {
    return this.projects.get(projectKey);
  }

  repository(projectKey: string): OnboardedRepository | undefined {
    return this.repositories.get(projectKey);
  }

  projectControls(projectKey: string): ProjectControls | undefined {
    return this.controls.get(projectKey);
  }
}

export function onboardProjectManifest(
  store: InMemoryProjectOnboardingStore,
  manifest: FounderOsProjectManifest
) {
  return store.saveProject(buildProjectOnboardingRecord(manifest));
}

export function buildProjectOnboardingRecord(manifest: FounderOsProjectManifest): {
  project: OnboardedProject;
  repository?: OnboardedRepository;
  controls: ProjectControls;
} {
  const project: OnboardedProject = {
    key: manifest.project_id,
    name: manifest.name,
    status: manifest.status,
    owner: manifest.owner,
    category: manifest.category,
    workspace: manifest.workspace
  };
  const repository = manifest.repository
    ? {
        projectKey: manifest.project_id,
        provider: manifest.repository.provider,
        name: manifest.repository.name,
        localPath: manifest.repository.local_path
      }
    : undefined;
  const controls: ProjectControls = {
    projectKey: manifest.project_id,
    assistantEnabled: manifest.assistant?.enabled ?? false,
    tokenTrackingRequired: manifest.assistant?.token_tracking_required ?? false,
    feedbackCaptureRequired: manifest.assistant?.feedback_capture_required ?? false,
    rawMessageStorage: manifest.user_data?.raw_message_storage ?? "disabled_by_default",
    consentRequiredForMarketing: manifest.user_data?.consent_required_for_marketing ?? true
  };

  return { project, repository, controls };
}

export function registerAiKeyReference(
  store: InMemoryProjectOnboardingStore,
  input: Omit<AiKeyReference, "status"> & { plaintextSecret?: string }
): AiKeyReference {
  return store.saveAiKey(buildAiKeyReference(input));
}

export function buildAiKeyReference(
  input: Omit<AiKeyReference, "status"> & { plaintextSecret?: string }
): AiKeyReference {
  return {
    projectKey: input.projectKey,
    provider: input.provider,
    secretRef: input.secretRef,
    displayName: input.displayName,
    allowedModels: input.allowedModels,
    defaultModel: input.defaultModel,
    monthlyBudgetUsd: input.monthlyBudgetUsd,
    environment: input.environment ?? "production",
    rotationDueAt: input.rotationDueAt,
    lastVerifiedAt: input.lastVerifiedAt,
    status: "active" as const
  };
}

export function resolveProjectAiControl(
  store: InMemoryProjectOnboardingStore,
  input: {
    projectKey: string;
    requestedModel?: string;
  }
) {
  const key = store.aiKeysForProject(input.projectKey).find((item) => item.status === "active");

  if (!key) {
    return {
      allowed: false,
      provider: undefined,
      model: undefined,
      secretRef: undefined,
      monthlyBudgetUsd: undefined,
      reasons: ["ai_key_not_configured"]
    };
  }

  const requestedAllowed = input.requestedModel
    ? key.allowedModels.includes(input.requestedModel)
    : true;

  return {
    allowed: true,
    provider: key.provider,
    model: requestedAllowed ? input.requestedModel ?? key.defaultModel : key.defaultModel,
    secretRef: key.secretRef,
    monthlyBudgetUsd: key.monthlyBudgetUsd,
    reasons: requestedAllowed ? [] : ["requested_model_not_allowed"]
  };
}
