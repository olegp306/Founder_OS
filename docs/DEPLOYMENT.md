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
- `FOUNDER_OS_FORCE_MEMORY`: optional local/testing override. Set to `true` to keep runtime stores in memory even when `DATABASE_URL` is present.
- `FOUNDER_OS_ENABLE_DASHBOARD_DEMO`: optional local dashboard preview seed. Set to `true` only for local smoke tests or demos; do not enable in production.

Do not commit real environment values. Store production values in the hosting provider secret store.

## Deployment Steps

1. Create the Postgres database.
2. Add environment variables in Vercel.
3. Run Prisma migrations from the deployment pipeline once migrations exist.
4. Deploy the Next.js app.
5. Put the dashboard behind Cloudflare Access or Tailscale before connecting real product integrations.
6. Configure connected products to call Founder OS APIs with `Authorization: Bearer <FOUNDER_OS_ADMIN_TOKEN>`.

## Persistence Mode

Founder OS selects persistence mode at runtime:

- `memory`: default when `DATABASE_URL` is absent, useful for local smoke tests.
- `prisma`: selected when `DATABASE_URL` is configured.

Set `FOUNDER_OS_FORCE_MEMORY=true` only for local development or smoke tests. Do not use forced memory mode in production.

Set `FOUNDER_OS_ENABLE_DASHBOARD_DEMO=true` only when you need the local AI control dashboard to show safe sample execution decisions before real products are connected. The seed is idempotent and excludes raw prompts and secret references, but it should stay disabled in production.

`/api/health` reports both `persistenceMode` and `repositoryKind` so deploy checks can confirm whether the app is running with memory repositories or database-backed repositories.

## Production Guardrails

- Keep campaign sending in dry-run until Telegram bot tokens and approval UI are configured.
- Keep raw conversation storage disabled by default.
- Rotate `FOUNDER_OS_ADMIN_TOKEN` immediately if it is exposed.
- Use separate database credentials for local, staging, and production.
- Store AI provider keys in the deployment platform or a secret manager. Founder OS should store only `secretRef` values such as `vercel:PROJECT_OPENAI_API_KEY`.
- Connected products should ask `/api/ai-control/resolve` which provider, model, secret reference, and budget metadata to use before high-cost AI work.
- Connected assistants should call `/api/ai-usage/assess` before expensive or open-ended AI work. Respect `recommendedAction` and `modelDirective` to downgrade, rate-limit, block, or temporarily suspend abusive usage.
- Prefer `/api/ai-execution/decide` for connected products that want one preflight call combining AI key resolution, model choice, budget metadata, and abuse enforcement.
- Configure `/api/token-policy` for each connected project/assistant before production traffic. `/api/ai-execution/decide` applies the active token policy before exposing provider, model, or secret reference details to the product.
- Use token policy emergency mode for central fallback-model enforcement during cost spikes or provider incidents. Policy changes are recorded as `token.policy.changed` audit events.
- Use `/api/projects/readiness?projectKeys=<project>&assistantKey=<assistant>` after onboarding to confirm manifest import, AI key reference, and token policy configuration before connecting production AI traffic.
- The internal dashboard mirrors the same readiness checks for the configured dashboard project so missing transfer steps are visible before live AI usage begins.
- Use `/api/token-usage/summary?projectKey=<project>&windowHours=<hours>` to inspect token spend, burn rate, projected daily spend, and usage split by assistant, model, and environment.
- Use `/api/ai-execution/audit?projectKey=<project>` to inspect recent AI execution decisions without exposing secrets or raw request text.
- Use `/api/ai-execution/summary?projectKey=<project>` for a compact project-level view of allow, downgrade, block, risk, reasons, and estimated tokens under risk.

## Project Onboarding

Use `/api/projects/onboard` for a single project manifest or `/api/projects/bulk-import` for a batch of discovered manifests. Bulk import expects explicit manifest paths and contents; it does not scan arbitrary server paths by itself.

Current recommended local flow:

1. Add `.founderos/project.json` to each founder-owned project.
2. Run `npm run projects:scan -- --root C:\Repos` to preview discovered manifests.
3. Run `npm run projects:import -- --root C:\Repos --endpoint https://<founder-os-host>/api/projects/bulk-import --token <FOUNDER_OS_ADMIN_TOKEN>` to submit them.
4. Register each project's AI key reference with `/api/ai-keys`.
5. Configure each project's token policy with `/api/token-policy`.
6. Check `/api/projects/readiness?projectKeys=<project>&assistantKey=<assistant>` and confirm `manifestImported`, `aiKeyConfigured`, and `tokenPolicyConfigured` are true.
7. Configure the connected project to call `/api/ai-control/resolve` before high-cost AI work.
8. Configure connected assistants to call `/api/ai-usage/assess` before expensive or open-ended AI work.
9. For new integrations, use `/api/ai-execution/decide` as the single AI preflight before model execution.
10. Review `/api/token-usage/summary` for token spend and burn-rate monitoring.
11. Review `/api/ai-execution/audit` when monitoring model downgrades, blocks, and abuse-control actions.
12. Review `/api/ai-execution/summary` for the fast token-control and abuse-control overview.
