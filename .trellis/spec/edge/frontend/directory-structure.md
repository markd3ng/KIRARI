# Consumer Directory Boundary

Worker implementation lives only in `workers/kirari-edge/src/index.ts`.
Frontend consumers live in `apps/site`, with configuration represented by
`EdgeConfig` in `apps/site/src/types/config.ts` and parsed in
`apps/site/src/utils/config-loader.ts`.

Do not put Astro/Svelte components, browser bundles, or site assets in the
Worker package. Do not import Worker source into the site bundle.
