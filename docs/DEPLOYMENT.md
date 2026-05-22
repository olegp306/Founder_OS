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

Do not commit real environment values. Store production values in the hosting provider secret store.

## Deployment Steps

1. Create the Postgres database.
2. Add environment variables in Vercel.
3. Run Prisma migrations from the deployment pipeline once migrations exist.
4. Deploy the Next.js app.
5. Put the dashboard behind Cloudflare Access or Tailscale before connecting real product integrations.
6. Configure connected products to call Founder OS APIs with `Authorization: Bearer <FOUNDER_OS_ADMIN_TOKEN>`.

## Production Guardrails

- Keep campaign sending in dry-run until Telegram bot tokens and approval UI are configured.
- Keep raw conversation storage disabled by default.
- Rotate `FOUNDER_OS_ADMIN_TOKEN` immediately if it is exposed.
- Use separate database credentials for local, staging, and production.
