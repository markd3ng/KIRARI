# Quality Guidelines

## Build Reality

`@kirari/site` commands first materialize the profile. Production build order:

1. `materialize-profile.mjs`
2. `materialize-ghc-adapter.mjs`
3. `astro build`
4. `postbuild.mjs`

Postbuild runs seven ordered actions: generate headers/redirects, generate
robots metadata, obfuscate mailto links, conditionally build Pagefind, generate
LLM files, optionally submit IndexNow, and optionally submit Google Indexing
API notifications. Read the script before changing the list; old docs contain
shortened summaries.

## Scenario: External Site Build POC

### 1. Scope / Trigger
- Trigger: local `./build.sh --site <directory>` composes owner input into `apps/site/dist`.
- The no-argument command and `pnpm build` retain the default `packages/site-profile` flow.

### 2. Signatures
- `./build.sh` → default `pnpm build`.
- `./build.sh --site <directory>` → `node scripts/build-external-site.mjs <directory>`.
- `pnpm site:profile:check -- --site <directory>` validates external input without writing it.
- `pnpm site:test` runs Node built-in tests for materialization, QA guard, and external output.

### 3. Contracts
- The authoritative source-to-target map is `apps/site/scripts/profile-manifest.mjs` (`PROFILE_MAPPINGS`).
- Required: `kirari.config.toml`; `content/spec/{about,friends,projects}.md`; `data/friends.json` (array of objects with string `siteTitle`, `siteDesc`, `siteUrl`, `siteIcon`); `assets/images/{demo-avatar,demo-banner}.png`; eight `assets/favicon/favicon-{light,dark}-{32,128,180,192}.png`; `assets/og/default.png`.
- Optional: `content/posts/`, `data/devices.json`, `assets/images/devices/`, `snippets/`, `ads.txt`. Absent optional directories become empty; absent optional files are removed from generated output.
- `KIRARI_SITE_SOURCE` selects the profile during the copied app build. Indexing submissions require `KIRARI_ALLOW_INDEXING_SUBMISSIONS=true`; `KIRARI_BUILD_ONLY=true` and `NODE_ENV=test` each veto both postbuild submission paths. The external builder sets build-only mode and does not pass the authorization variable to the child.
- The input root must resolve to a directory disjoint from `apps/site`; mapped inputs must be regular files/directories with no symlinks or special files. Materialization validates and stages the input without using the original Site Source as a write target. Successful external build replaces only `apps/site/dist`, with rollback on replacement failure.
- This is not an OS sandbox or enforced read-only source. MDX and other build-time code can execute with the invoking user's filesystem and network permissions. Snippets are loaded as raw text and emitted as browser-executable HTML/JavaScript; they are trusted owner code, but current code does not run snippet JavaScript in the Node build process. Environment filtering does not isolate filesystem access.
- This is a local static build. It does not fetch Git refs, mutate Git, deploy, or package `functions/` alongside `dist`.
- The workflow-independent contract is also recorded in `docs/EXTERNAL_SITE_BUILD.md` so future engineering-guide changes do not make the POC assumptions disappear.

### 4. Validation & Error Matrix
| Condition | Result |
|---|---|
| Missing required mapping or required child | Fail before materialization with source → target path |
| Invalid TOML/JSON, wrong type, symlink, special file, or overlapping source/target | Fail; do not replace generated mappings |
| Missing optional directory | Materialize an empty directory to prevent stale content |
| External Astro build fails | Preserve previous `apps/site/dist` |
| External build succeeds | Install its static `dist` as `apps/site/dist` |
| Next invocation finds a stale publication stage | Restore its backup if `dist` is absent; otherwise keep installed `dist`; remove the stale stage |
| Concurrent builds target the same `dist` | Serialize recovery and publication with a destination-keyed filesystem ticket; reclaim only a verified dead owner |
| External builds target different `dist` paths | Allow independent builds; each recovers only its SHA-256-keyed build temp roots |
| QA regression script sees `KIRARI_SITE_SOURCE` | Exit 2; demo-only assertions are not run |

### 5. Good/Base/Bad Cases
- Good: external fixture with valid required files and a custom article builds without changing its source; custom output contains it and omits demo posts.
- Base: no `--site` argument uses the unchanged default profile.
- Bad: missing `friends.json`, symlinked input, invalid config, source/destination overlap, failed copy, or unreviewed executable Site content (which is outside this trust model).

