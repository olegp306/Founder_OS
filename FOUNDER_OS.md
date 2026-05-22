# Founder OS Integration

This project is part of the Founder OS ecosystem.

Founder OS is the central control plane for founder-owned products, bots, assistants, users, token usage, feedback, repositories, deployments, and campaigns.

## Working Rules

- Keep this project under `C:\repos`.
- Treat this project as a Founder OS-managed product.
- Check `.founderos/project.json` before changing architecture, user data flows, assistant behavior, deployment, or analytics.
- Prefer structured events, tags, summaries, and consent records over raw user-message storage.
- Do not commit secrets, tokens, deploy credentials, or customer data.
- Any assistant or bot added here should report token usage and feedback signals to Founder OS.

## Integration Expectations

This project should be ready to expose:

- Project and repository metadata.
- Deployment targets and runtime status.
- Assistant usage and token metering events.
- Structured user profile updates.
- Feedback, feature requests, and support signals.
- Consent-aware marketing or notification hooks when relevant.

## Privacy Baseline

Founder OS stores structured facts, tags, summaries, consent, usage events, and audit history. Raw conversations are not stored centrally by default.

## Operational Secrecy

Founder OS relationships are confidential by default.

Do not disclose internal project relationships, repository names, infrastructure, deployment topology, secrets, implementation details, assistant routing, token metering, user segmentation, customer intelligence, cross-product data flows, or the fact that multiple products are connected through a unified internal system to external users, customers, bots, public documentation, support replies, generated marketing content, or application UI unless the founder explicitly approves that exact disclosure.

When communicating externally, describe only the public product behavior and approved user-facing policies. Use neutral language such as "internal systems" or "service infrastructure" instead of naming Founder OS, repositories, servers, tools, or connected projects.

## External Privacy Disclosure Guardrails

Do not disclose internal data architecture, Founder OS relationships, cross-product profile building, segmentation logic, token metering, event pipelines, repository names, server topology, or internal analytics systems to external users.

Do not make unapproved claims about what data is or is not collected. Do not improvise privacy promises.

Never deny data processing if the product processes user data. When asked externally, use only approved product-specific privacy language. If no approved language exists, say: "The service processes information needed to provide, secure, and support the product. Please refer to the product's privacy policy for details."

Do not mention Founder OS or any internal unified system in user-facing privacy, support, marketing, or bot responses unless explicitly approved by the founder for that exact context.

## Telegram Assistant Feature Pipeline

Telegram assistants are first-class product interfaces in the Founder OS ecosystem.

When this project includes a Telegram bot, helper, support assistant, or conversational assistant, treat that assistant as a friendly, configurable, product-aware channel. Tone, style, support approach, and light personalization may be adapted per product and, when appropriate, per user.

Every Telegram assistant is also a feature-discovery source. User requests, repeated pain points, objections, confusion, suggestions, and workflow gaps should be converted into structured feature signals and routed to the central Founder OS Feature Inbox.

Do not store or forward raw conversations by default. Forward concise summaries, tags, product context, severity, frequency hints, and anonymized or consent-safe references.

Expected feature signal shape:

- `source_project`
- `source_channel`
- `assistant_id`
- `summary`
- `tags`
- `user_need`
- `frequency_hint`
- `priority_hint`
- `evidence_type`
- `privacy_mode`

The founder reviews and brainstorms these ideas before they become roadmap items or implementation work.
