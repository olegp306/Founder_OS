import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ManifestFile } from "@/domain/projects/project-bulk-import";

const ignoredDirectoryNames = new Set([
  ".git",
  ".next",
  ".turbo",
  ".vercel",
  "coverage",
  "dist",
  "node_modules"
]);

export type BulkProjectImportPayload = {
  manifests: ManifestFile[];
};

export async function discoverProjectManifestFiles(rootPath: string): Promise<ManifestFile[]> {
  const files: ManifestFile[] = [];

  await scanDirectory(rootPath, files);

  return files.sort((left, right) => left.path.localeCompare(right.path));
}

export function buildBulkProjectImportPayload(files: ManifestFile[]): BulkProjectImportPayload {
  return { manifests: files };
}

async function scanDirectory(directoryPath: string, files: ManifestFile[]) {
  const entries = await readdir(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || ignoredDirectoryNames.has(entry.name)) {
      continue;
    }

    const childPath = join(directoryPath, entry.name);

    if (entry.name === ".founderos") {
      await addProjectManifestIfPresent(childPath, files);
      continue;
    }

    await scanDirectory(childPath, files);
  }
}

async function addProjectManifestIfPresent(founderOsDirectoryPath: string, files: ManifestFile[]) {
  const manifestPath = join(founderOsDirectoryPath, "project.json");

  try {
    files.push({
      path: manifestPath,
      content: stripUtf8Bom(await readFile(manifestPath, "utf8"))
    });
  } catch (error) {
    if (isMissingFileError(error)) {
      return;
    }
    throw error;
  }
}

function stripUtf8Bom(content: string): string {
  return content.startsWith("\uFEFF") ? content.slice(1) : content;
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT"
  );
}
