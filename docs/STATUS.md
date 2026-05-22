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

- Database-backed persistence.
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
