# Founder OS Master Development Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for production behavior and superpowers:verification-before-completion before claiming completion. This plan intentionally uses larger implementation slices of 4-8 steps per user direction.

**Goal:** Build Founder OS as the founder's central control plane for projects, users, events, token spend, feedback, and campaigns.

**Architecture:** Start as a modular TypeScript monolith with a Next.js admin app, Postgres persistence through Prisma, and domain modules that can later split into services. Products integrate through structured event ingestion and token policy APIs; raw conversations are not stored centrally by default.

**Tech Stack:** Next.js, TypeScript, Prisma, Postgres, Vitest, Tailwind CSS, server-side domain modules, and later Telegram/OpenAI integrations.

---

## Progress Model

Overall MVP progress is tracked across ten equally weighted capability areas:

1. Project and repository registry.
2. Event ingestion API.
3. Person profiles and identity mapping.
4. Consent and audit records.
5. Token usage ingestion.
6. Token Control Plane policies, alerts, and emergency controls.
7. Feedback and idea inbox.
8. Segments and campaign eligibility.
9. Admin dashboard.
10. Deployment, secrets, and production readiness.

Each completed area adds 10%. At 80%, development switches to feature branches using the `codex/` prefix, pushes to `origin`, and draft PRs prepared for user merge.

## Slice 1: Foundation, Domain Core, and Local Tooling

**Progress target:** 15%

1. Scaffold a TypeScript app workspace with Next.js-compatible structure, Vitest, strict TypeScript, linting, and environment examples.
2. Add domain modules for projects, events, profiles, consent, token usage, token policies, and audit records.
3. Write first TDD tests for project registration, token usage normalization, and token policy evaluation.
4. Implement minimal in-memory domain services to pass tests before database wiring.
5. Add a project status and progress document.
6. Run typecheck and tests.

## Slice 2: Persistence and Event Ingestion

**Progress target:** 30%

1. Add Prisma schema for Project, Repository, Environment, Deployment, Assistant, Person, Identity, Consent, Event, TokenUsageEvent, TokenPolicy, TokenAlert, FeedbackItem, Segment, and Campaign.
2. Add migrations and seed data for local development.
3. Implement event ingestion route with validation and append-only storage.
4. Connect profile builder to normalized events.
5. Add tests for valid events, rejected unsafe raw payloads, and idempotency behavior.
6. Run database-backed test suite.

## Slice 3: Token Control Plane

**Progress target:** 45%

1. Persist token usage events by project, assistant, environment, model, person, and time window.
2. Build burn-rate and projected-spend calculations.
3. Implement token policies for preferred model, fallback model, budget limits, per-request limits, and emergency mode.
4. Create alert generation for budget breach, spike, anomaly, and policy breach.
5. Expose policy lookup API for connected products.
6. Add tests for normal spend, spike detection, emergency downgrade, and fail-closed policy behavior.
7. Add initial admin UI for token usage and policy changes.

## Slice 4: Profiles, Consent, Feedback, and Segments

**Progress target:** 60%

1. Implement identity merge rules for Telegram, email, and app account IDs.
2. Implement consent records and opt-out checks.
3. Add feedback and idea inbox ingestion from structured events.
4. Add segment definitions and basic segment membership evaluation.
5. Build admin views for profiles, identities, consent, feedback, and segments.
6. Add audit trail for profile, consent, and segment changes.

## Slice 5: Campaign Center and Telegram Integration

**Progress target:** 75%

1. Add Campaign data model and workflow states.
2. Implement eligibility checks using consent, opt-out, channel permission, rate limit, and timezone.
3. Add Telegram sender abstraction with dry-run mode first.
4. Add campaign preview and manual approval gate.
5. Add tests for blocked sends, allowed sends, rate limits, and timezone windows.
6. Add audit logs for campaign sends and failures.

Implementation note: the current campaign slice has workflow state tracking, preview, dry-run, live-send approval gating, safe delivery handoff, and audit records. Actual Telegram delivery remains intentionally external behind production bot credentials and deployment access controls.

## Slice 6: Production Readiness and 80% Gate

**Progress target:** 80%+

1. Add authentication and restrict admin access.
2. Add environment configuration, secrets documentation, and deployment guide.
3. Add Sentry-ready error boundary and structured logging hooks.
4. Add backup/export guidance for Postgres.
5. Run full verification: tests, typecheck, build, and a browser smoke test.
6. Create the first version milestone and switch subsequent work to feature branches, pushed branches, and draft PRs for user merge.

## Immediate External Accounts

- GitHub repository access to `olegp306/Founder_OS`.
- Cloudflare account for DNS and access control.
- Domain registration through Cloudflare Registrar, Porkbun, or Namecheap.
- Vercel account for the admin app.
- Supabase or Neon Postgres; Supabase is preferred for fastest MVP setup.
- OpenAI Platform account and project keys.
- Telegram BotFather tokens for approved bots.
- Sentry account for errors.
- PostHog account for product analytics after core flows exist.
- Resend or Postmark if email workflows enter the MVP.
