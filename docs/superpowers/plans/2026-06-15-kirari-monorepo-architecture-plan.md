# KIRARI Monorepo Architecture Implementation Plan

## Summary

Migrate KIRARI from a single-package Astro project into a monorepo with clear ownership boundaries:

- `apps/site`: Astro site program layer.
- `packages/site-profile`: default content, configuration, brand assets, snippets, and demo profile.
- `workers/kirari-edge`: optional KIRARI edge runtime for proxy/cache/API enhancement features.

The migration must preserve the default user experience: a fresh fork should still be able to run `pnpm install`, `pnpm build`, and deploy Pages without enabling any Worker. Edge features are opt-in via boolean configuration.

## Target Architecture

```txt
KIRARI/
├── apps/
│   └── site/
├── packages/
│   └── site-profile/
├── workers/
│   └── kirari-edge/
├── docs/
│   ├── README.md
│   ├── QUICK_START.md
│   ├── MONOREPO_ARCHITECTURE.md
│   ├── SITE_PROFILE.md
│   ├── DEPLOYMENT_MATRIX.md
│   ├── CLOUDFLARE_PAGES.md
│   ├── VERCEL.md
│   ├── WORKERS.md
│   ├── CONTENT_SEPARATION.md
│   ├── MIGRATION_GUIDE.md
│   └── UPSTREAM_SYNC.md
├── package.json
└── pnpm-workspace.yaml
```

## Phase 0: Baseline And TDD Harness

- Extend `scripts/qa-regression-check.mjs` with red-light checks for the future monorepo shape:
  - `pnpm-workspace.yaml` exists.
  - `apps/site/package.json` exists.
  - `packages/site-profile/package.json` exists.
  - `workers/kirari-edge/package.json` exists.
  - monorepo architecture docs exist.
  - deployment matrix docs cover Cloudflare Pages, Vercel Pages, Pages plus Edge, and Pages first then Edge later.
  - profile materialization script does not contain `git add`, `git commit`, or `reset --hard`.
- Keep a root-level QA entrypoint so future callers can run `node scripts/qa-regression-check.mjs` from the repo root.
- Run red light:
  - `node scripts/qa-regression-check.mjs`
- Commit:
  - `test(qa): add monorepo architecture checks`

## Phase 1: Introduce Workspace Shell

- Add root `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "workers/*"
  - "packages/*"
```

- Change root `package.json` into a workspace orchestration package:
  - `name`: `kirari`
  - `private`: `true`
  - keep existing pnpm overrides.
  - add root scripts:
    - `site:dev`
    - `site:build`
    - `site:type-check`
    - `site:astro-check`
    - `edge:type-check`
    - `edge:test`
    - `edge:deploy:dry`
    - `edge:deploy`
    - `check`
    - `build`
- Do not move source yet in this phase.
- Verify:
  - `pnpm install --frozen-lockfile`
  - `pnpm build`
  - `pnpm check`
- Commit:
  - `refactor(repo): introduce workspace orchestration`

## Phase 2: Move Astro Site Into `apps/site`

- Move the current Astro site program into `apps/site`:
  - `src/`
  - `public/`
  - `scripts/`
  - `adapters/`
  - `astro.config.mjs`
  - `vercel.json`
  - `kirari.config.toml`
  - site-local docs that are tightly coupled to the site package.
- Add `apps/site/package.json`:
  - package name: `@kirari/site`
  - scripts:
    - `dev`
    - `build`
    - `astro`
    - `type-check`
    - `check`
    - `preview`
    - `audit`
    - `new-post`
- Update path assumptions in:
  - `apps/site/scripts/materialize-ghc-adapter.mjs`
  - `apps/site/scripts/postbuild.mjs`
  - `apps/site/scripts/qa-regression-check.mjs`
  - `apps/site/astro.config.mjs`
  - README and deployment docs.
- Keep root `scripts/qa-regression-check.mjs` as a wrapper that delegates to `apps/site/scripts/qa-regression-check.mjs`.
- Verify:
  - `pnpm --filter @kirari/site type-check`
  - `pnpm --filter @kirari/site astro check`
  - `pnpm --filter @kirari/site build`
  - `pnpm build`
  - `node scripts/qa-regression-check.mjs`
- Commit:
  - `refactor(site): move astro app into workspace`

## Phase 3: Extract Default Site Profile

