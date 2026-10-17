# KIRARI Monorepo

| Directory | Package | Purpose |
|---|---|---|
| `apps/site` | `@kirari/site` | Astro site program |
| `packages/site-profile` | `@kirari/site-profile` | Default content, config, brand assets, snippets |
| `workers/kirari-edge` | `@kirari/edge` | Optional edge runtime (proxy/cache/API) |
| `packages/edge-gateway-vercel` | `@kirari/edge-gateway-vercel` | Optional Vercel Functions adapter for the portable Gateway |

## Quick Start

```bash
pnpm install
pnpm build   # materializes profile → adapters → astro build → postbuild
pnpm check   # site type-check + Astro check + edge checks
```

## Default Fork Experience

A fresh fork runs in Pages-only mode. No Worker required. All edge features
are disabled by default.

See:
- [Current delivery and development handoff](HANDOFF.md)
- [Post-deployment indexing contract](SITE_PRODUCTION.md)
- [Quick Start](QUICK_START.md)
- [Architecture](MONOREPO_ARCHITECTURE.md)
- [Deployment Matrix](DEPLOYMENT_MATRIX.md)
- [Vercel Gateway Adapter](EDGE_GATEWAY_VERCEL.md)
