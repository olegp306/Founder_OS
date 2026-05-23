import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsRoot = join(process.cwd(), "prisma", "migrations");

describe("Prisma migrations", () => {
  it("includes a deployable core schema migration", () => {
    expect(existsSync(migrationsRoot)).toBe(true);

    const migrationSql = readdirSync(migrationsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(migrationsRoot, entry.name, "migration.sql"))
      .filter((path) => existsSync(path))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    expect(migrationSql).toContain('CREATE TABLE "Project"');
    expect(migrationSql).toContain('CREATE TABLE "ProjectControl"');
    expect(migrationSql).toContain('CREATE TABLE "AiKeyReference"');
    expect(migrationSql).toContain('CREATE TABLE "TokenUsageEvent"');
    expect(migrationSql).toContain('CREATE UNIQUE INDEX "AiKeyReference_projectId_secretRef_key"');
    expect(migrationSql).toContain('ALTER TABLE "AiKeyReference" ADD CONSTRAINT');
  });

  it("exposes a deploy migration script", () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["prisma:migrate:deploy"]).toBe("prisma migrate deploy");
  });
});
