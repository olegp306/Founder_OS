# Founder OS Status

Date: 2026-05-24

## Current Progress

MVP progress: 98%

Completed capability areas:

- Project and repository registry foundation.
- Event ingestion API foundation.
- Token usage ingestion foundation.
- Person profiles, identity merge, consent checks, feedback capture, segment evaluation, and audit trail foundation.
- Campaign eligibility, preview, and Telegram dry-run foundation.
- Production readiness foundation: admin API guard, health check, deployment docs, backup docs.

Production 98 implementation complete:

- Production 98 launch gate: strict deploy checks, real-project rehearsal, provider spend imports, key lifecycle, dashboard operator controls, and alerts.
- AI key lifecycle metadata for OpenAI, Anthropic, Google, and other provider references.
- Provider spend import is now implemented for daily OpenAI, Anthropic, Google, and other provider totals.
- Strict production launch gate is now implemented for Prisma persistence, disabled dashboard demo mode, admin token readiness, and private MVP readiness flags.
- Real-project transfer rehearsal reports can now be written as sanitized launch artifacts.
- Dashboard operator controls now show AI key lifecycle and production launch gate state.
- Alert evidence now covers budget breaches, overdue key rotation, provider spend anomalies, and emergency-mode activation.
- `/api/health` reports alert evidence as part of private MVP readiness.

External launch gate still required:

- Deploy to the production host.
- Configure production `DATABASE_URL` and `FOUNDER_OS_ADMIN_TOKEN`.
- Run `npm run deployment:check -- --production --base-url <founder-os-host> --token <FOUNDER_OS_ADMIN_TOKEN>`.
- Produce one real-project transfer rehearsal report before routing live AI traffic.

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

The production 98 roadmap is now tracked in `docs/superpowers/plans/2026-05-24-production-98-roadmap.md`.

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

### `codex/bulk-project-import`

Adds batch onboarding for existing projects:

- `/api/projects/bulk-import` accepts a list of discovered `.founderos/project.json` files and imports all valid manifests.
- Import reports split results into `imported`, `skipped`, and `invalid`.
- Readiness output shows whether each imported project has a manifest, AI key reference, token tracking, feedback capture, and raw-message policy.
- `/api/health` reports `bulkProjectImport`.

The API accepts explicit manifest file contents instead of scanning server disks by itself. A local CLI/helper can be added later to scan `C:\Repos` and submit the discovered manifests.

### `codex/local-project-import-helper`

Adds the local helper for moving existing projects into Founder OS:

- `npm run projects:scan -- --root C:\Repos` discovers `.founderos/project.json` files and prints the exact bulk-import payload without sending it.
- `npm run projects:import -- --root C:\Repos --endpoint <url>/api/projects/bulk-import --token <FOUNDER_OS_ADMIN_TOKEN>` submits discovered manifests to the bulk import API.
- The scanner skips heavy generated directories such as `.git`, `.next`, `dist`, `coverage`, and `node_modules`.
- Manifest content is normalized by removing a UTF-8 BOM before submission, which protects imports from PowerShell-authored JSON files.

### `codex/ai-usage-abuse-protection`

Adds the first AI usage abuse-protection preflight:

- `/api/ai-usage/assess` evaluates expensive or open-ended assistant requests before model execution.
- The assessment detects outside-product-scope requests, generic AI proxy patterns, prompt-injection/system-extraction attempts, bulk automation, and high-volume low-intent usage.
- Responses return enforcement guidance: allow, downgrade, rate-limit, block, or temporary suspend.
- The API returns product-safe user-facing copy without exposing internal scoring or thresholds.

### `codex/ai-execution-policy-resolution`

Adds a single AI execution preflight for connected products:

- `/api/ai-execution/decide` combines AI key/model resolution with AI usage abuse assessment.
- Downgrade decisions resolve to the configured fallback/default model before product execution.
- Blocked abuse requests do not expose provider, model, or secret references.
- Missing AI key references fail closed with `ai_key_not_configured`.

