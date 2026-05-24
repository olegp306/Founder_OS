# Founder OS Production 98 Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring Founder OS from the current private MVP state to a 98% production launch gate where founder-owned projects can be deployed, connected, monitored, and controlled from one private system.

**Architecture:** Keep the modular Next.js/TypeScript monolith, Prisma-backed Postgres persistence, and protected admin APIs. Production readiness is split into independently testable slices: key lifecycle, provider spend monitoring, deploy gate automation, real-project transfer, operator dashboard controls, and audit/alert evidence.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, Postgres, Vitest, GitHub, Vercel, Cloudflare Access or Tailscale, external secret stores, OpenAI/Anthropic key references.

---

## Current State

`main` is at the post-80% baseline with all PRs merged. The system already has project import, AI key references, token policies, bulk emergency policies, Prisma repositories, dashboard summaries, deployment checks, and local transfer helpers.

Current readiness estimate: **86%** toward the 98% production launch gate.

The missing production capabilities are:

1. AI key lifecycle and rotation metadata.
2. Provider spend monitoring beyond internal usage events.
3. A stricter launch gate that blocks memory-mode or demo-mode production deploys.
4. A real-project transfer rehearsal artifact and repeatable checklist.
5. Operator controls in the dashboard for key health, policy apply, and transfer status.
6. Alert/audit visibility for provider incidents, budget breaches, and key rotation.

## Task 1: AI Key Lifecycle Metadata

**Files:**
- Modify: `src/domain/projects/project-onboarding.ts`
- Modify: `src/server/project-ai-api-services.ts`
- Modify: `src/persistence/repositories.ts`
- Modify: `src/persistence/memory/repositories.ts`
- Modify: `src/persistence/prisma/repositories.ts`
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260524000000_ai_key_lifecycle/migration.sql`
- Test: `tests/server/ai-usage-api-services.test.ts`
- Test: `tests/persistence/prisma-repositories.test.ts`
- Test: `tests/persistence/prisma-migrations.test.ts`

- [ ] **Step 1: Write failing server test for key lifecycle inventory**

Add a test named `reports AI key lifecycle and rotation readiness` that registers OpenAI and Anthropic key references with `environment`, `rotationDueAt`, and `lastVerifiedAt`, then expects `handleAiKeyReferenceInventory` to return safe lifecycle fields and `rotationStatus` values.

- [ ] **Step 2: Run test to verify RED**

Run: `npm test -- tests/server/ai-usage-api-services.test.ts`

Expected: FAIL because `environment`, `rotationDueAt`, `lastVerifiedAt`, and `rotationStatus` are not supported.

- [ ] **Step 3: Implement domain and service lifecycle fields**

Extend `AiKeyReference` with:

```ts
environment: "local" | "staging" | "production";
rotationDueAt?: string;
lastVerifiedAt?: string;
```

Add `rotationStatus` in inventory responses:

```ts
type RotationStatus = "ok" | "due_soon" | "overdue" | "unknown";
```

Use deterministic date comparison with optional `asOf` input for tests.

- [ ] **Step 4: Persist lifecycle fields**

Add nullable Prisma columns:

```prisma
environment   String   @default("production")
rotationDueAt DateTime?
lastVerifiedAt DateTime?
```

Map those fields in memory and Prisma repositories without storing plaintext keys.

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
npm test -- tests/server/ai-usage-api-services.test.ts tests/persistence/prisma-repositories.test.ts tests/persistence/prisma-migrations.test.ts
```

Expected: all selected tests pass.

## Task 2: Provider Spend Import Contract

**Files:**
- Create: `src/server/provider-spend-services.ts`
- Create: `src/app/api/provider-spend/import/route.ts`
- Modify: `src/app/api/health/route.ts`
- Test: `tests/server/provider-spend-services.test.ts`
- Test: `tests/app/health-route.test.ts`

- [x] **Step 1: Write failing tests for provider spend import**

Test an admin payload that imports daily provider totals for `openai`, `anthropic`, `google`, and `other`, linked by `projectKey`, `provider`, `periodStart`, `periodEnd`, `costUsd`, and `source`.

