# Founder OS Deployment

Founder OS is intended to deploy as a private internal control plane.

## Required Accounts

- GitHub repository access for `olegp306/Founder_OS`.
- Vercel project for the Next.js app.
- Supabase or Neon Postgres database.
- Cloudflare DNS and Cloudflare Access or Tailscale for dashboard protection.
- Sentry project for error reporting once production traffic begins.

## Required Environment Variables

- `DATABASE_URL`: Postgres connection string.
- `FOUNDER_OS_ADMIN_EMAIL`: owner email for internal display and audit context.
- `FOUNDER_OS_ADMIN_TOKEN`: long random bearer token for protected API access.
- `FOUNDER_OS_AI_SETUP_ENDPOINT`: optional local helper override for `/api/projects/ai-setup`.
- `FOUNDER_OS_PROJECT_AI_SETUP_CONFIG`: optional local helper path to a project AI setup JSON file.
- `FOUNDER_OS_FORCE_MEMORY`: optional local/testing override. Set to `true` to keep runtime stores in memory even when `DATABASE_URL` is present.
- `FOUNDER_OS_ENABLE_DASHBOARD_DEMO`: optional local dashboard preview seed. Set to `true` only for local smoke tests or demos; do not enable in production.

Do not commit real environment values. Store production values in the hosting provider secret store.

## Deployment Steps

1. Create the Postgres database.
2. Add environment variables in Vercel.
3. Run `npm run prisma:migrate:deploy` from the deployment pipeline.
4. Deploy the Next.js app.
5. Put the dashboard behind Cloudflare Access or Tailscale before connecting real product integrations.
6. Run `npm run deployment:check -- --production --base-url https://<founder-os-host> --token <FOUNDER_OS_ADMIN_TOKEN>`.
7. Configure connected products to call Founder OS APIs with `Authorization: Bearer <FOUNDER_OS_ADMIN_TOKEN>`.

## Persistence Mode

Founder OS selects persistence mode at runtime:

- `memory`: default when `DATABASE_URL` is absent, useful for local smoke tests.
- `prisma`: selected when `DATABASE_URL` is configured.

Set `FOUNDER_OS_FORCE_MEMORY=true` only for local development or smoke tests. Do not use forced memory mode in production.

Set `FOUNDER_OS_ENABLE_DASHBOARD_DEMO=true` only when you need the local AI control dashboard to show safe sample execution decisions before real products are connected. The seed is idempotent and excludes raw prompts and secret references, but it should stay disabled in production.

`/api/health` reports both `persistenceMode` and `repositoryKind` so deploy checks can confirm whether the app is running with memory repositories or database-backed repositories.

Project onboarding services use `runtime.repositories.projects`. In Prisma mode, project manifests, repository metadata, project controls, and AI key references are persisted through Prisma delegates; in memory mode, the same service contract uses the local in-process store.

When `DATABASE_URL` is set and `FOUNDER_OS_FORCE_MEMORY` is not `true`, the runtime uses Prisma repositories. Token usage and token policy APIs still accept project and assistant keys; the Prisma repository layer resolves those keys to database ids before writing.

Use `npm run prisma:migrate:deploy` against each fresh Postgres database before routing connected products to Founder OS. The initial migration creates the private control-plane tables for projects, repositories, project controls, AI key references, events, token usage, token policies, profiles, consents, feedback, segments, campaigns, and audit logs.

Use `npm run deployment:check -- --production --base-url https://<founder-os-host> --token <FOUNDER_OS_ADMIN_TOKEN>` after deploy. It checks the migration deploy script, bearer token configuration, `/api/health`, Prisma persistence mode, Prisma repository kind, every private MVP readiness flag, disabled dashboard demo mode, and verifies plaintext secrets are not centrally stored.

## Production Guardrails

