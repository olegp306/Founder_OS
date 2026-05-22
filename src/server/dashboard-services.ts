import type { FounderOsRuntime } from "@/server/founder-os-runtime";
import {
  handleAiExecutionDecisionAuditList,
  handleAiExecutionSummary
} from "@/server/project-ai-api-services";

export type DashboardMetric = {
  label: string;
  value: string;
  detail: string;
};

export type DashboardSignal = {
  action: string;
  risk: string;
  model: string;
  reason: string;
  estimatedTokens: string;
};

export type AiControlDashboardViewModel = {
  projectKey?: string;
  metrics: DashboardMetric[];
  recentSignals: DashboardSignal[];
};

export async function buildAiControlDashboardViewModel(
  runtime: FounderOsRuntime,
  input: { projectKey?: string } = {}
): Promise<AiControlDashboardViewModel> {
  const [{ summary }, { decisions }] = await Promise.all([
    handleAiExecutionSummary(runtime, input),
    handleAiExecutionDecisionAuditList(runtime, {
      projectKey: input.projectKey,
      limit: 5
    })
  ]);
  const total = summary.totalDecisions;
  const downgradeCount = Number(summary.actionCounts.downgrade ?? 0);
  const downgradeRate = total === 0 ? 0 : Math.round((downgradeCount / total) * 100);

  return {
    projectKey: input.projectKey,
    metrics: [
      {
        label: "Execution decisions",
        value: String(total),
        detail: "latest project preflight decisions"
      },
      {
        label: "Tokens under risk",
        value: formatCompactNumber(summary.estimatedTokensUnderRisk),
        detail: "estimated tokens on non-low-risk requests"
      },
      {
        label: "Downgrade rate",
        value: `${downgradeRate}%`,
        detail: "fallback model enforcement"
      },
      {
        label: "Blocked requests",
        value: String(summary.blockedDecisions),
        detail: "requests denied before model execution"
      }
    ],
    recentSignals: decisions.map((decision) => ({
      action: String(decision.action),
      risk: String(decision.riskLevel),
      model: String(decision.model ?? "none"),
      reason: Array.isArray(decision.reasons) && decision.reasons.length > 0
        ? String(decision.reasons[0])
        : "none",
      estimatedTokens: formatCompactNumber(Number(decision.estimatedTokens ?? 0))
    }))
  };
}

function formatCompactNumber(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }

  return String(value);
}
