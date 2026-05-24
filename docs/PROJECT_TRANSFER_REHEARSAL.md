# Project Transfer Rehearsal

Use this checklist before routing a real founder-owned project through Founder OS.

## Goal

Create one repeatable, sanitized evidence artifact that proves a project can be imported, configured, connected, and checked without exposing plaintext provider keys or raw user content.

## Prerequisites

- Founder OS deployed behind Cloudflare Access or Tailscale.
- Postgres migrations deployed with `npm run prisma:migrate:deploy`.
- Production launch gate passing:

```powershell
npm run deployment:check -- --production --base-url https://<founder-os-host> --token <FOUNDER_OS_ADMIN_TOKEN>
```

- Optional sanitized deployment evidence path:

```powershell
npm run deployment:check -- --production --base-url https://<founder-os-host> --token <FOUNDER_OS_ADMIN_TOKEN> --write-report C:\Repos\<project>\.founderos\deployment-report.json
```

- A project manifest at `<project>\.founderos\project.json`.
- A setup file at `<project>\.founderos\ai-setup.json`.
- Provider keys stored only in the deployment secret store. The setup file must use `secretRef` values, not plaintext keys.

## Dry Run

Preview the transfer without writing to Founder OS:

```powershell
npm run projects:transfer -- --dry-run --root C:\Repos --setup-config C:\Repos\<project>\.founderos\ai-setup.json --base-url https://<founder-os-host> --token <FOUNDER_OS_ADMIN_TOKEN>
```

Confirm the output references:

- `/api/projects/bulk-import`
- `/api/projects/ai-setup`
- `/api/projects/connection`
- the expected `projectKey`
- the expected `assistantKey`

## Rehearsal Run

Run the transfer and write the sanitized report plus launch evidence snapshot:

```powershell
npm run projects:transfer -- --root C:\Repos --setup-config C:\Repos\<project>\.founderos\ai-setup.json --base-url https://<founder-os-host> --token <FOUNDER_OS_ADMIN_TOKEN> --write-report C:\Repos\<project>\.founderos\transfer-report.json --write-launch-evidence C:\Repos\<project>\.founderos\launch-evidence.json
```

The report includes:

- generated timestamp
- import, setup, and connection endpoints
- project and assistant keys
- manifest import result
- AI setup provider, default model, budget, and token policy
- connection bundle result
- readiness state and missing steps

The report excludes:

- plaintext provider keys
- raw prompts
- raw conversations
- raw provider invoices
- bearer tokens

The launch evidence artifact captures the matching `/api/projects/launch-evidence` response with stricter sanitization that removes bearer tokens, plaintext keys, and `secretRef` values.

## Acceptance

Before production traffic, confirm:

- `deployment-report.json` exists if `--write-report` was used.
- `transfer-report.json` exists.
- `launch-evidence.json` exists.
- The deployment report has `ready: true` and no bearer token, plaintext key, password, or `secretRef` values.
- `readiness.ready` is `true`, or every `readiness.missing` item has an owner and fix plan.
- `secretRef` values point to real deployment secrets.
- `/api/token-policy` has a project or assistant policy for the transferred project.
- `/api/token-usage/summary` is expected to show data after the connected product starts reporting usage.
- `/api/provider-spend/import` has a source plan for provider billing exports.
- `launch-evidence.json` has `ready: true`, or every `launchBlockers` item has an owner and fix plan.

Keep the report with launch notes. It is the replayable proof that the first project transfer is ready or shows exactly what remains blocked.