- Keep campaign delivery behind `/api/campaigns/telegram-live-send/approve` until Telegram bot tokens, deployment access controls, and the delivery adapter are configured.
- Keep raw conversation storage disabled by default.
- Run `npm run deployment:check -- --production` before routing personal projects to the deployment; production mode fails closed on memory repositories, enabled dashboard demo data, missing admin-token configuration, or incomplete private readiness flags.
- Rotate `FOUNDER_OS_ADMIN_TOKEN` immediately if it is exposed.
- Use separate database credentials for local, staging, and production.
- Store AI provider keys in the deployment platform or a secret manager. Founder OS should store only `secretRef` values such as `vercel:PROJECT_OPENAI_API_KEY`.
- Use `/api/projects/ai-setup` after manifest import to register the project's AI key reference and token policy in one protected admin call.
- Use `GET /api/ai-keys` to review the safe AI key reference inventory across projects, providers, allowed models, and monthly budgets without exposing plaintext provider keys.
- Track `environment`, `rotationDueAt`, `lastVerifiedAt`, and inventory `rotationStatus` for each AI key reference so OpenAI, Anthropic, Google, and other provider keys can be rotated before production risk accumulates.
- Import daily OpenAI, Anthropic, Google, or other provider cost totals through `/api/provider-spend/import`; send only aggregate project/provider/period totals and never raw invoices, provider tokens, or plaintext secrets.
- Use `/api/projects/connection?projectKey=<project>&assistantKey=<assistant>` after onboarding to get the safe integration bundle for the connected project.
- Connected products should ask `/api/ai-control/resolve` which provider, model, secret reference, and budget metadata to use before high-cost AI work.
- Connected assistants should call `/api/ai-usage/assess` before expensive or open-ended AI work. Respect `recommendedAction` and `modelDirective` to downgrade, rate-limit, block, or temporarily suspend abusive usage.
- Prefer `/api/ai-execution/decide` for connected products that want one preflight call combining AI key resolution, model choice, budget metadata, and abuse enforcement.
- Configure `/api/token-policy` for each connected project/assistant before production traffic. `/api/ai-execution/decide` applies the active token policy before exposing provider, model, or secret reference details to the product.
- Use `/api/token-policy/bulk` to apply the same preferred model, fallback model, budgets, request limit, or emergency mode across several project/assistant targets during cost spikes or provider incidents.
- Use token policy emergency mode for central fallback-model enforcement during cost spikes or provider incidents. Policy changes are recorded as `token.policy.changed` audit events.
- Use `/api/projects/readiness?projectKeys=<project>&assistantKey=<assistant>` after onboarding to confirm manifest import, AI key reference, and token policy configuration before connecting production AI traffic.
- The internal dashboard mirrors the same readiness checks for the configured dashboard project so missing transfer steps are visible before live AI usage begins.
- The internal dashboard also mirrors `/api/token-usage/summary` spend and burn-rate data so projected daily cost is visible without calling the API manually.
- Use `/api/token-usage/summary?projectKey=<project>&windowHours=<hours>` to inspect token spend, burn rate, projected daily spend, and usage split by assistant, model, and environment.
- Use `/api/ai-execution/audit?projectKey=<project>` to inspect recent AI execution decisions without exposing secrets or raw request text.
- Use `/api/ai-execution/summary?projectKey=<project>` for a compact project-level view of allow, downgrade, block, risk, reasons, and estimated tokens under risk.
- Use `/api/alerts?projectKey=<project>` to review budget breach, overdue key rotation, provider spend anomaly, and emergency-mode evidence without exposing raw prompts, provider invoices, bearer tokens, or plaintext provider keys.
- Use `/api/campaigns/workflow` to create or inspect the campaign workflow record before preview, dry-run, approval, or future delivery.
- Use `/api/campaigns/telegram-dry-run` before any Telegram campaign, then record `/api/campaigns/telegram-live-send/approve` with dry-run evidence, manual approval, matching recipient counts, and a safe `botKeyRef`. Founder OS should still keep plaintext Telegram bot tokens in the deployment secret store.

## Project Onboarding

Use `/api/projects/onboard` for a single project manifest or `/api/projects/bulk-import` for a batch of discovered manifests. Bulk import expects explicit manifest paths and contents; it does not scan arbitrary server paths by itself.