### 6. Tests Required
- `node --test apps/site/scripts/tests/*.test.mjs` asserts required/optional inputs, types, symlinks, staged replacement/rollback, stale-stage recovery, and demo-QA refusal.
- `pnpm site:test` additionally compares default and equivalent external routes/metadata/assets; custom fixture assertions check route presence, demo-route absence, and verify build-only/test indexing vetoes with both integrations enabled and dummy credentials.
- Run `pnpm site:profile:check -- --site <fixture>`, `pnpm profile:check`, `node apps/site/scripts/qa-regression-check.mjs`, `pnpm site:type-check`, `pnpm site:astro-check`, `pnpm build`, and `git diff --check` for the affected change.

### 7. Wrong vs Correct
#### Wrong
```bash
./build.sh --site ../site && pnpm deploy
```
#### Correct
```bash
./build.sh --site /absolute/path/to/site
```
Review `apps/site/dist` locally; deployment remains a separate authorized workflow.

`materialize-ghc-adapter.mjs` reads the materialized TOML before Astro builds.
It first removes generated adapter route directories from site and deployment
roots, but refuses to remove non-generated directories unless a file contains
the `@kirari-generated-ghc-adapter` marker. Disabled adapters generate nothing.
Provider `auto` resolves from `VERCEL=1`, `CF_PAGES=1`, or `PAGES=1`; an enabled
adapter with no hosted provider fails the build. Cloudflare output is
`<deploy-root>/functions/<route>/[[path]].ts`; Vercel output is
`apps/site/api/<route>/[...path].ts`. Routes must be one safe path segment and
service binding names must be valid JavaScript identifiers.

## Markdown And Styles

Plugin order in `astro.config.mjs` is behavior. Preserve the exact current
sequence unless a verified parser/rendering requirement calls for a change.

Remark:

1. `remarkMath`
2. `remarkReadingTime`
3. `remarkExcerpt`
4. `remarkGithubAdmonitionsToDirectives`
5. `remarkDirective`
6. `remarkSectionize`
7. `parseDirectiveNode`
8. `remarkPlantuml`

Rehype:

1. `rehypeKatex`
2. `rehypeMermaidPreProcess`
3. `rehypePlantuml`
4. `rehypeSlug`
5. `rehypeLazyLoadImage`
6. `rehypeTableWrapper`
7. `rehypeComponents`
8. `rehypeAutolinkHeadings`

Use Tailwind/CSS for component appearance. Use `markdown-extend.styl` for
Markdown-generated deep DOM. Do not assume scoped Astro CSS styles nodes
created by browser scripts.

## Verification

Run from the workspace root:

```bash
node apps/site/scripts/qa-regression-check.mjs
pnpm site:type-check
pnpm site:astro-check
pnpm build
pnpm release:check
node apps/site/scripts/generate-vercel-config.mjs --check
```

CI additionally runs edge checks, release version checks, audit, and
`git diff --check`. Use pnpm and Node `>=22.12.0`.

Repository-wide commit, release, and documentation rules live in
`.trellis/spec/guides/repository-workflow.md`.

## Scenario: Main-Branch Vercel Git Deployment Guard

### 1. Scope / Trigger
- Applies to Vercel projects linked to this repository when Git commits arrive on `main`.

### 2. Signatures
- `createVercelConfig(config)` in `apps/site/scripts/security-policy.mjs` generates root `vercel.json`.
- `git.deploymentEnabled` is a Vercel branch-name-to-boolean map.

### 3. Contracts
- `main: false` suppresses automatic Git deployments from `main`; unspecified branches retain Vercel's enabled default.
- Keep the rule in the generator and regenerate `vercel.json`; do not edit only the generated copy.
- This setting does not change Vercel project settings, domains, environment variables, aliases, or manual deployment/promotion behavior.

### 4. Validation & Error Matrix
| Condition | Result |
|---|---|
| Generated JSON differs from `createVercelConfig` | `pnpm deploy:config:check` fails |
| `main` is enabled or another branch override is added | QA regression check fails |
| Vercel deployment appears for a guarded `main` SHA | Stop; do not merge the dependent release PR |

### 5. Good/Base/Bad Cases
- Good: `main` is the only explicit branch rule and is `false`.
- Base: `dev`, `test`, and other unspecified branches retain Vercel's default behavior.
- Bad: editing only generated `vercel.json`, disabling all branches, or adding overrides for `dev` / `test`.

### 6. Tests Required
- QA regression check asserts that `main` is the sole branch override and is `false`.
- Run `pnpm deploy:config:check`, validate the current Vercel JSON Schema, and read back deployments for every linked project after the guard reaches `main`.

### 7. Wrong vs Correct
#### Wrong
Edit `vercel.json` alone; generation checks will report drift and a later regeneration will drop the guard.

#### Correct
Update `createVercelConfig`, regenerate `vercel.json`, and verify that only `main` is disabled.
