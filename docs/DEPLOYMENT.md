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

`/api/health` reports both `persistenceMode` and `repositoryKind` so deploy checks can confirm whether the app is running with memory repositories or database-backed repositories.

## Production Guardrails

- Keep campaign sending in dry-run until Telegram bot tokens and approval UI are configured.
- Keep raw conversation storage disabled by default.
- Rotate `FOUNDER_OS_ADMIN_TOKEN` immediately if it is exposed.
- Use separate database credentials for local, staging, and production.
- Store AI provider keys in the deployment platform or a secret manager. Founder OS should store only `secretRef` values such as `vercel:PROJECT_OPENAI_API_KEY`.
- Connected products should ask `/api/ai-control/resolve` which provider, model, secret reference, and budget metadata to use before high-cost AI work.

## Project Onboarding

Use `/api/projects/onboard` for a single project manifest or `/api/projects/bulk-import` for a batch of discovered manifests. Bulk import expects explicit manifest paths and contents; it does not scan arbitrary server paths by itself.

Current recommended local flow:

1. Add `.founderos/project.json` to each founder-owned project.
2. Run `npm run projects:scan -- --root C:\Repos` to preview discovered manifests.
3. Run `npm run projects:import -- --root C:\Repos --endpoint https://<founder-os-host>/api/projects/bulk-import --token <FOUNDER_OS_ADMIN_TOKEN>` to submit them.
4. Register each project's AI key reference with `/api/ai-keys`.
5. Configure the connected project to call `/api/ai-control/resolve` before high-cost AI work.
