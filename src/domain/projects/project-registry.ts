export type ProjectRuntime = "nextjs" | "node" | "telegram-bot" | "external";

export type RegisteredProject = {
  key: string;
  name: string;
  owner: "founder";
  runtime: ProjectRuntime;
  status: "active";
  repository: {
    url: string;
    provider: "github" | "other";
    defaultBranch: "main";
  };
  environments: Array<{
    kind: "production";
    url: string;
    isolation: "founder-shared";
  }>;
};

export type RegisterProjectInput = {
  key: string;
  name: string;
  repositoryUrl: string;
  productionUrl: string;
  owner: "founder";
  runtime: ProjectRuntime;
};

export function registerProject(input: RegisterProjectInput): RegisteredProject {
  return {
    key: input.key,
    name: input.name,
    owner: input.owner,
    runtime: input.runtime,
    status: "active",
    repository: {
      url: input.repositoryUrl,
      provider: detectRepositoryProvider(input.repositoryUrl),
      defaultBranch: "main"
    },
    environments: [
      {
        kind: "production",
        url: input.productionUrl,
        isolation: "founder-shared"
      }
    ]
  };
}

function detectRepositoryProvider(repositoryUrl: string): "github" | "other" {
  return repositoryUrl.includes("github.com") ? "github" : "other";
}
