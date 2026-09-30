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
