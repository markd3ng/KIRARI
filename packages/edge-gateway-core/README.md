# `@kirari/edge-gateway-core`

This package contains the provider-independent KIRARI Gateway request contract. It uses Web APIs and injected `fetch`, token, and cache ports. It does not import a runtime adapter, read Site TOML, package a route for a provider, or deploy anything. The default integrated route prefix is `/_kirari/edge`; standalone hosting requires explicit exact HTTPS origins. Origin checks enforce browser CORS only: originless server-to-server requests are allowed, and this policy is not authentication.

## Operations

| Operation | Route | Fixed upstream | Allowed query |
| --- | --- | --- | --- |
| `github.repository` | `GET /github/repository/{owner}/{repo}` | `https://api.github.com/repos/{owner}/{repo}` | none |
| `github.contents` | `GET /github/contents/{owner}/{repo}/{path...}` | GitHub Contents REST | `ref` |
| `github.latestCommit` | `GET /github/latest-commit/{owner}/{repo}` | GitHub commits REST; `per_page=1` is fixed | required `path`, optional `sha` |
| `github.avatar` | `GET /github/avatar/{owner}` | `https://github.com/{owner}.png`; only the documented avatar redirect to `avatars.githubusercontent.com/u/*` is followed | optional `size` (16–256) |
| `bangumi.userCollections` | `GET /bangumi/user-collections/{userId}` | `https://api.bgm.tv/v0/users/{userId}/collections?limit=24` | none |
| health | `GET /healthz` | local response | none |

`HEAD` is supported with an empty response body. `OPTIONS` is local and permits only `GET`/`HEAD`. The current Site actively requests repository metadata, file contents, latest-by-path commit, avatar fallback, and Bangumi user collections. No subject, image, or additional avatar provider operation is added.

All route arguments are decoded once and validated before URL construction. Unknown and duplicate query parameters, arbitrary URL targets, arbitrary route suffixes, request bodies, and unsupported methods are rejected before fetch. Upstream requests are built with fresh headers; browser `Authorization`, cookies, forwarding headers, and arbitrary query values are not forwarded. A GitHub token getter is accepted only with an exact public-repository allowlist and is used only for GitHub REST operations; if it returns no token, the public request remains anonymous. Avatar and Bangumi calls are anonymous. Redirects are manual except for the single fixed GitHub avatar redirect. Only selected content/ETag/Last-Modified/rate-limit headers are returned. Upstream error bodies are never returned.

Response bounds are 1,000,000 bytes for JSON and 512,000 bytes for avatars, with an 8-second timeout covering upstream headers and body reads. The same bounds and JSON/content-type validation apply to cache entries. Fresh 200 responses retain GHCardCache TTLs: repository 6 hours, contents 24 hours, latest commit 1 hour, avatar 7 days. A 404 is fresh for 10 minutes. Historical stale windows are retained per operation; stale data is used only if refresh fails or is not cacheable. Repository cache keys include the request origin and route prefix because the response rewrites avatar URLs to that Gateway route. Bangumi collections use a conservative 5-minute fresh and 1-hour stale window. Health and all errors are `no-store`.

## Cache levels

`CACHE_NONE` is the default. `CACHE_EDGE` uses only an injected `EdgeCache`; `CACHE_PERSISTENT` uses only `PersistentCache`. The entry records absolute `freshUntil` and `staleUntil` times so adapters can preserve rather than invent freshness. An unavailable or failing store degrades the request to `CACHE_NONE`, exposes that level in `X-Kirari-Cache-Level`, and continues without cache. Persistent mode never silently falls back to edge mode.

The core does not claim cross-platform consistency. Current documented differences are:

| Capability | Known behavior | Core treatment |
| --- | --- | --- |
| Cloudflare Cache API | data-center local | `EdgeCache`; no cross-location consistency claim |
| Cloudflare KV | eventually consistent | `PersistentCache` with eventual consistency |
| Vercel CDN / Runtime Cache | different mechanisms and scopes | adapter must declare its selected capability; no equivalence claim |
| EdgeOne Makers cache / KV | cache semantics and protected-secret behavior are partially unverified in the current issue evidence | keep unavailable levels disabled and use `CACHE_NONE` until the adapter verifies them |

These rows record adapter constraints, not implementations. Provider cache/secret packages belong to #110–#112 and are intentionally absent from this package.

## Site and adapter boundary

Site configuration may select whether Gateway-backed features are enabled, use the default same-origin base `/_kirari/edge`, and enable only named operation features. It must not name Cloudflare, Vercel, EdgeOne, runtime bindings, secret names, or provider cache primitives. The Core does not read Site TOML or change current Site callers; future integration remains a separate Site/adapter change. Platform adapters own request routing, secret/cache bindings, and package layout, then delegate operation behavior to `createGatewayHandler`.

## GHCardCache migration matrix

| Historical behavior | Decision | Core target |
| --- | --- | --- |
| Repository metadata, contents, latest commit by path | KEEP / ADAPT | named GitHub REST operations with allowlists and bounds |
| Avatar fallback and repo JSON avatar rewrite | KEEP / ADAPT | named avatar operation; rewrite to the configured Core route |
| Active Bangumi user collections request | ADAPT | one named operation matching the current `/collections?limit=24` caller; Site continues direct use until a later integration choice |
| Per-operation TTLs, short 404 cache, stale fallback, bounded bodies, rate-limit visibility | KEEP | portable cache records and sanitized response headers |
| `/ghc/*`, `/api/github/*`, suffix-based forwarding | REPLACE | explicit `/_kirari/edge/*` named operations; legacy packaging is an adapter concern |
| Caller-selected URL or arbitrary forwarded suffix | DROP | no representation in the operation type |
| Scheduled prewarm and wildcard CORS | DROP | request-driven cache only; integrated exact-origin or standalone explicit allowlist |
| Provider-specific cache/storage/secrets imports in shared logic | ADAPT | injected Web/cache/secret ports; provider semantics remain in later adapters |

The reference is archived `markd3ng/KIRARI-GHCard-Cache` commit `b7fecbbe8120c64de9cfa1557273656beab8d02d`. Current live Worker settings and token scope remain unknown; this Core package does not imply that a Worker route or secret is enabled.
