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

`client:only` omits server-rendered component HTML. Reserve it for UI whose
initial render genuinely requires browser-only state, as `DisplaySettings.svelte`
does. Never place page titles, navigation, article text, structured data, or
other SEO-critical content exclusively inside a `client:only` island.

Astro props use local `interface Props` declarations and `Astro.props`.
Svelte 5 components use runes (`$props`, `$state`, `$derived`, `$effect`) and
current event attributes such as `onclick`; `scripts/release-regression-check.mjs`
guards against deprecated event syntax.

Runtime-created DOM cannot receive Astro scoped attributes. Style it with
Tailwind classes, `:global(...)`, or `<style is:global>`.

## HTML Injection Boundary

Current `set:html` uses are limited to:

- Maintainer-owned Head/Footer HTML and JavaScript from validated TOML fields
  and trusted files under `src/snippets/`.
- Generated article JSON-LD serialized with `JSON.stringify`.

Do not pass visitor submissions, comments, CMS fields, search results, or
remote API payloads to `set:html` or `innerHTML`. Render untrusted strings with
Astro interpolation, `textContent`, or safe attributes. Clearing an existing
container with `innerHTML = ""` is not permission to insert untrusted HTML.

When this trust boundary changes, update `SECURITY_MODEL.md` and the snippet
documentation in the same change.
