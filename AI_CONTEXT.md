# KIRARI AI Context

This project is an Astro 6.3 SSG-first blog theme. Treat `.astro` pages,
layouts, and static components as the default. Do not turn the site into a SPA,
do not add a client runtime for content that can render statically, and do not
rewrite Astro islands as React-style app shells.

## Hard Constraints

- Preserve the SSG-first rendering model. Do not introduce SSR, middleware,
  Actions, Server Islands, or a new adapter unless a task explicitly asks for it.
- Preserve the config pipeline:
  `kirari.config.toml` -> `src/types/config.ts` -> `src/utils/config-loader.ts`
  -> `Config` -> `@config` section exports.
- Search and Theme Toggle hydrate with `client:idle`.
- Display Settings uses `client:only="svelte"` because it reads `localStorage`.
- SEO-critical content must stay in `.astro` output and must not depend on
  client hydration.
- Post-navigation DOM initialization must use `transitionManager`, not
  `DOMContentLoaded`.
- The Markdown plugin order in `astro.config.mjs` is intentional. Do not reorder
  it casually.
- `set:html` is allowed only for trusted maintainer config/snippet input and
  generated structured data.

## Forbidden Patterns

- Adding `client:load` to static content without a measured interaction need.
- Moving navigation, post cards, metadata, RSS, or canonical content into a
  client-only island.
- Importing Node.js builtins from client code or Edge-compatible runtime code.
- Bypassing `kirari.config.toml` for new public settings.
- Feeding visitor, comment, CMS, or other untrusted user input into `set:html`.
- Deleting seemingly duplicated transition or language logic without checking
  the related architecture docs.

## Expected Verification

Run the full chain after dependency, Astro integration, hydration,
`config-loader`, build, or postbuild changes:

```bash
pnpm install --frozen-lockfile
pnpm type-check
pnpm astro check
pnpm build
pnpm audit --audit-level moderate
```

