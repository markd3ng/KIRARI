# Consumer Fetch Lifecycle

Use the owning site component's existing lifecycle:

- Astro build-time fetch for data that belongs in SSG output.
- Svelte `onMount` for island-local browser fetches.
- `transitionManager` for DOM initialization that must repeat after navigation.

Do not create a separate edge-specific client lifecycle abstraction. Handle
non-2xx responses and network failure without leaving permanent loading state.
