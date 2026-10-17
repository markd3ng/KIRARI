# Design

Add a dedicated `@kirari/edge-gateway-vercel` workspace package that wraps
`createGatewayHandler` and injects Vercel-only cache capabilities. A root
`api/_kirari/edge/[...path].ts` Web Handler is the Vercel Node.js Functions
entrypoint. The generated root `vercel.json` receives one rewrite from the
public Core prefix to that function path; this is source configuration only
and is validated locally.

The adapter has a fixed Core prefix and accepts only these runtime environment
values: `KIRARI_GATEWAY_ENABLED`, `KIRARI_GATEWAY_MODE`,
`KIRARI_GATEWAY_CACHE_LEVEL`, `KIRARI_GATEWAY_ALLOWED_ORIGINS`,
`KIRARI_GATEWAY_GITHUB_TOKEN`, and
`KIRARI_GATEWAY_GITHUB_PUBLIC_REPOSITORIES`. Disabled is the default. Invalid
cache-level values select `CACHE_NONE`; invalid mode/origin setup fails closed
with a generic no-store response. A token getter is created only when both the
secret and an explicit repository allowlist are present.

For `CACHE_EDGE`, Core storage remains `CACHE_NONE`; successful anonymous 200
responses receive a Vercel-only CDN policy (`s-maxage=60`,
`stale-while-revalidate=30`) and an effective level header. Requests with Origin,
Cookie, or Authorization headers, errors, health, and preflights remain
uncached. This short response cache does not claim Core stale-fallback or
cross-region consistency semantics.

For `CACHE_PERSISTENT`, adapt the Runtime Cache to the Core `PersistentCache`
port. Hash the Core key together with `VERCEL_PROJECT_ID`, `VERCEL_ENV` and the Preview Git ref. Missing project identity or a missing Preview ref disables storage for that request. Store
only validated bounded cache entries as JSON-safe base64 records, retain Core
absolute timestamps, and set Runtime Cache TTL only through `staleUntil`. The
adapter rejects cache values above Vercel's documented 2 MB maximum. Runtime
Cache consistency is documented as provider-defined and region-scoped/best
effort. Missing API, malformed records, and exceptions cause the Core's normal
`CACHE_NONE` downgrade.

All external requests remain injected through Core and test doubles; no live
Vercel API, deployment, credential, or project setting is used.
