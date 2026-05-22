# Backup and Recovery

Founder OS stores operational control-plane data. Backups should cover Postgres, deployment configuration, and secret rotation records.

## Postgres

- Enable daily automated backups in Supabase or Neon.
- Keep point-in-time recovery enabled for production if available.
- Export a monthly encrypted logical backup for long-term retention.
- Test restore into a staging database before relying on backups.

## Secrets

- Store secrets only in Vercel, Cloudflare, Supabase/Neon, or a dedicated secrets manager.
- Rotate OpenAI, Telegram, and admin tokens after any suspected exposure.
- Keep separate tokens per environment.

## Recovery Drill

1. Restore latest Postgres backup into staging.
2. Deploy Founder OS against the restored database.
3. Verify `/api/health` returns `status: ok`.
4. Verify project registry, token policies, and campaign dry-runs are visible.
5. Document recovery time and any missing data.
