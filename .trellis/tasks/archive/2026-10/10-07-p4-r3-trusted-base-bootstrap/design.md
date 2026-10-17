# Native deployment design

Baseline is freshly fetched main `c6db5da47d1b5d853a38032e1b676fb0cf2c013a`. Work on `codex/native-git-deployment-correction` in the existing isolated checkout; preserve unrelated root P2 work and historical evidence.

Vercel owns Git deployment, hosting, deployment history and recovery. GitHub owns source quality and optional portable artifact builds. KIRARI owns static-site composition, safe inputs, reproducibility and optional runtime features. Artifact provenance remains a build contract rather than release authorization.

Before deletion, trace all workflow/script/test/docs consumers. Preserve reusable composition and browser code; retire deployment-only C1, OIDC, raw policy gates, approval receipts, upload/stage/promote and release records. Update generated Vercel configuration through its owning generator, preserving routing/headers. Keep provider runtime adapters distinct from hosting controllers.

Project #1 is the roadmap source. Fresh exhaustive snapshots are evidence, not a new state database. Amend existing issue contracts, preserve historical accomplishments, and distinguish revised acceptance from retired machinery. P7 must require verified native Production project/environment/commit identity, never generic main CI; feature delivery remains deferred.

Read live Vercel identity, Git/root/build/output/ignore settings and deployment history without retaining environment values or credentials. Repository restoration can cause merge to publish automatically; prepare PR and cutover checklist, but do not merge or mutate live settings. Keep any current-main credential consumers until Owner cutover cleanup.
