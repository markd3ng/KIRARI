# Vercel Deployment

Connect the repository using Vercel's native Git integration. Vercel owns Preview
and Production orchestration; GitHub Actions runs source checks and optional
portable artifact builds.

## Project Settings

|Setting|Value|
|---|---|
|Root directory|Repository root (empty or `.`)|
|Framework|Astro; verify the existing project's effective configuration|
|Install command|`pnpm install --frozen-lockfile`|
|Build command|`pnpm build`|
|Output directory|`apps/site/dist`|
|Production branch|`main`|

Use Node.js matching root `package.json` and the pinned pnpm `packageManager`.
Keep feature branches eligible for native Preview. Verify ignored-build settings
and dashboard overrides before cutover. The generated repository-root `vercel.json`
preserves search rewrites, immutable asset caching and security headers. Run
`node apps/site/scripts/generate-vercel-config.mjs --check` when changing provider
URLs or security-sensitive feature configuration.

Ordinary static hosting needs no deployment token in GitHub CI. Optional runtime
integrations may need provider-scoped secrets; isolate them by environment and
never place private credentials in public Site configuration. Optional Gateway
adapters do not replace native Site hosting.

## Verify And Recover

Verify the actual Production project/environment, commit, READY deployment,
canonical serving domain and browser routes/search/RSS/assets. Green CI or Preview
alone is insufficient. Indexing stays disabled by default and requires verified
Production evidence before opt-in notifications.

See [Site Production](./SITE_PRODUCTION.md) for native acceptance and recovery.
For the architecture correction, merging the candidate may trigger Production;
await the separately scoped Owner cutover decision. No custom manual uploader,
C1 manifest or Trusted Sources raw policy readback is needed to review that PR.
