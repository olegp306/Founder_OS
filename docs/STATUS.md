# Founder OS Status

Date: 2026-05-22

## Current Progress

MVP progress: 80%

Completed capability areas:

- Project and repository registry foundation.
- Event ingestion API foundation.
- Token usage ingestion foundation.
- Person profiles, identity merge, consent checks, feedback capture, segment evaluation, and audit trail foundation.
- Campaign eligibility, preview, and Telegram dry-run foundation.
- Production readiness foundation: admin API guard, health check, deployment docs, backup docs.

In progress:

- Database-backed persistence adapters and migrations.
- Token Control Plane persistence and admin dashboard.
- Feature-branch and pull-request workflow for all follow-up work.

## Branching Rule

Development stays in the main working stream until the MVP reaches 80%. At 80%, new work switches to `codex/` feature branches, pushes to `origin`, and draft pull requests prepared for user merge.

## Latest Slice

The latest implementation slice added structured event ingestion with:

- Safe event validation.
- Recursive rejection of raw conversation fields.
- Source and idempotency-key deduplication.
- Profile projection from `user.profile.updated` events.
- Prisma schema coverage for the MVP entity set.

The current token-control slice added:

- Token usage recording API.
- Token policy save and lookup API.
- Burn-rate alert calculation.
- Fail-closed policy behavior for connected products when central policy is unavailable.

The current profile operations slice added:

- Explicit identity merge for Telegram, email, phone, app account, and external identities.
- Consent grant and opt-out checks before contact.
- Feedback and idea capture.
- Tag-based segment evaluation.
- Audit records for identity merge and consent changes.

The current campaign center slice added:

- Consent, local send-window, and rate-limit eligibility checks.
- Campaign preview with eligible and blocked recipient lists.
- Telegram dry-run sender abstraction.
- Dry-run audit records without real message delivery.

Campaign sends remain dry-run only until production credentials, explicit approval UI, and deployment access controls are in place.

The production readiness slice added:

- Bearer-token guard for API routes when `FOUNDER_OS_ADMIN_TOKEN` is configured.
- `/api/health` environment summary without exposing secrets.
- Deployment instructions for Vercel, Postgres, Cloudflare Access, and connected products.
- Backup and recovery guidance for Postgres and secrets.

The 80% gate has been reached. New feature work should now use `codex/` feature branches, pushes to `origin`, and draft pull requests for user merge.

## Post-80% Feature Branches

### `codex/persistence-foundation`

Adds the first persistence foundation after the MVP baseline:

- Runtime persistence mode selection.
- Memory mode override for local smoke tests.
- Prisma client singleton.
- Prisma mapper functions for structured events, token usage, and token policies.
- `/api/health` now reports `persistenceMode`.

This branch is DB-ready but does not yet run migrations against a live production database.

### `codex/repository-adapters`

Adds repository contracts that let API routes migrate away from direct in-memory stores:

- Shared repository interfaces for structured events, token usage, and token policies.
- Memory repository set for local/dev and smoke tests.
- Prisma repository set for database-backed writes and lookups.
- `/api/health` reports `repositoryKind`.

The current API routes still use existing domain stores directly; follow-up branches can migrate routes one capability at a time to the repository set.

### `codex/api-repository-migration`

Migrates the first API routes to the repository set:

- `/api/events`
- `/api/token-policy`
- `/api/token-usage`

The route handlers now delegate to `src/server/api-services.ts`, which validates payloads and writes through `runtime.repositories`. `/api/health` reports `repositoryBackedRoutes`.

### `codex/engagement-api-services`

Moves engagement API logic into a dedicated service layer:

- `/api/consents`
- `/api/feedback`
- `/api/segments/evaluate`
- `/api/campaigns/preview`
- `/api/campaigns/telegram-dry-run`

These route handlers now delegate to `src/server/engagement-api-services.ts`. `/api/health` reports `serviceBackedRoutes`.

### `codex/project-ai-onboarding`

Adds the private MVP onboarding layer:

- `/api/projects/onboard` imports Founder OS project manifests.
- `/api/ai-keys` registers AI key references by project without storing plaintext secrets.
- `/api/ai-control/resolve` resolves allowed provider, model, secret reference, and budget metadata for connected projects.
- `/api/health` reports `privateMvpReadiness`.

This is the minimum layer needed to start moving current founder-owned projects into Founder OS while keeping real API keys in external secret stores.
