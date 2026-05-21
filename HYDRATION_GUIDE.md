# Hydration Guide

KIRARI uses Astro islands sparingly. Static HTML is the default, and hydration is
an explicit exception.

## Current Rules

| Use case | Directive |
|---|---|
| Static content, cards, navigation, layouts, metadata | none |
| Search | `client:idle` |
| Theme Toggle | `client:idle` |
| Display Settings / panels that read `localStorage` before render | `client:only="svelte"` |

## When To Use `client:idle`

Use `client:idle` for interactive controls that should exist on every page but
do not need to block first paint. This is the current rule for search and theme
toggle.

## When To Use `client:only`

Use `client:only="svelte"` only for browser-only panels that cannot render a
meaningful server/build fallback because they depend on `window`, `document`, or
`localStorage`. Do not put SEO-critical content in these islands.

## Forbidden Changes

- Do not change Search or Theme Toggle back to `client:load` without measured
  first-paint interaction requirements.
- Do not move post content, navigation, headings, canonical metadata, or schema
  data into a client-only component.
- Do not introduce framework-level SPA routing. The project already has a
  transition manager for page navigation behavior.
- Do not initialize page behavior with `DOMContentLoaded`; use
  `transitionManager.on("transition:after-swap", init)`.

