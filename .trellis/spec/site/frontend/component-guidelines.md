# Component Guidelines

Default to `.astro` for routes, layouts, navigation, cards, and content that can
render at build time. Add Svelte only for real client state.

Current hydrated islands are:

- `Search.svelte` and `LightDarkSwitch.svelte`: `client:idle` in `Navbar.astro`.
- `DisplaySettings.svelte`: `client:only="svelte"` because its initial state
  reads browser storage.
- `DevicesFilter.svelte` and `PostSponsor.astro`'s Svelte child:
  `client:load` for immediately interactive page features.

Do not describe the site as having only three islands. Preserve the directive
already chosen unless measured UX or correctness requires a change.

Astro props use local `interface Props` declarations and `Astro.props`.
Svelte 5 components use runes (`$props`, `$state`, `$derived`, `$effect`) and
current event attributes such as `onclick`; `scripts/release-regression-check.mjs`
guards against deprecated event syntax.

Runtime-created DOM cannot receive Astro scoped attributes. Style it with
Tailwind classes, `:global(...)`, or `<style is:global>`. Keep visitor or remote
payloads in `textContent`/attributes; reserve HTML injection for the trusted
boundaries documented in `SECURITY_MODEL.md`.
