# Edge Worker Deployment

## When To Use This

You need GitHub Card caching, avatar proxying, Bangumi API/image proxying, or
other edge runtime features.

## Prerequisites

- Cloudflare account (for `@kirari/edge` on Cloudflare Workers)
- Dependencies installed with `pnpm install` (`wrangler` is provided by `@kirari/edge`)

## Configuration

Set `[edge] enabled = true` in `packages/site-profile/kirari.config.toml` and
enable the individual features you need:

```toml
[edge]
enabled = true
apiBase = "https://edge.your-domain.com"

[edge.features.githubCard]
enabled = true
```

## Deploy

```bash
pnpm edge:deploy:dry
pnpm edge:deploy
```

For production, edit `workers/kirari-edge/wrangler.jsonc` if you need a
different worker name, route, or environment binding policy.

## Enable Later

If you already deployed Pages-only, you can add the Worker later without
changing the Pages configuration. Set `[edge] enabled = true`, update feature
flags, and deploy the Worker. The site continues to work without the Worker
when edge features are disabled.

## Verification

After deploying, confirm that GitHub cards, avatar URLs, and Bangumi content
are proxied through your edge domain.
