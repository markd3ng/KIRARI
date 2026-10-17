# P7 #100 — Notify indexing after verified native Production

## Goal

Only send explicitly enabled IndexNow notifications after the exact KIRARI native Production commit has reached the canonical domain. Keep builds, Preview, local/test modes, and external-Site builds silent regardless of flags. Keep Google Indexing API submissions disabled until approved eligible content exists.

## Acceptance criteria

- Postbuild never sends IndexNow or Google requests, including when legacy submission flags are true.
- A GitHub-native, authenticated Vercel deployment signal is accepted only for `markd3ng/KIRARI`, Vercel project `kirari-main` / `prj_QNMVdxTkPOad4ynN4fwFCYEST8Jk`, successful Production on `main`, matching canonical alias, and a valid commit SHA.
- Before any provider request, a fresh public canonical response must identify that exact SHA as served.
- IndexNow requires independent explicit enablement and an available public key. Default path emits no provider requests.
- Google Indexing API stays disabled; ordinary blog pages are never sent.
- Sitemap URL parsing is same-origin, de-duplicated, and bounded. Provider errors have bounded requests and an observable result. Per-commit status history limits provider attempts to three, preventing repeated deployment-event replays from causing unbounded submissions.
- Tests cover event/source rejection, build/Preview silence, canonical commit mismatch, malformed or oversized sitemap, token/config leaks, provider error and replay behavior.
- No production/provider settings, credentials, or deployment changes are made by this task.

## Decisions and limits

Use Vercel's GitHub `repository_dispatch` event `vercel.deployment.success`; validate its sender and payload plus live canonical serving. The event payload contains project ID/name, environment, Git ref/SHA, deployment ID/state, URL and optional aliases; it does not expose Team ID. Pin the already approved globally unique project ID and confirm the canonical served SHA. Do not add a Vercel API credential to CI to fill this field.

IndexNow and eligible Google content have not been approved for provider enablement. Implement both provider paths default-off; retain Google off until an Owner decision and eligibility proof. The delivery can be code-ready with live submissions still disabled.
