# Vercel Gateway Adapter

KIRARI's optional Gateway adapter is a Node.js Function that delegates every
operation to `@kirari/edge-gateway-core`. The public same-origin prefix
`/_kirari/edge/*` is rewritten by the generated root `vercel.json` to the
catch-all Function at `/api/_kirari/edge/*`. The Core still rejects arbitrary
URLs, unlisted operations, methods, query keys, request bodies, and oversized
responses before any upstream response is returned. The internal Function path
is also constrained by the same Core contract.

The entrypoint uses Vercel's supported default `{ fetch(request) }` Web
Standard export for the Node.js runtime. Unexpected handler/configuration
failures return a generic no-store 503 and log only the fixed
`kirari_gateway_request_failure` event plus an error category. Raw exception
messages, request data and secrets are not logged.

## Environment variables

The adapter is off by default. Configure variables in the intended Vercel
environment rather than committing them to a profile or repository file.

| Variable | Purpose | Default |
|---|---|---|
| `KIRARI_GATEWAY_ENABLED` | Must be the exact string `true` to enable requests | disabled |
| `KIRARI_GATEWAY_MODE` | `integrated` or `standalone` | `integrated` |
| `KIRARI_GATEWAY_ALLOWED_ORIGINS` | Comma-separated exact HTTPS origins, required by standalone mode | none |
| `KIRARI_GATEWAY_CACHE_LEVEL` | `CACHE_NONE`, `CACHE_EDGE`, or `CACHE_PERSISTENT` | `CACHE_NONE` |
| `KIRARI_GATEWAY_GITHUB_TOKEN` | Optional GitHub REST token | absent |
| `KIRARI_GATEWAY_GITHUB_PUBLIC_REPOSITORIES` | Comma-separated public `owner/repo` allowlist | none |

The GitHub token is attached only when both the token and non-empty repository
allowlist are present. It is never used for avatars or Bangumi. Browser
Authorization, Cookie, Host, forwarding, and other arbitrary headers are not
forwarded to upstreams.

## Cache behavior

| Core level | Vercel mapping | Consistency and limits |
|---|---|---|
| `CACHE_NONE` | No cache headers or storage | Default; all response paths remain `no-store` |
| `CACHE_EDGE` | Vercel CDN response cache for anonymous 200 responses only; `s-maxage=60`, `stale-while-revalidate=30` | Regional, best effort, may be evicted; no Core stale fallback. The browser-facing `Cache-Control: no-store` remains in place |
| `CACHE_PERSISTENT` | `@vercel/functions` Runtime Cache with Core freshness/stale timestamps | Provider-defined, region-scoped behavior; keys include Vercel project ID, environment and Preview Git branch; each serialized item is capped below 2 MB |

The adapter does not treat CDN response caching and Runtime Cache as equivalent.
For `CACHE_EDGE`, responses with Origin, Cookie, or Authorization headers, and
all errors, health responses, and preflights, bypass the CDN policy. For
`CACHE_PERSISTENT`, Core decides freshness and stale fallback; Runtime Cache
only retains the bounded record until `staleUntil`. The adapter requires a
Vercel Preview/Production runtime with the provider cache binding present, so
the package's local in-memory fallback is never reported as persistent
storage. Vercel Runtime Cache API errors, absent runtime support, invalid
records, and size-limit failures downgrade the request to `CACHE_NONE`.

Vercel documents a 2 MB Runtime Cache item maximum and regional CDN caching.
The adapter uses a 1.9 MB serialized-record ceiling to leave room for provider
serialization overhead. CDN caching is configured with Vercel's dedicated
`Vercel-CDN-Cache-Control` response header, which is handled by Vercel and is
not sent to clients.

## Preview and validation

When the optional adapter is enabled for a Preview environment, the same route
and allowlists apply there. Runtime Cache keys include `VERCEL_PROJECT_ID`,
`VERCEL_ENV` and `VERCEL_GIT_COMMIT_REF`, so normal application keys do not
collide between projects, environments or Preview branches. Keep Preview secrets scoped to Preview and limit them to
the explicitly allowed public repositories.
When a Preview has no non-empty `VERCEL_GIT_COMMIT_REF`, the adapter cannot
establish branch isolation and uses `CACHE_NONE` without accessing Runtime
Cache. It never substitutes one shared Preview cache scope.
Missing project identity also causes `CACHE_NONE` without storage access.
These values come from Vercel's system environment; this adapter does not
change project settings to expose them.

Vercel isolates Runtime Cache by deployment environment. Pro/Enterprise cache
storage is project-scoped, while Hobby projects in one team share storage.
The adapter's project namespace prevents ordinary key collisions; it is not a
provider access-control boundary against a malicious writer with access to the
same shared cache. Treat those team projects as one cache trust boundary and
cache only the Core-approved public data.

The repository's checks cover route rewrite parity, method/path/query and
upstream restrictions, secret non-leakage, cache isolation, TTLs, resource
bounds, and graceful fallback. They do not deploy, change Vercel settings, or
prove live Runtime Cache retention or CDN behavior in a Vercel project. Native
Git pushes to an attached Vercel project can automatically create Preview
deployments, so local validation and a remote PR push are separate actions.

Official references: [Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js),
[Runtime Cache](https://vercel.com/docs/caching/runtime-cache),
[CDN cache headers](https://vercel.com/docs/caching/cdn-cache), and
[Vercel Functions package](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package).

GHCard route cleanup requires both a known generated filename directly under its route directory and the exact generated first-line header. Owner documentation/examples merely quoting the marker are preserved.
