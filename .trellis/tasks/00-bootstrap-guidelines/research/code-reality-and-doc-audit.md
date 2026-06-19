# Code Reality And Documentation Audit

Date: 2026-06-19

This audit uses current package-qualified Codegraph findings, source, manifests,
CI/config, and tests. Markdown is classified only after comparison with those
sources. No files are proposed for automatic deletion.

## Current Code Reality Map

### `apps/site`

- Astro 6 SSG package with parallel default and language-prefixed routes.
- Build-time config is eagerly loaded from materialized TOML, runtime-validated,
  and exposed as a singleton plus compatibility section exports.
- Profile materialization clears and copies whitelisted config, content, data,
  assets, and snippets before dev/check/build commands.
- Current islands include `client:idle`, `client:only`, and `client:load`
  consumers; the older “only three islands” statement is false.
- Astro `ClientRouter` is primary and Swup is a dynamic unsupported-browser
  fallback behind `transitionManager`.
- Markdown processing includes PlantUML and table wrapping omitted by several
  docs.
- Production build is materialize profile → materialize GitHub-card adapter →
  Astro build → postbuild.

### `workers/kirari-edge`

- One stateless Cloudflare Worker module with four fixed proxy prefixes.
- Master and feature switches are Worker environment strings, not TOML reads.
- Only GET, HEAD, and matched-route OPTIONS are supported.
- Request credentials are stripped; optional GitHub auth comes from a Worker
  secret.
- No KV, D1, Cache API, Durable Object, health route, or persistence exists.
- Node built-in tests cover disablement, route flags, CORS, methods, each proxy,
  prefix stripping, credential stripping, cache headers, and upstream failure.

### `packages/site-profile`

- File-based default profile; not an importable code library.
- Owns TOML, posts/spec pages, friends/devices JSON, device/favicon/OG assets,
  and trusted snippets.
- Materialized site copies currently match the profile inputs checked in this
  audit.

## Documentation Classification

### Current

- `.trellis/workflow.md` and Trellis platform files: current workflow machinery,
  not product architecture.
- `CHANGELOG.md`: current historical release record.
- `.github/pull_request_template.md`: current contribution template.
- `docs/README.md`, `docs/QUICK_START.md`, `docs/MONOREPO_ARCHITECTURE.md`,
  `docs/CLOUDFLARE_PAGES.md`, `docs/VERCEL.md`: broadly match current workspace
  commands and deployment output. Minor omissions should be folded into future
  doc maintenance, not treated as architecture authority.
- Content under `packages/site-profile/content/`: current default profile
  content.
- `packages/site-profile/snippets/README.md`: current trusted-snippet boundary.

### Partially Current

- `README.md`, `README_CN.md`: strong config/deployment coverage, but island
  counts and Markdown plugin lists are stale; some displayed dependency
  versions lag manifests.
- `CONTRIBUTING.md`: commands and broad constraints are current; hydration and
  navigation rules are over-generalized and omit active `client:load` islands.
- `SECURITY_MODEL.md`: trusted snippets and public-env guidance are current;
  edge text incorrectly claims legacy URL allow-listing and blurs proxying with
  rendering.
- `docs/SITE_PROFILE.md`: mapping omits `data/devices.json` and
  `assets/images/devices/`.
- `docs/CONTENT_SEPARATION.md`: ownership model is current but the mapping is
  incomplete.
- `docs/WORKERS.md`: route purpose and deploy commands are current, but it does
  not document the required Worker environment flags or their separation from
  TOML.
- `docs/MIGRATION_GUIDE.md`: useful but omits newer devices mappings and uses
  non-frozen install in verification.
- `docs/UPSTREAM_SYNC.md`: useful workflow, but “upstream profile changes are
  additive” is not guaranteed by Git.
- `apps/site/src/snippets/README.md`: current duplicate generated from the
  profile source.

### Outdated

- `KIRARI_CODE_AUDIT_2026-06-13.md`: point-in-time findings; several are now
  guarded by release regression checks or changed implementations. Retain as
  dated evidence only.

### Conflicting

- `DEPLOY.md`: the static deployment sections are mostly useful, but the
  GitHub-card Worker section describes KV, health endpoints, scripts, names,
  and commands not present in `workers/kirari-edge`.
- `docs/DEPLOYMENT_MATRIX.md`: “Vercel Pages + Edge Function” conflates the
  generated GitHub-card adapter with the Cloudflare-only `@kirari/edge` Worker.
- Previous `AGENTS.md`: claimed only three islands, named a nonexistent
  `ThemeToggle.svelte`, omitted current Markdown plugins, and duplicated
  project guidance now owned by Trellis specs.

### Duplicate

- `apps/site/src/content/**`, `apps/site/src/_data/**`,
  `apps/site/src/snippets/**`, and mapped public assets are generated copies of
  `packages/site-profile/**`.
- `.opencode/skills/**` and `.reasonix/skills/**` duplicate Trellis skill
  bundles for other hosts. Their lifecycle is Trellis-managed.
- `README.md` and `README_CN.md` are intentional language variants, not delete
  candidates.

### Archive Candidates

- `docs/superpowers/plans/2026-06-15-kirari-monorepo-architecture-plan.md`
- `docs/superpowers/plans/2026-06-15-kirari-monorepo-review-checkpoints.md`
- `KIRARI_CODE_AUDIT_2026-06-13.md`
- `tmp/Firefly-Docs/index.md`, `tmp/Firefly/*.md`, `tmp/Mizuki/*.md`

These are useful historical records but should be clearly separated from live
guidance.

### Delete Candidates

- None approved.
- Tracked `.DS_Store` files under `packages/site-profile` are cleanup
  candidates, but require explicit confirmation because this task forbids
  automatic deletion.

## Unresolved Conflicts And Manual Confirmation

1. Decide whether `tmp/Firefly`, `tmp/Mizuki`, and their docs are intentional
   long-term comparison fixtures or should move to an archive outside the live
   source/index.
2. Decide whether to rewrite or retire the obsolete GitHub-card/KV section in
   `DEPLOY.md`; it currently describes a different Worker than
   `workers/kirari-edge`.
3. Confirm the production process for translating profile `[edge]` flags into
   `KIRARI_*` Worker variables. No automatic bridge was found.
4. Decide whether `docs/DEPLOYMENT_MATRIX.md` should distinguish the generated
   GitHub-card adapter from the optional Cloudflare Worker.
5. Confirm whether root `README.md`/`README_CN.md` remain the canonical user
   manuals or should be reduced in favor of focused `docs/` pages.
6. Confirm deletion of tracked `.DS_Store` files separately.

## Inventory Scope

Inventoried:

- 9 root Markdown files, including `AGENTS.md`.
- 13 files under `docs/`.
- 38 Markdown files under `.trellis/` after this audit note was added.
- 140 Trellis host/skill Markdown files under `.agents`, `.opencode`, and
  `.reasonix`.
- 1 GitHub Markdown template.
- 24 profile Markdown/MDX files and their 24 materialized site counterparts.
- 112 historical Markdown/MDX files under `tmp/`.

The package content files are classified by ownership/group because each
materialized file has an exact profile counterpart; individual article
editorial accuracy was outside this architecture bootstrap.
