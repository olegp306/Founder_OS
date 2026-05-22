import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildBulkProjectImportPayload,
  discoverProjectManifestFiles
} from "@/local/project-manifest-scanner";

const tempRoots: string[] = [];

describe("project manifest scanner", () => {
  afterEach(async () => {
    await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
    tempRoots.length = 0;
  });

  it("discovers Founder OS project manifests under a local repositories root", async () => {
    const root = await createTempRoot();
    await writeManifest(root, "alpha", {
      project_id: "alpha",
      name: "Alpha",
      status: "active",
      owner: "olegp306"
    });
    await writeManifest(root, "nested\\beta", {
      project_id: "beta",
      name: "Beta",
      status: "active",
      owner: "olegp306"
    });
    await writeFile(join(root, "README.md"), "# not a manifest");

    const files = await discoverProjectManifestFiles(root);

    expect(files).toEqual([
      {
        path: join(root, "alpha", ".founderos", "project.json"),
        content: JSON.stringify({
          project_id: "alpha",
          name: "Alpha",
          status: "active",
          owner: "olegp306"
        })
      },
      {
        path: join(root, "nested", "beta", ".founderos", "project.json"),
        content: JSON.stringify({
          project_id: "beta",
          name: "Beta",
          status: "active",
          owner: "olegp306"
        })
      }
    ]);
  });

  it("skips heavy generated directories while scanning", async () => {
    const root = await createTempRoot();
    await writeManifest(root, "real-project", {
      project_id: "real_project",
      name: "Real Project",
      status: "active",
      owner: "olegp306"
    });
    await writeManifest(root, "node_modules\\dependency", {
      project_id: "dependency",
      name: "Dependency",
      status: "active",
      owner: "someone_else"
    });
    await writeManifest(root, ".git\\worktree", {
      project_id: "git_internal",
      name: "Git Internal",
      status: "active",
      owner: "git"
    });

    const files = await discoverProjectManifestFiles(root);

    expect(files.map((file) => file.path)).toEqual([
      join(root, "real-project", ".founderos", "project.json")
    ]);
  });

  it("builds the API payload expected by the bulk import route", async () => {
    const root = await createTempRoot();
    await writeManifest(root, "alpha", {
      project_id: "alpha",
      name: "Alpha",
      status: "active",
      owner: "olegp306"
    });

    const payload = buildBulkProjectImportPayload(await discoverProjectManifestFiles(root));

    expect(payload).toEqual({
      manifests: [
        {
          path: join(root, "alpha", ".founderos", "project.json"),
          content: JSON.stringify({
            project_id: "alpha",
            name: "Alpha",
            status: "active",
            owner: "olegp306"
          })
        }
      ]
    });
  });

  it("strips a UTF-8 BOM before sending manifest content to the API", async () => {
    const root = await createTempRoot();
    const manifestDir = join(root, "bom-project", ".founderos");
    await mkdir(manifestDir, { recursive: true });
    await writeFile(
      join(manifestDir, "project.json"),
      `\uFEFF${JSON.stringify({
        project_id: "bom_project",
        name: "BOM Project",
        status: "active",
        owner: "olegp306"
      })}`
    );

    const files = await discoverProjectManifestFiles(root);

    expect(files).toEqual([
      {
        path: join(root, "bom-project", ".founderos", "project.json"),
        content: JSON.stringify({
          project_id: "bom_project",
          name: "BOM Project",
          status: "active",
          owner: "olegp306"
        })
      }
    ]);
  });
});

async function createTempRoot() {
  const root = await mkdtemp(join(tmpdir(), "founder-os-scan-"));
  tempRoots.push(root);
  return root;
}

async function writeManifest(root: string, projectPath: string, manifest: unknown) {
  const manifestDir = join(root, ...projectPath.split("\\"), ".founderos");
  await mkdir(manifestDir, { recursive: true });
  await writeFile(join(manifestDir, "project.json"), JSON.stringify(manifest));
}
