# KIRARI Monorepo Migration Review Checkpoints

## Architecture Boundary

- [ ] Root repository is a pnpm workspace.
- [ ] `apps/site` contains the Astro site program layer.
- [ ] `packages/site-profile` contains default profile-owned content, config, data, snippets, and assets.
- [ ] `workers/kirari-edge` contains optional edge runtime code.
- [ ] Root `package.json` only orchestrates workspace commands and does not contain site runtime dependencies.
- [ ] `@kirari/site`, `@kirari/site-profile`, and `@kirari/edge` package names are consistent across scripts and docs.
- [ ] Downstream projects can treat `apps/site` as upstream-syncable while keeping `packages/site-profile` protected.

## Profile Materialization

- [ ] `apps/site/scripts/materialize-profile.mjs` exists.
- [ ] Materialization uses a fixed whitelist of mappings.
- [ ] Materialization refuses path traversal.
- [ ] Materialization does not execute `git add`, `git commit`, `git reset`, or other git mutation commands.
- [ ] Materialization writes only profile-owned destinations.
- [ ] Materialization generates `apps/site/.kirari-profile-manifest.json`.
- [ ] A fresh checkout can build using the default `packages/site-profile`.
- [ ] Existing KIRARI content, spec pages, friends data, favicon, OG assets, and snippets are present after materialization.

## Site Package

- [ ] `apps/site/package.json` contains site-local scripts.
- [ ] `pnpm --filter @kirari/site build` succeeds.
- [ ] `pnpm --filter @kirari/site type-check` succeeds.
- [ ] `pnpm --filter @kirari/site astro check` succeeds.
- [ ] `apps/site/scripts/postbuild.mjs` still emits headers, redirects, robots, Pagefind, LLMs, and IndexNow behavior correctly.
- [ ] `apps/site/scripts/materialize-ghc-adapter.mjs` still works during the compatibility window.
- [ ] Root `node scripts/qa-regression-check.mjs` still works.

## Edge Worker

- [ ] `workers/kirari-edge/package.json` exists with package name `@kirari/edge`.
- [ ] Root scripts expose `edge:type-check`, `edge:test`, `edge:deploy:dry`, and `edge:deploy`.
- [ ] `pnpm edge:type-check` succeeds.
- [ ] `pnpm edge:test` succeeds.
- [ ] `pnpm edge:deploy:dry` succeeds or has documented local credential limitations.
- [ ] Edge runtime is optional and not required for a default Pages deployment.
- [ ] Initial edge features are represented as independent booleans:
  - [ ] `githubCard`
  - [ ] `avatarProxy`
  - [ ] `bangumiApiProxy`
  - [ ] `bangumiImageProxy`
- [ ] Disabled edge features leave current site behavior unchanged.

## Configuration And Compatibility

- [ ] `[edge]` and `[edge.features.*]` config fields are TOML-first.
- [ ] New config fields are synced through:
  - [ ] `packages/site-profile/kirari.config.toml`
  - [ ] `apps/site/src/types/config.ts`
  - [ ] `apps/site/src/utils/config-loader.ts`
  - [ ] README/README_CN/docs
- [ ] Legacy `[githubCard.adapter]` remains supported for at least one version cycle.
- [ ] `edge.enabled = false` is the default.
- [ ] All edge feature flags default to false.
- [ ] Site build does not require Worker environment variables when edge is disabled.

## Deployment Matrix

- [ ] Docs cover Cloudflare Pages only.
- [ ] Docs cover Vercel Pages only.
- [ ] Docs cover Cloudflare Pages plus Cloudflare Worker.
- [ ] Docs cover Vercel Pages plus Vercel Edge/Function.
- [ ] Docs cover Pages first, Worker later.
- [ ] Each deployment path specifies:
  - [ ] root directory
  - [ ] build command
  - [ ] output directory
  - [ ] required environment variables
  - [ ] whether Worker is required
  - [ ] verification command or smoke test
- [ ] Fresh fork path is clear without reading architecture docs first.
- [ ] Worker enablement path is clear as a second step after Pages deployment.

## Documentation Quality

- [ ] `docs/README.md` acts as an index.
- [ ] `docs/QUICK_START.md` gives the shortest successful fork-to-build path.
- [ ] `docs/MONOREPO_ARCHITECTURE.md` explains program/profile/edge boundaries.
- [ ] `docs/SITE_PROFILE.md` explains what belongs in `packages/site-profile`.
- [ ] `docs/DEPLOYMENT_MATRIX.md` compares supported deployment modes.
- [ ] `docs/MIGRATION_GUIDE.md` explains old single-package to monorepo migration.
- [ ] `docs/UPSTREAM_SYNC.md` explains downstream sync boundaries.
- [ ] `AGENTS.md` reflects the new monorepo layout and ownership boundaries.
- [ ] `CREDITS.md` credits Mizuki docs/content-separation as reference material.

## Security And Trust Boundaries

- [ ] Profile materialization cannot write outside approved paths.
- [ ] External API data continues to render via text/attribute-safe paths.
- [ ] Edge proxy behavior is documented as an optional trust boundary.
- [ ] Comments, Bangumi data, and other third-party content are not fed into trusted `set:html`.
- [ ] No script sync step automatically commits or stages files.
- [ ] Worker secrets are documented as deployment environment variables, not committed config.

## Build And QA Verification

- [ ] `pnpm install --frozen-lockfile` succeeds.
- [ ] `node scripts/qa-regression-check.mjs` succeeds.
- [ ] `pnpm check` succeeds.
- [ ] `pnpm build` succeeds from repo root.
- [ ] `pnpm --filter @kirari/site audit --audit-level moderate` succeeds.
- [ ] `pnpm edge:type-check` succeeds.
- [ ] `pnpm edge:test` succeeds.
- [ ] Browser QA covers:
  - [ ] `/`
  - [ ] `/blog/`
  - [ ] `/posts/markdown/`
  - [ ] `/friends/`
  - [ ] `/tags/`
  - [ ] `/search/`
  - [ ] RSS
  - [ ] sitemap
  - [ ] LLMs files
  - [ ] Pagefind search

## Regression Risks To Review Manually

- [ ] Relative paths in Astro config still resolve after moving to `apps/site`.
- [ ] Post cover image paths still resolve for file posts and folder posts.
- [ ] Pagefind output remains under `apps/site/dist/pagefind`.
- [ ] Sitemap URLs still respect `site.url` and `site.base`.
- [ ] GitHub Pages, Cloudflare Pages, and Vercel docs use correct output path `apps/site/dist`.
- [ ] Root-level deploy presets do not conflict with site-local deploy presets.
- [ ] Untracked local files such as `.codegraph/daemon.pid`, audit reports, and `tmp/` are not committed accidentally.
