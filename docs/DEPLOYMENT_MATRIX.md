# Deployment Matrix

## Options

| Scenario | Build Command | Output Dir | Worker Required |
|---|---|---|---|
| Cloudflare Pages only | `pnpm build` | `apps/site/dist` | No |
| Vercel Pages only | `pnpm build` | `apps/site/dist` | No |
| Cloudflare Pages + Worker | `pnpm build` | `apps/site/dist` | Yes (opt-in) |
| Vercel Pages + Edge Function | `pnpm build` | `apps/site/dist` | Yes (opt-in) |
| Pages first, Worker later | `pnpm build` | `apps/site/dist` | Added later |

## Recommendation

Start with **Cloudflare Pages only** (or Vercel Pages only). Add the edge
worker only when you need GitHub Card caching, avatar proxying, or Bangumi
proxy features.

See:
- [Cloudflare Pages](CLOUDFLARE_PAGES.md)
- [Vercel](VERCEL.md)
- [Workers](WORKERS.md)
