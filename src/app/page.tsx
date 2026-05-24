import React from "react";
import {
  buildAiControlDashboardViewModel,
  seedAiControlDashboardDemoData
} from "@/server/dashboard-services";
import { getFounderOsRuntime } from "@/server/founder-os-runtime";

const routeContracts = [
  ["/api/projects/ai-setup", "Register key references and token policy in one setup step"],
  ["/api/projects/connection", "Connection Bundle for moving a project into Founder OS"],
  ["/api/ai-execution/decide", "Single preflight for provider, model, budget, abuse action"],
  ["/api/ai-execution/summary", "Project-level allow, downgrade, block, risk, and token overview"],
  ["/api/ai-execution/audit", "Safe decision log without raw prompts or secret refs"],
  ["/api/ai-keys", "Project key references stored as secretRef metadata only"],
  ["/api/token-policy/bulk", "Apply emergency model and budget controls across projects"]
];

const guardrails = [
  "No raw prompts",
  "No secret refs",
  "Fail closed without AI key",
  "Fallback model on downgrade"
];

const dashboardProjectKey = "booking_assistant";
const dashboardAssistantKey = "support_bot";

export default async function HomePage() {
  const runtime = getFounderOsRuntime();

  if (process.env.FOUNDER_OS_ENABLE_DASHBOARD_DEMO === "true") {
    await seedAiControlDashboardDemoData(runtime, { projectKey: dashboardProjectKey });
  }

  const dashboard = await buildAiControlDashboardViewModel(runtime, {
    projectKey: dashboardProjectKey,
    assistantKey: dashboardAssistantKey
  });

  return (
    <main className="shell">
      <section className="dashboard-header" aria-label="Founder OS status">
        <div>
          <p className="eyebrow">Founder OS</p>
          <h1>AI Execution Control</h1>
          <p className="lede">
            Private control plane for project onboarding, AI key references, model routing,
            abuse enforcement, and token-risk monitoring across founder-owned products.
          </p>
        </div>
        <div className="readiness-panel" aria-label="Private MVP readiness">
          <span>Private MVP</span>
          <strong>Operational</strong>
          <p>Routes, audit, summary, and fail-closed controls are wired for connected projects.</p>
        </div>
      </section>

      <section className="metric-grid" aria-label="AI execution metrics">
        {dashboard.metrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <p>{metric.detail}</p>
          </article>
        ))}
      </section>

      <section className="work-surface" aria-label="AI execution control surface">
        <div className="surface-column">
          <div className="section-heading">
            <h2>Control Routes</h2>
            <span>Connected products call these before high-cost AI work.</span>
          </div>
          <div className="route-list">
            {routeContracts.map(([route, description]) => (
              <div className="route-row" key={route}>
                <code>{route}</code>
                <span>{description}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-column">
          <div className="section-heading">
            <h2>Guardrails</h2>
            <span>Internal guarantees for token and abuse control.</span>
          </div>
          <div className="guardrail-list">
            {guardrails.map((guardrail) => (
              <div className="guardrail" key={guardrail}>
                <span aria-hidden="true" />
                <strong>{guardrail}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="readiness-table" aria-label="Project transfer readiness">
        <div className="section-heading">
          <h2>Project Transfer Readiness</h2>
          <span>{dashboard.projectReadiness.readyCount}/{dashboard.projectReadiness.totalCount}</span>
        </div>
        <div className="readiness-grid">
          {dashboard.projectReadiness.items.map((item) => (
            <div className="readiness-row" data-ready={item.ready} key={item.label}>
              <strong>{item.ready ? "ready" : "missing"}</strong>
              <span>{item.label}</span>
              <code>{item.detail ?? dashboard.projectReadiness.projectKey}</code>
            </div>
          ))}
        </div>
      </section>

      <section className="projects-table" aria-label="Connected projects">
        <div className="section-heading">
          <h2>Connected Projects</h2>
          <span>{dashboard.connectedProjects.length}</span>
        </div>
        <div className="projects-grid">
          {dashboard.connectedProjects.map((project) => (
            <div className="project-row" data-ready={project.ready} key={project.projectKey}>
              <strong>{project.ready ? "ready" : "setup"}</strong>
              <span>{project.name}</span>
              <code>{project.projectKey}</code>
              <span>{project.readiness}</span>
            </div>
          ))}
          {dashboard.connectedProjects.length === 0 ? (
            <div className="project-row empty-row" data-ready="false">
              <strong>none</strong>
              <span>No imported projects yet</span>
              <code>projects:transfer</code>
              <span>0/6</span>
            </div>
          ) : null}
        </div>
      </section>

      <section className="transfer-flow" aria-label="Project transfer flow">
        <div className="section-heading">
          <h2>Transfer Flow</h2>
          <span>{dashboard.transferFlow.ready ? "ready" : "needs setup"}</span>
        </div>
        <div className="transfer-command">
          <span>Local command</span>
          <code>{dashboard.transferFlow.command}</code>
        </div>
        <div className="transfer-grid">
          <div className="transfer-list">
            <h3>Required Environment</h3>
            {dashboard.transferFlow.requiredEnvironment.map((name) => (
              <code key={name}>{name}</code>
            ))}
          </div>
          <div className="transfer-list">
            <h3>Routes</h3>
            {dashboard.transferFlow.routes.map((route) => (
              <code key={route}>{route}</code>
            ))}
          </div>
          <div className="transfer-list">
            <h3>Next Steps</h3>
            {dashboard.transferFlow.nextSteps.length === 0 ? (
              <strong>Ready to connect</strong>
            ) : (
              dashboard.transferFlow.nextSteps.map((step) => <span key={step}>{step}</span>)
            )}
          </div>
        </div>
      </section>

      <section className="spend-table" aria-label="Token spend">
        <div className="section-heading">
          <h2>Token Spend</h2>
          <span>{dashboard.tokenSpend.windowHours}h window</span>
        </div>
        <div className="spend-summary">
          <article className="spend-card">
            <span>Total cost</span>
            <strong>{dashboard.tokenSpend.totalCost}</strong>
          </article>
          <article className="spend-card">
            <span>Total tokens</span>
            <strong>{dashboard.tokenSpend.totalTokens}</strong>
          </article>
          <article className="spend-card">
            <span>Projected daily</span>
            <strong>{dashboard.tokenSpend.projectedDailySpend}</strong>
          </article>
        </div>
        <div className="spend-breakdowns">
          <div className="spend-list">
            <h3>Top Models</h3>
            {dashboard.tokenSpend.topModels.map((model) => (
              <div className="spend-row" key={model.key}>
                <code>{model.key}</code>
                <span>{model.totalTokens}</span>
                <strong>{model.totalCost}</strong>
              </div>
            ))}
            {dashboard.tokenSpend.topModels.length === 0 ? (
              <div className="spend-row">
                <code>none</code>
                <span>0</span>
                <strong>$0.00</strong>
              </div>
            ) : null}
          </div>
          <div className="spend-list">
            <h3>Environments</h3>
            {dashboard.tokenSpend.topEnvironments.map((environment) => (
              <div className="spend-row" key={environment.key}>
                <code>{environment.key}</code>
                <span>{environment.totalTokens}</span>
                <strong>{environment.totalCost}</strong>
              </div>
            ))}
            {dashboard.tokenSpend.topEnvironments.length === 0 ? (
              <div className="spend-row">
                <code>none</code>
                <span>0</span>
                <strong>$0.00</strong>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="key-inventory" aria-label="AI key inventory">
        <div className="section-heading">
          <h2>AI Key Inventory</h2>
          <span>{dashboard.aiKeyInventory.totalMonthlyBudget}</span>
        </div>
        <div className="spend-summary">
          <article className="spend-card">
            <span>Key references</span>
            <strong>{dashboard.aiKeyInventory.totalReferences}</strong>
          </article>
          <article className="spend-card">
            <span>Provider budgets</span>
            <strong>{dashboard.aiKeyInventory.providers.length}</strong>
          </article>
          <article className="spend-card">
            <span>Monthly budget</span>
            <strong>{dashboard.aiKeyInventory.totalMonthlyBudget}</strong>
          </article>
        </div>
        <div className="spend-breakdowns">
          <div className="spend-list">
            <h3>Providers</h3>
            {dashboard.aiKeyInventory.providers.map((provider) => (
              <div className="spend-row" key={provider.provider}>
                <code>{provider.provider}</code>
                <span>{provider.referenceCount}</span>
                <strong>{provider.monthlyBudget}</strong>
              </div>
            ))}
            {dashboard.aiKeyInventory.providers.length === 0 ? (
              <div className="spend-row">
                <code>none</code>
                <span>0</span>
                <strong>$0.00</strong>
              </div>
            ) : null}
          </div>
          <div className="spend-list">
            <h3>Projects</h3>
            {dashboard.aiKeyInventory.projects.map((project) => (
              <div className="spend-row" key={project.projectKey}>
                <code>{project.projectKey}</code>
                <span>{project.providers.join(", ") || "none"}</span>
                <strong>{project.monthlyBudget}</strong>
              </div>
            ))}
            {dashboard.aiKeyInventory.projects.length === 0 ? (
              <div className="spend-row">
                <code>none</code>
                <span>No key references</span>
                <strong>$0.00</strong>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="operator-grid" aria-label="Operator controls">
        <div className="operator-panel" aria-label="AI key lifecycle">
          <div className="section-heading">
            <h2>Key Lifecycle</h2>
            <span>{dashboard.keyLifecycle.totalReferences} references</span>
          </div>
          <div className="spend-summary">
            <article className="spend-card">
              <span>Production keys</span>
              <strong>{dashboard.keyLifecycle.productionReferences}</strong>
            </article>
            <article className="spend-card">
              <span>Rotation due</span>
              <strong>{dashboard.keyLifecycle.rotationDueSoon}</strong>
            </article>
            <article className="spend-card">
              <span>Overdue</span>
              <strong>{dashboard.keyLifecycle.rotationOverdue}</strong>
            </article>
          </div>
          <div className="spend-list operator-list">
            <h3>Providers</h3>
            {dashboard.keyLifecycle.providerHealth.map((provider) => (
              <div className="spend-row" key={provider.provider}>
                <code>{provider.provider}</code>
                <span>{provider.productionReferences}/{provider.references}</span>
                <strong>{provider.rotationOverdue} overdue</strong>
              </div>
            ))}
            {dashboard.keyLifecycle.providerHealth.length === 0 ? (
              <div className="spend-row">
                <code>none</code>
                <span>0/0</span>
                <strong>0 overdue</strong>
              </div>
            ) : null}
          </div>
        </div>

        <div className="operator-panel" aria-label="Production launch gate">
          <div className="section-heading">
            <h2>Launch Gate</h2>
            <span>{dashboard.launchGate.readyCount}/{dashboard.launchGate.totalCount}</span>
          </div>
          <div className="readiness-grid operator-readiness">
            {dashboard.launchGate.items.map((item) => (
              <div className="readiness-row" data-ready={item.ready} key={item.label}>
                <strong>{item.ready ? "ready" : "blocked"}</strong>
                <span>{item.label}</span>
                <code>{item.detail ?? "unknown"}</code>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="transfer-flow" aria-label="Bulk token policy">
        <div className="section-heading">
          <h2>Bulk Token Policy</h2>
          <span>{dashboard.bulkTokenPolicy.targetCount} targets</span>
        </div>
        <div className="transfer-command">
          <span>Incident command</span>
          <code>{dashboard.bulkTokenPolicy.command}</code>
        </div>
        <div className="transfer-grid">
          <div className="transfer-list">
            <h3>Targets</h3>
            {dashboard.bulkTokenPolicy.targets.map((target) => (
              <code key={`${target.projectKey}-${target.assistantKey}`}>
                {target.projectKey}/{target.assistantKey}
              </code>
            ))}
            {dashboard.bulkTokenPolicy.targets.length === 0 ? (
              <strong>No imported projects</strong>
            ) : null}
          </div>
          <div className="transfer-list">
            <h3>Emergency mode</h3>
            <code>{dashboard.bulkTokenPolicy.emergencyTemplate.preferredModel}</code>
            <code>{dashboard.bulkTokenPolicy.emergencyTemplate.fallbackModel}</code>
            <span>{dashboard.bulkTokenPolicy.emergencyTemplate.reason}</span>
          </div>
          <div className="transfer-list">
            <h3>Budget Ceiling</h3>
            <span>Daily ${dashboard.bulkTokenPolicy.emergencyTemplate.dailyBudgetUsd}</span>
            <span>Monthly ${dashboard.bulkTokenPolicy.emergencyTemplate.monthlyBudgetUsd}</span>
            <span>{dashboard.bulkTokenPolicy.emergencyTemplate.maxTokensPerRequest} tokens/request</span>
          </div>
        </div>
      </section>

      <section className="signal-table" aria-label="Recent AI execution signals">
        <div className="section-heading">
          <h2>Recent Signals</h2>
          <span>Safe projection of execution decisions.</span>
        </div>
        <div className="table-grid" role="table">
          <div className="table-row table-head" role="row">
            <span>Action</span>
            <span>Risk</span>
            <span>Model</span>
            <span>Reason</span>
            <span>Est. tokens</span>
          </div>
          {dashboard.recentSignals.map((signal) => (
            <div className="table-row" role="row" key={`${signal.action}-${signal.reason}-${signal.estimatedTokens}`}>
              <strong>{signal.action}</strong>
              <span>{signal.risk}</span>
              <code>{signal.model}</code>
              <span>{signal.reason}</span>
              <span>{signal.estimatedTokens}</span>
            </div>
          ))}
          {dashboard.recentSignals.length === 0 ? (
            <div className="table-row empty-row" role="row">
              <strong>none</strong>
              <span>none</span>
              <code>none</code>
              <span>No execution decisions recorded for {dashboardProjectKey}</span>
              <span>0</span>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
