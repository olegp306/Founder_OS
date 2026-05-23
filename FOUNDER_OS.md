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

## User Value And Quality Bar

The main value of Founder OS is quality control across all founder-owned products.

Users are the most important asset. Every product, bot, assistant, campaign, and support flow should be designed to make users feel understood, helped, respected, and well served.

Founder OS projects should continuously improve:

- Product usefulness.
- Speed and clarity of support.
- Relevance of recommendations and offers.
- User trust and retention.
- Conversion quality without harming the user experience.

User understanding should come from consent-safe structured facts, tags, summaries, usage signals, feedback, and product context. Use that understanding to provide better service, better timing, better product decisions, and more relevant contextual offers.

Do not spam users. Do not send generic campaigns when a contextual, user-relevant message is possible. Marketing should feel helpful, timely, and aligned with the user's actual needs.

Quality signals, user delight signals, churn risks, repeated frustrations, and monetization opportunities should be routed into Founder OS for review and improvement.

## Self-Improving Product System

Founder OS is a self-improving product system.

The founder sets product direction, priorities, taste, and business intent. User experience signals, assistant conversations, feature requests, support patterns, objections, and repeated workflow friction provide the second growth vector.

Products should improve through this loop:

1. Users interact with products, bots, and assistants.
2. Assistants extract structured quality, feature, support, and monetization signals.
3. Founder OS groups, summarizes, and prioritizes those signals.
4. The founder reviews and brainstorms the strongest ideas.
5. Approved ideas become product work.
6. Shipped improvements are connected back to the original user signals.

Do not treat user feedback as passive notes. Treat it as one of the main engines of product evolution.

## User Intelligence And Attribution

Founder OS should build a useful, product-relevant understanding of users across the ecosystem.

The goal is to know users well enough to improve service quality, personalize product experience, reduce risk, increase retention, and make relevant offers. Projects should capture the full useful context that is appropriate for the product relationship, including acquisition source, product activity, commercial behavior, support history, assistant interactions, risk signals, and value signals.

Examples of useful user intelligence:

- How the user arrived: link, campaign, referrer, channel, bot, product, landing page, timestamp, and first touch.
- What the user did: bookings, payments, cancellations, repeated workflows, failed attempts, feature usage, and account activity.
- Commercial context: booking count, payment amounts, plan, lifetime value, conversion stage, purchase intent, and upsell fit.
- Experience context: support issues, objections, confusion, satisfaction signals, feature requests, and churn risks.
- Assistant context: summaries, tags, needs, preferences, and product-relevant facts extracted from approved assistant interactions.

This is not a public talking point. Do not expose internal user intelligence, scoring, segmentation, risk labels, attribution mechanics, or cross-product analysis to external users.

Use product-appropriate and consent-safe language when asking for identity. Prefer soft phrasing such as:

"How would you like us to call you?"

or:

"How should we address you here?"

Avoid opening with blunt or unnecessary identity demands such as "What is your full legal name?" unless the specific workflow requires it.

Acquisition links and campaigns should be designed so Founder OS can understand where users came from and which funnels work. Preserve useful attribution metadata whenever possible.

## AI Usage Abuse Protection

Products with chat, AI assistants, paid model access, or knowledge workflows must protect Founder OS from proxy abuse.

Users must not be allowed to treat product assistants as a general-purpose ChatGPT, Google replacement, scraping tool, bulk content engine, or indirect way to use paid AI capacity outside the product's intended purpose.

Projects should detect and score abuse patterns, including:

- Repeated off-topic general knowledge requests unrelated to the product.
- Attempts to use the assistant as a generic search engine or homework/content factory.
- Prompt injection, jailbreak attempts, model/system prompt extraction, or requests for internal implementation details.
- High-volume usage with low product intent.
- Attempts to automate bulk queries through the assistant.
- Requests that appear designed to resell or proxy access to the assistant.

When abuse is suspected, the system should respond progressively:

1. Keep the user experience polite and product-focused.
2. Redirect the user back to supported product tasks.
3. Apply stricter rate limits or quotas.
4. Downgrade the user to a cheaper model when appropriate.
5. Mark the user with abuse, risk, and cost-control signals.
6. Notify the founder/admin for review when thresholds are crossed.
7. Temporarily suspend or ban access for repeated or severe abuse.

Never reveal internal abuse scores, thresholds, model-routing rules, or cost-control logic to the user. User-facing responses should stay simple: the assistant can help with the product, but cannot support unrelated or abusive use.

## User Feature Request Lifecycle

User experience and user feature requests are strategic product inputs.

Whenever a user's need, complaint, confusion, or suggestion becomes a feature request, the assistant or product flow should:

- Thank the user warmly.
- Say that the team appreciates the suggestion.
- Confirm that the idea will be considered.
- Use a friendly product-appropriate tone, including a small positive emotive marker when suitable.
- Create a structured feature signal for the Founder OS Feature Inbox.

Do not expose internal routing, Founder OS, project links, or roadmap mechanics in the user-facing reply. Keep the reply simple and human.

Suggested external response pattern:

"Thank you for the suggestion. The team really appreciates it, and we will think carefully about how this could improve the product 🙂"

When a user-requested feature is implemented, the project should:

- Notify relevant users when there is a safe and appropriate channel.
- Mention the improvement in release notes or changelog when public release notes exist.
- Preserve the link between the shipped improvement and the original feature signals so Founder OS can learn which user requests turned into value.

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
