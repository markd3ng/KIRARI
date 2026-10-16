# `@kirari/edge-gateway-vercel`

This package adapts `@kirari/edge-gateway-core` to Vercel Node.js Functions.
The repository-root `api/_kirari/edge/[...path].ts` entrypoint and generated
`vercel.json` rewrite expose `/_kirari/edge/*` while the Core retains all
operation validation, upstream, CORS, response, token, and stale-cache policy.

The adapter is disabled unless `KIRARI_GATEWAY_ENABLED=true`. It defaults to
integrated mode, anonymous upstream access, and `CACHE_NONE`. A GitHub token is
available only when both `KIRARI_GATEWAY_GITHUB_TOKEN` and the explicit
`KIRARI_GATEWAY_GITHUB_PUBLIC_REPOSITORIES` allowlist are set. Standalone mode
requires exact HTTPS origins through `KIRARI_GATEWAY_ALLOWED_ORIGINS`.

`CACHE_EDGE` uses Vercel's CDN-only `Vercel-CDN-Cache-Control` response header
for anonymous successful responses, with a short 60-second TTL and 30-second
stale-while-revalidate window. It does not implement Core stale fallback, and
responses remain `no-store` to clients. Requests carrying Origin, Cookie, or
Authorization, errors, health checks, and preflights bypass this CDN policy.
The Gateway cache-level header reports the selected Vercel response-cache
capability; `X-Kirari-Cache` reports only the Core's handler-level state.

`CACHE_PERSISTENT` maps to `@vercel/functions` Runtime Cache. The adapter uses
it only in Vercel Preview/Production contexts with the provider Runtime Cache
binding present, avoiding the package's local in-memory fallback. It stores
Core-bounded records through their stale deadline and namespaces keys by
`VERCEL_ENV` and `VERCEL_GIT_COMMIT_REF`, keeping Production, Preview branches,
and development separate. Each serialized record is kept below 1.9 MB to stay
inside Vercel's documented 2 MB item limit. Runtime Cache is region-scoped and
best-effort; the adapter declares `provider-defined` consistency and makes no
cross-region or Cloudflare KV equivalence claim. Missing or failing cache
support, malformed records, and resource-limit failures fall back to
`CACHE_NONE` through Core.

See [`docs/EDGE_GATEWAY_VERCEL.md`](../../docs/EDGE_GATEWAY_VERCEL.md) for the
environment, routing, Preview, and cache behavior matrix. This package has no
deployment command and its tests use local fetch and cache doubles.
