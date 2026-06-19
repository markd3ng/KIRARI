# State Management

There is no application-wide client store. State is deliberately split by
lifetime:

- Build-time global config: `Config`, created once in `src/constants.ts`.
- Backward-compatible section exports: `src/config.ts`.
- Route/component data: Astro props and content collection entries.
- Island-local UI state: Svelte 5 runes.
- Persistent display preferences: `localStorage` through
  `src/utils/setting-utils.ts`.
- Navigation lifecycle: the `transitionManager` singleton.

Keep state local unless multiple current consumers need the same mutable value.
Do not add a store, context provider, or event bus speculatively.

Theme mode and hue are applied to `<html>` before paint in `Layout.astro` and
then managed by settings utilities/islands. New persisted settings need a
defined default, initial-paint behavior when visible, and navigation-safe
restoration.

Search selects one effective provider. Pagefind is the fallback; DocSearch and
Google are active only when their required config is complete.

Provider resolution must remain consistent in `astro.config.mjs`,
`Layout.astro`, `Navbar.astro`, `Search.svelte`, search routes, and
`scripts/postbuild.mjs`. A complete external provider disables Pagefind
preloading/index generation; incomplete DocSearch or Google configuration
falls back to Pagefind.

Search and SEO changes must preserve static output. Keep normal provider
settings TOML-first, keep credentials in appropriate environment/platform
configuration, and update `packages/site-profile/kirari.config.toml`,
`README.md`, `README_CN.md`, and `SECURITY_MODEL.md` with the runtime/build
change.
