export type AdminVerification = {
  allowed: boolean;
  reasons: string[];
};

export type FounderOsEnvSummary = {
  databaseConfigured: boolean;
  adminEmail: string;
  adminTokenConfigured: boolean;
  dashboardDemoEnabled: boolean;
};

export type AuditLogEventInput = {
  action: string;
  actor: string;
  subjectType: string;
  subjectId: string;
  reason?: string;
};

export type AuditLogEvent = AuditLogEventInput & {
  createdAt: string;
};

export function verifyAdminRequest(input: {
  authorization?: string;
  configuredAdminToken?: string;
}): AdminVerification {
  if (!input.configuredAdminToken) {
    return {
      allowed: false,
      reasons: ["admin_token_not_configured"]
    };
  }

  if (!input.authorization) {
    return {
      allowed: false,
      reasons: ["missing_authorization"]
    };
  }

  const expected = `Bearer ${input.configuredAdminToken}`;

  if (input.authorization !== expected) {
    return {
      allowed: false,
      reasons: ["invalid_admin_token"]
    };
  }

  return { allowed: true, reasons: [] };
}

export function parseFounderOsEnv(env: Record<string, string | undefined>): FounderOsEnvSummary {
  return {
    databaseConfigured: Boolean(env.DATABASE_URL),
    adminEmail: env.FOUNDER_OS_ADMIN_EMAIL ?? "",
    adminTokenConfigured: Boolean(env.FOUNDER_OS_ADMIN_TOKEN),
    dashboardDemoEnabled: env.FOUNDER_OS_ENABLE_DASHBOARD_DEMO === "true"
  };
}

export function buildAuditLogEvent(input: AuditLogEventInput): AuditLogEvent {
  return {
    ...input,
    createdAt: new Date().toISOString()
  };
}
