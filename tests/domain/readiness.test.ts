import { describe, expect, it } from "vitest";
import {
  buildAuditLogEvent,
  parseFounderOsEnv,
  verifyAdminRequest
} from "@/domain/readiness/readiness";

describe("production readiness helpers", () => {
  it("accepts an admin request when bearer token matches the configured secret", () => {
    expect(
      verifyAdminRequest({
        authorization: "Bearer dev-secret",
        configuredAdminToken: "dev-secret"
      })
    ).toEqual({ allowed: true, reasons: [] });
  });

  it("rejects missing or mismatched admin tokens", () => {
    expect(
      verifyAdminRequest({
        authorization: undefined,
        configuredAdminToken: "dev-secret"
      })
    ).toEqual({ allowed: false, reasons: ["missing_authorization"] });

    expect(
      verifyAdminRequest({
        authorization: "Bearer wrong",
        configuredAdminToken: "dev-secret"
      })
    ).toEqual({ allowed: false, reasons: ["invalid_admin_token"] });
  });

  it("parses required environment values without exposing secrets", () => {
    const env = parseFounderOsEnv({
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/founder_os",
      FOUNDER_OS_ADMIN_EMAIL: "founder@example.com",
      FOUNDER_OS_ADMIN_TOKEN: "dev-secret",
      FOUNDER_OS_ENABLE_DASHBOARD_DEMO: "true"
    });

    expect(env).toEqual({
      databaseConfigured: true,
      adminEmail: "founder@example.com",
      adminTokenConfigured: true,
      dashboardDemoEnabled: true
    });
  });

  it("builds structured audit events for production-sensitive actions", () => {
    expect(
      buildAuditLogEvent({
        action: "deployment.config.changed",
        actor: "founder",
        subjectType: "environment",
        subjectId: "production",
        reason: "rotate admin token"
      })
    ).toMatchObject({
      action: "deployment.config.changed",
      actor: "founder",
      subjectType: "environment",
      subjectId: "production",
      reason: "rotate admin token"
    });
  });
});
