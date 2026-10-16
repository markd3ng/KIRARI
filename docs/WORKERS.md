# Edge Worker Deployment

The Worker also includes a portable named-operation Gateway at
`/_kirari/edge/*`. It is independent of the legacy feature routes below and
delegates request validation and upstream behavior to
`@kirari/edge-gateway-core`.

## Portable Gateway

The Gateway remains disabled unless `KIRARI_EDGE_ENABLED=true`. To use the
integrated mode, route the same-origin path `/_kirari/edge/*` to this Worker in
Wrangler or the Cloudflare dashboard. This repository does not add a route or
binding to `wrangler.jsonc`; the existing default stays inert.

The cache level defaults to `CACHE_NONE`. Set `KIRARI_GATEWAY_CACHE_LEVEL` to
`CACHE_EDGE` to use `caches.default`, whose entries are local to the data center
that handled the request and are not tiered. `CACHE_PERSISTENT` requires an
existing `KIRARI_EDGE_KV` binding; KV is eventually consistent. If the selected
capability is missing or fails, Core serves without cache and reports
`CACHE_NONE`. The adapter keeps Core freshness timestamps even when the
provider's minimum storage TTL retains a record longer.

GitHub requests remain anonymous unless both `KIRARI_GITHUB_TOKEN` and
`KIRARI_GITHUB_TOKEN_PUBLIC_REPOSITORIES` are present. The latter is a
comma-separated list of public `owner/repository` names. The Core attaches the
token only to its named GitHub REST operations for repositories on that list.
The old `/api/github/*` compatibility path no longer attaches the Worker token.

For local testing, use `pnpm edge:test`, `pnpm edge:type-check`, or Wrangler's
local `dev` mode with local bindings. Unit tests use injected cache/KV doubles;
they do not verify a live zone's cache scope. Remote bindings can reach real
Cloudflare resources; do not use them for this no-deploy verification. Cache
API operations in the dashboard editor, Playground, and `workers.dev`
deployments do not affect the network cache. Verify `CACHE_EDGE` only through a
custom domain/Worker route or a Pages Function. A Pages Function may forward the
same-origin `Request` to the Worker with an HTTP Service Binding; preserve its
public URL/origin. Service Bindings are optional and no Service Binding is
configured here.

Cloudflare references: [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/),
[Cache API example and runtime limits](https://developers.cloudflare.com/r2/examples/cache-api/),
[Workers KV](https://developers.cloudflare.com/kv/api/),
[Service Bindings over HTTP](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/http/),
and [local development](https://developers.cloudflare.com/workers/local-development/).

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
