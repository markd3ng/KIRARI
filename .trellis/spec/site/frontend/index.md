# `@kirari/site` Guidelines

`apps/site` is the Astro 6 static-site program. It owns application source,
routes, rendering, client islands, Markdown processing, and the build pipeline.
Profile-owned config/content/assets are copied into it before development,
checks, and builds.

## Guides

| Guide | Use for |
|---|---|
| [Directory Structure](./directory-structure.md) | Package ownership and generated boundaries |
| [Component Guidelines](./component-guidelines.md) | Astro components, Svelte islands, runtime DOM |
| [Hook Guidelines](./hook-guidelines.md) | Navigation lifecycle and browser initialization |
| [State Management](./state-management.md) | Build-time config and client state |
| [Type Safety](./type-safety.md) | TOML validation, content schemas, typed props |
| [Quality Guidelines](./quality-guidelines.md) | Build pipeline, styles, security, verification |

## Pre-Development Checklist

- Read `directory-structure.md` for any path under `apps/site`.
- Read `component-guidelines.md`, `hook-guidelines.md`, and
  `state-management.md` for UI or browser behavior.
- Read `type-safety.md` for config, content, routes, or external payloads.
- Read `quality-guidelines.md` before changing build scripts, Markdown plugins,
  search/SEO behavior, styles, or trusted snippets.
- Read `.trellis/spec/guides/index.md`.

Verified against `apps/site/package.json`, `astro.config.mjs`,
`src/content.config.ts`, `src/utils/config-loader.ts`, component call paths,
and build scripts.