### `codex/ai-execution-decision-audit`

Adds AI execution decision auditability:

- Every `/api/ai-execution/decide` call records a structured `assistant.ai_execution.decided` event.
- Audit facts include project, assistant, action, risk level, reasons, requested model, selected model, provider, and estimated tokens.
- Audit events deliberately exclude raw request text and `secretRef` values.
- `/api/ai-execution/audit` lists recent decisions for monitoring downgrades, blocks, and cost-control actions.

### `codex/ai-execution-summary`

Adds project-level AI execution monitoring:

- `/api/ai-execution/summary` aggregates execution decision events by project.
- The summary reports total, allowed, blocked, action counts, risk counts, estimated tokens, estimated tokens under risk, top reasons, and last action.
- Fast repeated execution decisions now use unique event idempotency keys so audit records are not collapsed accidentally.

### `codex/ai-control-dashboard`

Adds the first internal dashboard surface:

- The home page now presents AI Execution Control instead of a static MVP landing status.
- Dashboard sections show execution metrics, control routes, guardrails, and safe recent execution signals.
- The UI calls out summary, audit, decide, and AI key reference contracts for connected projects.

### `codex/live-ai-dashboard-data`

Connects the dashboard to runtime data:

- Adds a dashboard service that builds AI control metrics from execution summary and audit data.
- The home page now reads dashboard metrics and recent signals from the Founder OS runtime instead of hard-coded values.
- Empty runtime state renders an explicit no-decisions row while keeping route contracts and guardrails visible.

### `codex/ai-dashboard-demo-seed`

Adds an opt-in local preview seed for the AI control dashboard:

- `seedAiControlDashboardDemoData` creates safe sample key metadata and execution decisions for local dashboard previews.
- `FOUNDER_OS_ENABLE_DASHBOARD_DEMO=true` lets the home page show meaningful runtime metrics before real connected products send traffic.
- The seed is idempotent and keeps dashboard output free of raw request text and secret references.

### `codex/ai-execution-token-policy`

Connects central token policy to AI execution decisions:

- `/api/token-policy` changes now produce `token.policy.changed` audit events with model, budget, request-limit, and emergency-mode facts.
- `/api/ai-execution/decide` applies the active project/assistant token policy before returning provider, model, or secret reference details.
- Emergency mode centrally downgrades execution to the fallback model, and over-limit requests are blocked without exposing provider or secret references.
- AI execution audit events now include `policy_source` for policy-driven decisions.

### `codex/project-token-policy-readiness`

Adds project transfer readiness checks for AI control:

- `/api/projects/readiness` lists imported project readiness by project key and optional assistant key.
- Readiness now includes `tokenPolicyConfigured` alongside manifest import, AI key reference, token tracking, feedback capture, and raw-message policy.
- Bulk import readiness uses the same enrichment so newly imported projects show whether token policy still needs configuration.

### `codex/dashboard-project-readiness`

Surfaces transfer readiness in the internal dashboard:

- The home page now shows Project Transfer Readiness with manifest, AI key, token policy, token tracking, feedback capture, and raw-message status.
- The dashboard view model builds readiness from `/api/projects/readiness` service logic so UI and API stay aligned.
- Demo dashboard seed now onboards the sample project and token policy before generating safe AI execution signals.
- AI execution model selection preserves abuse fallback routing even when a non-emergency token policy is active.

### `codex/token-usage-summary`

Adds token spend summary for connected products:

- `/api/token-usage/summary` summarizes usage by project and configurable time window.
- The summary reports event count, total tokens, total cost, spend per hour, tokens per hour, and projected daily spend.
- Usage is grouped by assistant, model, and environment so token spend spikes can be traced to the responsible surface.

### `codex/dashboard-token-spend`

Surfaces token spend in the internal dashboard:

- The dashboard now shows total token cost, total tokens, and projected daily spend for the configured project window.
- Top model and environment breakdowns come from the same token usage summary service used by `/api/token-usage/summary`.
- The local demo seed now includes safe token usage events and is guarded against concurrent duplicate seeding.

