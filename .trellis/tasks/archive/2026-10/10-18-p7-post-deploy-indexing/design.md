# Design — P7 post-deploy indexing

1. Remove network submission from `postbuild.mjs`; retain build-time static IndexNow key-file generation for the public verification key only.
2. Add one GitHub workflow subscribed to `repository_dispatch: vercel.deployment.success`, with read-only contents and narrowly scoped commit-status write. Validate the Vercel bot sender and fixed repository/project/environment/ref/SHA/alias fields, then GET only the fixed canonical origin and require its served commit marker to match.
3. Run a small Node entry point from the default-branch workflow source. Read the event file, Site TOML and deployed sitemap. Do not execute scripts from the event SHA. Bound bytes, redirects, timeouts, URL count and outbound hosts.
4. Gate IndexNow on an explicit repository variable and existing Site config/key. Record each attempt as a GitHub commit status under a concurrency group; success and fresh pending work suppress replays, and at most three provider attempts are allowed per commit. Never automatically retry provider requests.
5. Keep Google Indexing API submission disabled until Owner confirms eligible `JobPosting` or `BroadcastEvent` content. Continue to accept the existing config schema for compatibility, but make no Google network calls.

Expected edits: `apps/site/scripts/indexing.mjs`, `postbuild.mjs`, `Layout.astro` build-commit marker, Site tests and test fixtures; new GitHub workflow and post-deploy entry point; README, Chinese README, SECURITY_MODEL, Site production/quality documentation; P7 Trellis task/evidence. No dependency, Vercel project, secret or Production mutation.
