const progressItems = [
  { label: "Architecture and master plan", value: "Complete" },
  { label: "Production readiness", value: "Guarded" },
  { label: "MVP progress", value: "80%" },
  { label: "Branch/PR gate", value: "Reached" }
];

const capabilityRows = [
  ["Registry", "Project and repository domain foundation"],
  ["Events", "Structured ingestion with raw-message rejection"],
  ["Tokens", "Usage intake, central policies, burn-rate alerts"],
  ["Profiles", "Identity merge, consent, feedback, segments, audit"],
  ["Campaigns", "Eligibility checks, preview, Telegram dry-run"],
  ["Readiness", "Admin bearer guard, health check, deploy and backup docs"]
];

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Founder OS</p>
        <h1>Control plane for products, users, tokens, feedback, and campaigns.</h1>
        <p className="lede">
          The current slice adds admin API protection, environment health checks, deployment guidance, backups, and the 80% versioning gate.
        </p>
      </section>

      <section className="status-grid" aria-label="Founder OS implementation status">
        {progressItems.map((item) => (
          <article className="status-card" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <section className="capabilities" aria-label="Implemented capability areas">
        {capabilityRows.map(([name, description]) => (
          <div className="capability-row" key={name}>
            <strong>{name}</strong>
            <span>{description}</span>
          </div>
        ))}
      </section>
    </main>
  );
}