### `codex/project-connection-bundle`

Adds a safe connection bundle for moving personal projects into Founder OS:

- `/api/projects/connection` returns the project key, assistant key, required environment variable names, integration routes, readiness state, AI key references, and token policy summary.
- The bundle includes only `secretRef` metadata and never stores or returns plaintext provider keys.
- `/api/health` now reports the connection bundle route as part of the private onboarding surface.

### `codex/project-ai-setup`

Adds one-step AI setup for transferred projects:

- `/api/projects/ai-setup` registers an AI key reference and token policy for a project/assistant in one admin call.
- The setup response immediately returns the refreshed connection bundle so the connected project can apply environment names and route contracts.
- Plaintext provider keys remain excluded from responses; products continue to use external secret stores through `secretRef` values.

### `codex/project-ai-setup-cli`

Adds a local helper for applying AI setup configs:

- `npm run projects:setup-ai -- --config <path> --endpoint <url>/api/projects/ai-setup --token <FOUNDER_OS_ADMIN_TOKEN>` posts a project AI setup payload.
- `--dry-run` prints the sanitized payload without calling Founder OS.
- The helper strips `plaintextSecret` before sending, keeping real provider keys in external secret stores.

### `codex/project-transfer-cli`

Adds a single local transfer flow for personal projects:

- `npm run projects:transfer -- --root <repos-root> --setup-config <project>\.founderos\ai-setup.json --base-url <founder-os-host> --token <FOUNDER_OS_ADMIN_TOKEN>` runs manifest import, AI setup, and connection bundle verification.
- `--dry-run` reports the import endpoint, sanitized setup payload, and connection check URL without network writes.
- The transfer flow reuses the existing bulk import and setup APIs so project moves stay repeatable and auditable.

### `codex/dashboard-transfer-flow`

Surfaces the project transfer flow in the internal dashboard:

- The dashboard now shows the local `projects:transfer` command for the configured project and assistant.
- Required environment variable names, connected route paths, and connection-bundle next steps are visible without exposing `secretRef` values.
- Demo dashboard data now reaches the ready transfer state, so local previews show the full move-project flow.

### `codex/project-list-dashboard`

Adds project listing for multi-project transfer visibility:

- `/api/projects` lists imported projects with safe repository metadata, readiness counts, and missing setup labels.
- The internal dashboard now shows Connected Projects so multiple personal projects can be tracked beyond the default demo project.
- Project list output excludes AI key `secretRef` values while still showing readiness state.

### `codex/project-onboarding-repositories`

Routes project onboarding through the repository set:

- Adds a `projects` repository contract for manifests, repository metadata, AI key references, and project controls.
- Memory repositories share the runtime project onboarding store for backwards-compatible local behavior.
- Project onboarding, AI key registration, readiness, project list, connection bundle, bulk import, AI setup, and AI execution control now call `runtime.repositories.projects`.
- Prisma repository set includes a temporary project onboarding bridge until dedicated project onboarding tables and adapters are added.

### `codex/prisma-project-onboarding`

Adds database-backed project onboarding persistence:

- Extends Prisma schema with project category/workspace fields, repository onboarding metadata, project controls, and AI key references.
- Prisma project repositories now upsert projects, repository metadata, controls, and AI key references through Prisma delegates instead of the temporary in-process bridge.
- Project onboarding reads now load projects, repositories, controls, and key references from Prisma-shaped delegates for production persistence.

### `codex/runtime-prisma-repositories`

Enables Prisma repositories in the runtime:

- `createFounderOsRuntime` now uses `PrismaRepositorySet` when `DATABASE_URL` is configured and memory mode is not forced.
- Runtime construction accepts an injectable Prisma-like client for tests while production uses the shared Prisma client singleton.
- Prisma token usage and token policy repositories now resolve project and assistant keys to database ids, so existing API payloads work in Prisma mode.

### `codex/prisma-core-migration`

