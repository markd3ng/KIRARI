# Navigation And Browser Initialization

`src/utils/transition-manager.ts` is a singleton adapter over Astro
`ClientRouter` and a dynamically imported Swup fallback.

Unified events are:

| Event | Astro | Swup |
|---|---|---|
| `transition:start` | `astro:before-preparation` | `visit:start` |
| `transition:before-swap` | `astro:before-swap` | `content:replace` |
| `transition:after-swap` | `astro:after-swap` | `page:view` |
| `transition:end` | `astro:page-load` | `visit:end` |

Features that must re-bind after client navigation should expose an idempotent
initializer and register it on `transition:after-swap`. `BangumiPanel.astro` is
the regression-checked example.

Not every script needs the manager: a script scoped to a hydrated Svelte island
uses `onMount`; a one-shot inline document bootstrap may run immediately.
Avoid adding a bare `DOMContentLoaded` listener for behavior expected to survive
SPA navigation.

Return cleanup functions from Svelte `onMount` when listeners outlive the
component. Prevent duplicate handlers with stable assignments, `{ once: true }`,
or idempotent markers.
