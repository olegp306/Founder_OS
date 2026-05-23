import { describe, expect, it } from "vitest";
import {
  parseProjectImportCliArgs,
  runProjectImportCli
} from "@/local/project-import-cli";

describe("project import CLI", () => {
  it("parses root, endpoint, token, and dry-run options", () => {
    expect(
      parseProjectImportCliArgs([
        "--root",
        "C:\\Repos",
        "--endpoint",
        "http://localhost:3000/api/projects/bulk-import",
        "--token",
        "admin-token",
        "--dry-run"
      ])
    ).toEqual({
      rootPath: "C:\\Repos",
      endpoint: "http://localhost:3000/api/projects/bulk-import",
      token: "admin-token",
      dryRun: true
    });
  });

  it("uses safe defaults for local scanning", () => {
    expect(parseProjectImportCliArgs([])).toEqual({
      rootPath: "C:\\Repos",
      endpoint: "http://localhost:3000/api/projects/bulk-import",
      token: undefined,
      dryRun: false
    });
  });

  it("does not post manifests during a dry run", async () => {
    const result = await runProjectImportCli({
      options: {
        rootPath: "C:\\Repos",
        endpoint: "http://localhost:3000/api/projects/bulk-import",
        dryRun: true
      },
      discover: async () => [
        {
          path: "C:\\Repos\\alpha\\.founderos\\project.json",
          content: "{\"project_id\":\"alpha\"}"
        }
      ],
      post: async () => {
        throw new Error("dry-run should not call post");
      }
    });

    expect(result).toEqual({
      mode: "dry-run",
      manifestCount: 1,
      payload: {
        manifests: [
          {
            path: "C:\\Repos\\alpha\\.founderos\\project.json",
            content: "{\"project_id\":\"alpha\"}"
          }
        ]
      }
    });
  });

  it("posts discovered manifests with an authorization header when a token is configured", async () => {
    const calls: unknown[] = [];

    const result = await runProjectImportCli({
      options: {
        rootPath: "C:\\Repos",
        endpoint: "http://localhost:3000/api/projects/bulk-import",
        token: "admin-token",
        dryRun: false
      },
      discover: async () => [
        {
          path: "C:\\Repos\\alpha\\.founderos\\project.json",
          content: "{\"project_id\":\"alpha\"}"
        }
      ],
      post: async (endpoint, payload, headers) => {
        calls.push({ endpoint, payload, headers });
        return { status: "imported", report: { imported: [] } };
      }
    });

    expect(calls).toEqual([
      {
        endpoint: "http://localhost:3000/api/projects/bulk-import",
        payload: {
          manifests: [
            {
              path: "C:\\Repos\\alpha\\.founderos\\project.json",
              content: "{\"project_id\":\"alpha\"}"
            }
          ]
        },
        headers: {
          Authorization: "Bearer admin-token",
          "Content-Type": "application/json"
        }
      }
    ]);
    expect(result).toEqual({
      mode: "imported",
      manifestCount: 1,
      response: { status: "imported", report: { imported: [] } }
    });
  });
});
