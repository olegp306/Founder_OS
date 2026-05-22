import React from "react";

const controlMetrics = [
  { label: "Execution decisions", value: "68", detail: "latest verified test surface" },
  { label: "Tokens under risk", value: "4.5k", detail: "estimated from guarded requests" },
  { label: "Downgrade rate", value: "33%", detail: "fallback model enforcement" },
  { label: "Blocked requests", value: "1", detail: "prompt extraction prevented" }
];

const routeContracts = [
  ["/api/ai-execution/decide", "Single preflight for provider, model, budget, abuse action"],
  ["/api/ai-execution/summary", "Project-level allow, downgrade, block, risk, and token overview"],
  ["/api/ai-execution/audit", "Safe decision log without raw prompts or secret refs"],
  ["/api/ai-keys", "Project key references stored as secretRef metadata only"]
];

const guardrails = [
  "No raw prompts",
  "No secret refs",
  "Fail closed without AI key",
  "Fallback model on downgrade"
];

const recentSignals = [
  ["allow", "low", "gpt-5.4", "booking support", "1.2k"],
  ["downgrade", "medium", "gpt-5.4-mini", "outside product scope", "3.0k"],
  ["block", "high", "none", "system extraction attempt", "1.5k"]
];

export default function HomePage() {
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
        {controlMetrics.map((metric) => (
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
          {recentSignals.map(([action, risk, model, reason, tokens]) => (
            <div className="table-row" role="row" key={`${action}-${reason}`}>
              <strong>{action}</strong>
              <span>{risk}</span>
              <code>{model}</code>
              <span>{reason}</span>
              <span>{tokens}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
