import { NextResponse } from "next/server";
import { parseFounderOsEnv } from "@/domain/readiness/readiness";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";

export async function GET() {
  const runtime = getFounderOsRuntime();

  return NextResponse.json({
    status: "ok",
    persistenceMode: runtime.persistenceMode,
    repositoryKind: runtime.repositories.kind,
    repositoryBackedRoutes: [
      "/api/events",
      "/api/token-policy",
      "/api/token-policy/bulk",
      "/api/token-usage",
      "/api/token-usage/summary"
    ],
    serviceBackedRoutes: [
      "/api/consents",
      "/api/feedback",
      "/api/segments/evaluate",
      "/api/campaigns/workflow",
      "/api/campaigns/preview",
      "/api/campaigns/telegram-dry-run",
      "/api/campaigns/telegram-live-send/approve",
      "/api/campaigns/telegram-delivery/handoff",
      "/api/campaigns/telegram-delivery/receipt",
      "/api/projects/onboard",
      "/api/projects/bulk-import",
      "/api/projects",
      "/api/projects/ai-setup",
      "/api/projects/connection",
      "/api/ai-keys",
      "/api/provider-spend/import",
      "/api/ai-control/resolve",
      "/api/ai-usage/assess",
      "/api/ai-execution/decide",
      "/api/ai-execution/audit",
      "/api/ai-execution/summary",
      "/api/alerts"
    ],
    privateMvpReadiness: {
      projectOnboarding: true,
      bulkProjectImport: true,
      aiKeyReferences: true,
      aiKeyInventory: true,
      aiControlResolution: true,
      bulkTokenPolicy: true,
      aiUsageAbuseProtection: true,
      aiExecutionDecision: true,
      aiExecutionAudit: true,
      aiExecutionSummary: true,
      projectList: true,
      projectAiSetup: true,
      projectConnectionBundle: true,
      providerSpendImport: true,
      alertEvidence: true,
      campaignWorkflowState: true,
      campaignLiveSendApproval: true,
      campaignDeliveryHandoff: true,
      campaignDeliveryReceipt: true,
      plaintextSecretsStored: false
    },
    environment: parseFounderOsEnv({
      DATABASE_URL: process.env.DATABASE_URL,
      FOUNDER_OS_ADMIN_EMAIL: process.env.FOUNDER_OS_ADMIN_EMAIL,
      FOUNDER_OS_ADMIN_TOKEN: process.env.FOUNDER_OS_ADMIN_TOKEN,
      FOUNDER_OS_ENABLE_DASHBOARD_DEMO: process.env.FOUNDER_OS_ENABLE_DASHBOARD_DEMO
    })
  });
}