Adds deployable database migrations:

- Adds the initial Prisma migration SQL generated from the current Founder OS schema.
- Adds `npm run prisma:migrate:deploy` for deployment pipelines.
- Adds migration coverage so the core project, AI key reference, project control, token usage, and foreign-key tables stay represented in versioned SQL.

### `codex/deployment-readiness-check`

Adds a pre-transfer deployment smoke check:

- Adds `npm run deployment:check` for validating a deployed Founder OS URL before routing personal projects to it.
- The check verifies the migration deploy script, admin token, `/api/health`, expected persistence mode, repository kind, private MVP readiness flags, and plaintext-secret safety.
- The CLI supports `--dry-run`, `--base-url`, `--token`, and `--expected-persistence` for local, staging, and production checks.

### `codex/ai-key-inventory`

Adds safe AI key reference inventory:

- `GET /api/ai-keys` lists key reference metadata across onboarded projects without returning plaintext provider keys.
- Inventory output groups monthly budget totals by provider and project so key coverage and AI spend exposure are visible before production traffic.
- `/api/health` now reports `aiKeyInventory` as part of private MVP readiness.

### `codex/dashboard-ai-key-inventory`

Surfaces AI key inventory on the dashboard:

- The dashboard view model now includes safe AI key reference counts, provider budgets, project budgets, providers, and default models.
- The home page shows an AI Key Inventory section without rendering `secretRef` values or plaintext provider keys.
- Demo dashboard data now shows the configured monthly AI key budget alongside token spend and project transfer readiness.

### `codex/bulk-token-policy-apply`

Adds fleet-wide token policy controls:

- `/api/token-policy/bulk` applies one model/budget/emergency-mode policy to multiple project/assistant targets.
- Each bulk-applied policy writes a `token.policy.changed` audit event with `bulk_apply` and optional reason metadata.
- `/api/health` reports bulk token policy support as part of private MVP readiness.

### `codex/dashboard-bulk-token-policy`

Surfaces fleet-wide token policy controls in the dashboard:

- The dashboard view model now includes the bulk policy route, incident command, target count, target list, and emergency-mode template.
- The home page shows a Bulk Token Policy section with imported project targets, fallback-model emergency controls, and budget ceilings.
- The dashboard keeps this incident surface free of plaintext secrets and raw provider keys.

### `codex/production-readiness-roadmap`

Adds the production 98 launch roadmap and starts AI key lifecycle readiness:

- Documents the remaining launch gate from 86% to 98% across key lifecycle, provider spend imports, strict deployment checks, transfer rehearsal, dashboard operator controls, and alert evidence.
- Extends AI key references with environment, rotation due date, and last verified timestamp metadata.
- AI key inventory now reports rotation status and provider-level due/overdue counts without storing plaintext provider keys.
- Adds `/api/provider-spend/import` to import provider cost totals as safe `provider.spend.imported` structured events.
- Provider spend imports deduplicate by project, provider, period, and source, and reject raw invoice or secret payload fields.
- Adds `npm run deployment:check -- --production` as a strict launch gate that fails on memory persistence, memory repositories, enabled dashboard demo mode, missing admin token configuration, plaintext secret storage, or incomplete readiness flags.
- `/api/health` now exposes whether dashboard demo mode is enabled without exposing secret values.
- Adds `npm run projects:transfer -- --write-report <path>` to write a sanitized transfer rehearsal report with import, setup, connection, readiness, and missing steps.
- Documents the first real-project rehearsal flow in `docs/PROJECT_TRANSFER_REHEARSAL.md`.
- Surfaces dashboard operator controls for key lifecycle counts, provider rotation health, and launch gate readiness.
- Adds `/api/alerts` for safe alert projections from token usage, token policy changes, provider spend imports, and key lifecycle metadata.
- `/api/health` now reports `/api/alerts` and `privateMvpReadiness.alertEvidence`.
- Adds a Prisma migration for lifecycle metadata on `AiKeyReference`.
