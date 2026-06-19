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
