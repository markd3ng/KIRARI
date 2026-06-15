# KIRARI Monorepo

| Directory | Package | Purpose |
|---|---|---|
| `apps/site` | `@kirari/site` | Astro site program |
| `packages/site-profile` | `@kirari/site-profile` | Default content, config, brand assets, snippets |
| `workers/kirari-edge` | `@kirari/edge` | Optional edge runtime (proxy/cache/API) |

## Quick Start

```bash
pnpm install
pnpm build   # materializes profile → adapters → astro build → postbuild
pnpm check   # astro check
```

## Default Fork Experience

A fresh fork runs in Pages-only mode. No Worker required. All edge features
are disabled by default.

See:
- [Quick Start](QUICK_START.md)
- [Architecture](MONOREPO_ARCHITECTURE.md)
- [Deployment Matrix](DEPLOYMENT_MATRIX.md)