- Add `packages/site-profile`, package name `@kirari/site-profile`.
- Move default site-owned identity into the profile package:
  - `kirari.config.toml` -> `packages/site-profile/kirari.config.toml`
  - `src/content/posts` -> `packages/site-profile/content/posts`
  - `src/content/spec` -> `packages/site-profile/content/spec`
  - `src/_data/friends.json` -> `packages/site-profile/data/friends.json`
  - `public/favicon` -> `packages/site-profile/assets/favicon`
  - `public/og` -> `packages/site-profile/assets/og`
  - `src/snippets` -> `packages/site-profile/snippets` if present.
- Add `apps/site/scripts/materialize-profile.mjs`.
- Materialization rules:
  - Copy only fixed whitelist mappings from `packages/site-profile` into `apps/site`.
  - Generate `apps/site/.kirari-profile-manifest.json`.
  - Refuse path traversal.
  - Do not execute git commands.
  - Do not write outside the approved profile-owned destinations.
- Approved mappings:

```txt
packages/site-profile/kirari.config.toml -> apps/site/kirari.config.toml
packages/site-profile/content/posts      -> apps/site/src/content/posts
packages/site-profile/content/spec       -> apps/site/src/content/spec
packages/site-profile/data/friends.json  -> apps/site/src/_data/friends.json
packages/site-profile/assets/favicon     -> apps/site/public/favicon
packages/site-profile/assets/og          -> apps/site/public/og
packages/site-profile/snippets           -> apps/site/src/snippets
```

- Update `@kirari/site` build:

```bash
node scripts/materialize-profile.mjs && node scripts/materialize-ghc-adapter.mjs && astro build && node scripts/postbuild.mjs
```

- Verify:
  - `node scripts/qa-regression-check.mjs`
  - `pnpm --filter @kirari/site type-check`
  - `pnpm --filter @kirari/site astro check`
  - `pnpm build`
- Commit:
  - `feat(profile): materialize site profile package`

## Phase 4: Add `kirari-edge` Worker Package

- Add `workers/kirari-edge`, package name `@kirari/edge`.
- Position it as the optional KIRARI Edge runtime for proxy, cache, and API enhancement features.
- Initial feature flags:
  - `githubCard`
  - `avatarProxy`
  - `bangumiApiProxy`
  - `bangumiImageProxy`
- Add TOML config shape:

```toml
[edge]
enabled = false
apiBase = ""

[edge.features.githubCard]
enabled = false

[edge.features.avatarProxy]
enabled = false

[edge.features.bangumiApiProxy]
enabled = false

[edge.features.bangumiImageProxy]
enabled = false
```

- Defaults:
  - edge disabled.
  - all edge features disabled.
  - pure Pages deployment works without Worker.
- Move or reuse existing GitHub Card adapter behavior as the initial `githubCard` edge feature.
- Keep `apps/site/scripts/materialize-ghc-adapter.mjs` for compatibility during the migration window.
- Add root scripts:
  - `edge:type-check`
  - `edge:test`
  - `edge:deploy:dry`
  - `edge:deploy`
- Verify:
  - `pnpm edge:type-check`
  - `pnpm edge:test`
  - `pnpm edge:deploy:dry`
  - `pnpm build`
- Commit:
  - `feat(edge): add kirari edge worker package`

## Phase 5: Connect Site To Optional Edge Features

- Update site config loading for `[edge]` and feature flags.
- Ensure `edge.enabled = false` keeps current site behavior unchanged.
- GitHub Card:
  - Prefer `edge.features.githubCard.enabled` and `edge.apiBase`.
  - Keep legacy `[githubCard.adapter]` for at least one compatibility cycle.
- Avatar proxy:
  - Rewrite avatar URLs only when `edge.enabled` and `edge.features.avatarProxy.enabled` are both true.
- Bangumi proxy:
  - Rewrite Bangumi API and image URLs only when their feature flags are true.
- Update `SECURITY_MODEL.md`:
  - Edge proxy is an optional trust boundary.
  - Visitor or third-party API data must still render via text/attribute-safe paths.
- Verify:
  - edge disabled build.
  - githubCard edge enabled route behavior.
  - avatarProxy disabled leaves URLs unchanged.
  - bangumi proxy disabled leaves behavior unchanged.
- Commit:
  - `feat(site): support optional edge feature routing`

## Phase 6: Deployment Matrix And One-Click Documentation