- [x] **Step 2: Implement safe import service**

Normalize provider spend into structured events named `provider.spend.imported`, with no raw invoices and no secrets.

- [x] **Step 3: Add route and health readiness flag**

Expose `POST /api/provider-spend/import` and add `privateMvpReadiness.providerSpendImport = true`.

- [x] **Step 4: Verify selected tests**

Run: `npm test -- tests/server/provider-spend-services.test.ts tests/app/health-route.test.ts`

## Task 3: Production Launch Gate

**Files:**
- Modify: `src/local/deployment-check-cli.ts`
- Modify: `tests/local/deployment-check-cli.test.ts`
- Modify: `docs/DEPLOYMENT.md`

- [x] **Step 1: Write failing deployment-check tests**

Add tests requiring production checks to fail when:

```json
{
  "persistenceMode": "memory",
  "repositoryKind": "memory",
  "environment": {
    "FOUNDER_OS_ENABLE_DASHBOARD_DEMO": "true"
  }
}
```

- [x] **Step 2: Implement strict launch gate**

Add `--production` mode to `npm run deployment:check` that requires Prisma persistence, no dashboard demo, admin token configured, and all private readiness flags true.

- [x] **Step 3: Verify deployment gate**

Run: `npm test -- tests/local/deployment-check-cli.test.ts`

## Task 4: Real Project Transfer Rehearsal

**Files:**
- Create: `docs/PROJECT_TRANSFER_REHEARSAL.md`
- Modify: `src/local/project-transfer-cli.ts`
- Modify: `tests/local/project-transfer-cli.test.ts`

- [ ] **Step 1: Write failing transfer rehearsal tests**

Add a `--write-report <path>` test that expects a sanitized JSON report with import, setup, connection, readiness, and missing steps.

- [ ] **Step 2: Implement report output**

Write a local report that contains no plaintext secrets and can be attached to launch notes.

- [ ] **Step 3: Document first-project rehearsal**

Document exactly how to rehearse one personal project before live traffic.

## Task 5: Dashboard Operator Controls

**Files:**
- Modify: `src/server/dashboard-services.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/app/styles.css`
- Test: `tests/server/dashboard-services.test.ts`
- Test: `tests/app/home-page.test.tsx`

- [ ] **Step 1: Surface AI key lifecycle panel**

Show key count by provider, production key count, rotation due/overdue counts, and disabled/rotating statuses.

- [ ] **Step 2: Surface launch gate panel**

Show whether persistence, repository kind, private readiness, and demo mode are production-safe.

- [ ] **Step 3: Verify dashboard render**

Run: `npm test -- tests/server/dashboard-services.test.ts tests/app/home-page.test.tsx`

## Task 6: Alert And Audit Evidence

**Files:**
- Modify: `src/server/api-services.ts`
- Modify: `src/server/project-ai-api-services.ts`
- Create: `src/server/alert-services.ts`
- Create: `src/app/api/alerts/route.ts`
- Test: `tests/server/alert-services.test.ts`

- [ ] **Step 1: Write failing alert tests**

Test alerts for budget breach, rotation overdue, provider spend anomaly, and emergency-mode activation.

- [ ] **Step 2: Implement alert projection from structured events**

Build alerts from existing token usage, token policy changes, provider spend imports, and key lifecycle metadata.

- [ ] **Step 3: Add safe alert route**

Expose `GET /api/alerts` without secrets, raw prompts, or provider invoices.

## 98% Launch Gate

Founder OS reaches 98% when these checks are true:

- `npm test` passes.
- `npm run typecheck` passes.
- `npm run build` passes.
- `npm run prisma:validate` passes with production `DATABASE_URL`.
- `npm run deployment:check -- --production --base-url <url> --token <token>` passes.
- At least one real personal project has a transfer rehearsal report.
- AI key inventory shows provider, environment, budget, status, rotation status, and safe secret references.
- Dashboard shows project readiness, token spend, AI key inventory, key lifecycle, bulk token policy, and launch gate status.
- No route returns plaintext provider keys, raw prompts, raw conversations, or unapproved user intelligence.
