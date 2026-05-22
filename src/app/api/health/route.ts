import { NextResponse } from "next/server";
import { parseFounderOsEnv } from "@/domain/readiness/readiness";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";

export async function GET() {
  const runtime = getFounderOsRuntime();

  return NextResponse.json({
    status: "ok",
    persistenceMode: runtime.persistenceMode,
    repositoryKind: runtime.repositories.kind,
    repositoryBackedRoutes: ["/api/events", "/api/token-policy", "/api/token-usage"],
    serviceBackedRoutes: [
      "/api/consents",
      "/api/feedback",
      "/api/segments/evaluate",
      "/api/campaigns/preview",
      "/api/campaigns/telegram-dry-run",
      "/api/projects/onboard",
      "/api/projects/bulk-import",
      "/api/ai-keys",
      "/api/ai-control/resolve",
      "/api/ai-usage/assess",
      "/api/ai-execution/decide"
    ],
    privateMvpReadiness: {
      projectOnboarding: true,
      bulkProjectImport: true,
      aiKeyReferences: true,
      aiControlResolution: true,
      aiUsageAbuseProtection: true,
      aiExecutionDecision: true,
      plaintextSecretsStored: false
    },
    environment: parseFounderOsEnv({
      DATABASE_URL: process.env.DATABASE_URL,
      FOUNDER_OS_ADMIN_EMAIL: process.env.FOUNDER_OS_ADMIN_EMAIL,
      FOUNDER_OS_ADMIN_TOKEN: process.env.FOUNDER_OS_ADMIN_TOKEN
    })
  });
}
