# Founder OS Core Design

Date: 2026-05-22
Status: Draft for review

## Purpose

Founder OS is the central operating system for the founder's own products, bots, assistants, repositories, deployments, token usage, user profiles, feedback, and marketing operations.

The first version should focus on personal product infrastructure, not client delivery. Client projects may later connect to the same control plane, but they should remain physically and operationally isolated when required.

## Core Principle

Founder OS stores structured facts, tags, summaries, consent, usage events, and audit history. It does not store raw user conversations by default.

Raw messages may be processed transiently by a bot, assistant, or product integration to extract safe structured data. After extraction, the central system receives only normalized events and profile updates.

## Product Scope

The platform should manage multiple founder-owned products, including:

- CRM-style products.
- Payment-document and invoicing helpers.
- Booking and scheduling products.
- Booking Photoshop Studio.
- Telegram bots and assistant-driven interfaces.
- Future SaaS products or client-facing product instances.

## Architecture

Founder OS has six main areas:

1. Project Registry

Tracks each product, repository, deployment environment, domain, owner, runtime, and operational status.

2. Event API

Receives structured events from products, bots, and assistants. Events are append-only and should be safe to store.

3. User Profile Builder

Consumes events and updates unified user profiles. It merges identities across Telegram, email, web accounts, and product accounts when a reliable link exists.

4. Token Metering

Tracks token usage by product, assistant, user, tenant, environment, and time window. It supports cost dashboards, limits, alerts, and future billing.

5. Feedback and Idea Inbox

Collects user suggestions, pain points, repeated requests, support signals, and assistant-observed opportunities. Assistants can cluster and summarize ideas, but the founder approves product decisions.

6. Campaign Center

Runs centralized marketing and lifecycle campaigns across allowed channels, especially Telegram bots. It must check consent, opt-out state, channel permissions, rate limits, and user timezone before sending.

## Data Model

Initial entities:

- `Project`: a product or bot owned by the founder.
- `Repository`: source code location and branch metadata.
- `Environment`: local, staging, production, or client-isolated runtime.
- `Deployment`: a deployed application or service instance.
- `Assistant`: an AI helper embedded in a product or bot.
- `Person`: unified user profile.
- `Identity`: Telegram ID, email, phone, app account ID, or other external identity.
- `Consent`: permission to contact or process a user for a specific purpose and channel.
- `Event`: structured activity emitted by a product or bot.
- `TokenUsageEvent`: normalized usage and cost record.
- `FeedbackItem`: suggestion, complaint, feature request, or support signal.
- `Segment`: dynamic or static group of people.
- `Campaign`: message workflow sent through an allowed channel.

## User Profile Content

Allowed default profile data:

- Names or display names provided by the user.
- Telegram ID, email, app account ID, and similar identifiers.
- Language, timezone, city, and country when known.
- Product usage summaries.
- Interests, tags, and inferred segments.
- Purchase, payment, booking, or subscription state.
- Consent and opt-out records.
- Last activity timestamps.
- Assistant-generated summaries.

Examples of tags:

- `booking_interest`
- `crm_lead`
- `photo_studio`
- `studio_owner`
- `price_sensitive`
- `ready_for_demo`
- `needs_support`

## Raw Message Policy

By default:

- Raw messages are not stored in Founder OS.
- Product integrations may process messages transiently.
- Debug logs must avoid personal message content unless explicitly enabled for a short diagnostic window.
- Any temporary raw-message retention must have a retention period, access controls, and audit trail.
- Users should be deletable or anonymizable.

## Event Examples

```json
{
  "event": "user.profile.updated",
  "source": "telegram_booking_bot",
  "person_ref": "telegram:123456",
  "summary": "User is interested in booking automation for a photo studio.",
  "tags": ["booking_interest", "photo_studio"],
  "facts": {
    "business_type": "photo_studio",
    "preferred_language": "ru"
  }
}
```

```json
{
  "event": "assistant.token_usage.recorded",
  "source": "booking_assistant",
  "project": "booking_photoshop_studio",
  "person_ref": "telegram:123456",
  "model": "gpt-5.4",
  "input_tokens": 1400,
  "output_tokens": 620,
  "cost_usd": 0.0124
}
```

## Security

Secrets must not be committed to repositories.

Recommended controls:

- Private repositories for all products by default.
- Central secrets manager for API keys and deploy credentials.
- Separate deploy keys per repository or environment.
- Strong SSH key policy for servers.
- Access to internal dashboards through VPN, Tailscale, WireGuard, or Cloudflare Access.
- Audit logs for profile changes, campaign sends, access changes, and deployment actions.
- Encrypted backups for databases, volumes, and secrets.

## Client Isolation Boundary

Founder-owned products can run in shared founder infrastructure when appropriate.

Client projects should remain separate by default:

- Separate server or isolated environment per client when needed.
- Separate secrets.
- Separate database or schema.
- Separate deployment record.
- Clear rules for which usage data can return to Founder OS.
- No client personal data should flow into Founder OS unless contractually allowed and technically required.

## MVP

The first implementation should include:

- Project registry.
- Repository registry.
- Event ingestion API.
- Unified user profiles.
- Identity mapping for Telegram and web users.
- Consent records.
- Token usage events and dashboard.
- Feedback and idea inbox.
- Basic Telegram campaign sending through approved bots.
- Manual admin dashboard for reviewing users, projects, usage, and ideas.

## Non-Goals for MVP

- Full billing automation.
- Kubernetes orchestration.
- Complex multi-client provisioning.
- Raw conversation archive.
- Fully automated product roadmap decisions.
- Advanced ML segmentation.

## Open Decisions

These are intentionally deferred until implementation planning:

- Whether MVP runs as a single monolith or split services.
- Exact application framework.
- Exact database schema.
- Whether token metering starts as internal tables or OpenMeter integration.
- Whether campaigns are implemented directly or through a queue provider.

## Success Criteria

Founder OS is successful when the founder can:

- See all active products and bots in one place.
- See unified user profiles across products.
- Understand token usage and cost per project and assistant.
- Review user feedback and assistant-summarized ideas.
- Launch a compliant Telegram campaign to a selected segment.
- Avoid storing raw conversations centrally.
- Prepare for later automated deployment and client-instance provisioning.