Current recommended local flow:

1. Add `.founderos/project.json` to each founder-owned project.
2. Run `npm run projects:scan -- --root C:\Repos` to preview discovered manifests.
3. Run `npm run projects:import -- --root C:\Repos --endpoint https://<founder-os-host>/api/projects/bulk-import --token <FOUNDER_OS_ADMIN_TOKEN>` to submit them.
4. Register each project's AI key reference and token policy together with `/api/projects/ai-setup`, or run `npm run projects:setup-ai -- --config <project>\.founderos\ai-setup.json --endpoint https://<founder-os-host>/api/projects/ai-setup --token <FOUNDER_OS_ADMIN_TOKEN>`.
5. If needed, update key references with `POST /api/ai-keys` or token policy with `/api/token-policy`.
6. Check `/api/projects/readiness?projectKeys=<project>&assistantKey=<assistant>` and confirm `manifestImported`, `aiKeyConfigured`, and `tokenPolicyConfigured` are true.
7. Review `GET /api/ai-keys` to confirm the inventory contains only expected `secretRef` metadata and budgets.
8. Import provider spend totals with `/api/provider-spend/import` once provider billing exports are available.
9. Fetch `/api/projects/connection?projectKey=<project>&assistantKey=<assistant>` and apply the returned environment variable names, route contracts, key references, and next steps.
10. Configure the connected project to call `/api/ai-control/resolve` before high-cost AI work.
11. Configure connected assistants to call `/api/ai-usage/assess` before expensive or open-ended AI work.
12. For new integrations, use `/api/ai-execution/decide` as the single AI preflight before model execution.
13. Review `/api/token-usage/summary` for token spend and burn-rate monitoring.
14. Review `/api/ai-execution/audit` when monitoring model downgrades, blocks, and abuse-control actions.
15. Review `/api/ai-execution/summary` for the fast token-control and abuse-control overview.
16. Review `/api/alerts` for launch evidence across budget, key lifecycle, provider spend, and emergency-mode conditions.
17. For Telegram campaigns, create the workflow, run preview, dry-run, then live-send approval before enabling any delivery adapter.

Bulk policy payload example:

```json
{
  "targets": [
    { "projectKey": "booking_assistant", "assistantKey": "support_bot" },
    { "projectKey": "sales_copilot", "assistantKey": "support_bot" }
  ],
  "policy": {
    "preferredModel": "gpt-5.4-mini",
    "fallbackModel": "gpt-5.4-mini",
    "dailyBudgetUsd": 10,
    "monthlyBudgetUsd": 200,
    "maxTokensPerRequest": 2000,
    "emergencyMode": true
  },
  "reason": "cost spike control"
}
```

Use `docs/PROJECT_AI_SETUP.example.json` as the template for `.founderos/ai-setup.json`. Keep real provider keys in Vercel, Supabase, Neon, Cloudflare, Tailscale, or another secret manager; the file should contain only `secretRef` values.

For a one-command local transfer rehearsal, run:

```powershell
npm run projects:transfer -- --root C:\Repos --setup-config C:\Repos\<project>\.founderos\ai-setup.json --base-url https://<founder-os-host> --token <FOUNDER_OS_ADMIN_TOKEN> --write-report C:\Repos\<project>\.founderos\transfer-report.json
```

Use `--dry-run` first to preview the discovered manifests, sanitized setup payload, and connection bundle URL. Use `docs/PROJECT_TRANSFER_REHEARSAL.md` as the launch checklist for the first real project.

The internal dashboard also shows the same transfer command, required environment variable names, route paths, remaining connection-bundle next steps, safe AI key inventory budgets, and the bulk token-policy incident command for the configured dashboard project.

Use `/api/projects?assistantKey=<assistant>` or the Connected Projects dashboard section to review imported projects and see which ones still need AI key references, token policies, token tracking, feedback capture, or raw-message policy fixes.

Keep an exported copy of onboarding manifests and `.founderos/ai-setup.json` files anyway. They are still the fastest disaster-recovery replay source for rebuilding a project registry or rotating secret references.
