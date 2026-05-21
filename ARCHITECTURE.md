# KIRARI Architecture

KIRARI is an Astro 6.3 SSG-first blog theme. The main architectural goal is to
ship static HTML for content and metadata, then hydrate only the few controls
that need browser state.

## Rendering Strategy

- Default output is static HTML from Astro.
- SSR, middleware, Actions, Server Islands, and adapters are not part of the
  current runtime contract.
- Post pages, archives, navigation, metadata, RSS, sitemap, and SEO output must
  remain server/build-rendered.
- Client islands are reserved for search, theme controls, and display settings.

## Astro Islands

| Component | Hydration | Reason |
|---|---|---|
| Static `.astro` components | none | Content, layout, metadata, and navigation render at build time |
| `Search.svelte` | `client:idle` | Interactive search can wait until the browser is idle |
| `ThemeToggle.svelte` | `client:idle` | Theme interaction is useful but not SEO-critical |
| `DisplaySettings.svelte` | `client:only="svelte"` | Reads `localStorage` and should not render SEO-critical content |

## Configuration Pipeline

```text
kirari.config.toml -> smol-toml -> config-loader.ts -> Config singleton
                             ^                 |
                             |                 v
                    PUBLIC_* env vars   @config section exports
```

Every new public config field must be added to the TOML template, the TypeScript
config types, and `config-loader.ts` with defaults and validation.

## Transition System

`src/utils/transition-manager.ts` exposes a unified event API over Astro
`ClientRouter` and the Swup fallback. Code that initializes DOM behavior after
navigation must register on `transition:after-swap`.

## Markdown Pipeline

The remark chain parses math, reading time, excerpts, GitHub admonitions,
directives, sections, and custom directive nodes. The rehype chain renders KaTeX,
Mermaid placeholders, heading slugs, lazy images, custom components, and heading
anchors. The order is a dependency chain, not a formatting preference.

## Build Pipeline

```text
materialize-ghc-adapter.mjs -> astro build -> postbuild.mjs
```

`postbuild.mjs` generates platform headers/redirects, `robots.txt`, mailto
obfuscation, Pagefind or DocSearch behavior, `llms.txt`, and optional IndexNow
submission.