- Add docs:
  - `docs/README.md`
  - `docs/QUICK_START.md`
  - `docs/MONOREPO_ARCHITECTURE.md`
  - `docs/SITE_PROFILE.md`
  - `docs/DEPLOYMENT_MATRIX.md`
  - `docs/CLOUDFLARE_PAGES.md`
  - `docs/VERCEL.md`
  - `docs/WORKERS.md`
  - `docs/CONTENT_SEPARATION.md`
  - `docs/MIGRATION_GUIDE.md`
  - `docs/UPSTREAM_SYNC.md`
- Documentation format for deployment docs:
  - When To Use This
  - Prerequisites
  - One-Click Path
  - Manual Path
  - Environment Variables
  - Verification
  - Troubleshooting
- Deployment matrix must cover:
  - Cloudflare Pages only.
  - Vercel Pages only.
  - Cloudflare Pages plus Cloudflare Worker.
  - Vercel Pages plus Vercel Edge/Function.
  - Pages first, Worker later.
- Each deployment path must include:
  - platform root directory.
  - build command.
  - output directory.
  - required environment variables.
  - whether Worker is required.
  - how to enable Worker later.
- Commit:
  - `docs(deploy): add monorepo deployment matrix`

## Phase 7: Root-Level Deployment Presets

- Add root-level platform-friendly deployment entrypoints.
- Cloudflare Pages:
  - root build command: `pnpm build`
  - output directory: `apps/site/dist`
  - Worker not required.
- Vercel:
  - root build command: `pnpm build`
  - output directory: `apps/site/dist`
  - use root `vercel.json` to route/build the site package.
- Edge:
  - provide `workers/kirari-edge/wrangler.jsonc.example`.
  - document deploy command `pnpm edge:deploy`.
- Ensure fork users do not need to manually enter `apps/site` to deploy.
- Commit:
  - `chore(deploy): add root deployment presets`

## Phase 8: Migration Compatibility

- Add migration guide sections:
  - old single-package KIRARI to monorepo KIRARI.
  - moving existing posts/spec/data/assets into `packages/site-profile`.
  - Pages-only deployment after migration.
  - enabling `kirari-edge` later.
  - keeping downstream profile changes protected from upstream sync.
- Update `AGENTS.md`:
  - repo root is workspace root.
  - site code lives in `apps/site`.
  - profile-owned files live in `packages/site-profile`.
  - edge worker code lives in `workers/kirari-edge`.
  - config remains TOML-first.
  - default profile TOML is materialized before site build.
- Update `CREDITS.md`:
  - credit Mizuki docs/content-separation as an architectural reference.
  - state implementation is KIRARI-native monorepo architecture.
- Commit:
  - `docs: add monorepo migration guide`

## Phase 9: Final Verification

- Run:

```bash
pnpm install --frozen-lockfile
node scripts/qa-regression-check.mjs
pnpm check
pnpm build
pnpm --filter @kirari/site audit --audit-level moderate
pnpm edge:type-check
pnpm edge:test
```

- Browser QA:
  - `/`
  - `/blog/`
  - `/posts/markdown/`
  - `/friends/`
  - `/tags/`
  - `/search/`
  - RSS
  - sitemap
  - LLMs files
  - Pagefind search
- Deployment documentation review:
  - Cloudflare Pages only can deploy without Worker.
  - Vercel Pages only can deploy without Worker.
  - Edge disabled by default.
  - Edge feature enablement is documented as a second step.
- Final cleanup commit if needed:
  - `chore(repo): finalize monorepo migration`

## Commit Sequence

```txt
test(qa): add monorepo architecture checks
refactor(repo): introduce workspace orchestration
refactor(site): move astro app into workspace
feat(profile): materialize site profile package
feat(edge): add kirari edge worker package
feat(site): support optional edge feature routing
docs(deploy): add monorepo deployment matrix
chore(deploy): add root deployment presets
docs: add monorepo migration guide
chore(repo): finalize monorepo migration
```

## Assumptions

- Worker package name is `@kirari/edge`.
- Worker directory is `workers/kirari-edge`.
- Default fork experience is Pages-only.
- `packages/site-profile` is the default content/config/assets source.
- External content repository sync is not part of the default architecture.
- Legacy `[githubCard.adapter]` remains compatible for at least one version cycle.
- `pnpm build` must work from the repo root.
- Implementation must follow TDD: add red QA checks, implement minimal change, verify green.
