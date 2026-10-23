# Design — Portable Gateway Core

## Boundary

Add `@kirari/edge-gateway-core` under `packages/edge-gateway-core`. Its public entry creates a Web-standard `Request -> Promise<Response>` handler. It owns route parsing, argument validation, fixed upstream URL construction, safe headers, response normalization, bounds, cache policy, CORS policy, and generic errors. It receives `fetch`, a GitHub-token getter, an optional edge cache, an optional persistent cache, and a clock through options. No provider adapter is added here; the current Worker and generated Vercel template remain outside this Core PR until the shared interface is reviewed.

## Route contract

Default prefix is `/_kirari/edge`; `healthz` is a local operation. Named routes:

- `GET|HEAD /github/repository/{owner}/{repo}` -> `https://api.github.com/repos/{owner}/{repo}`
- `GET|HEAD /github/contents/{owner}/{repo}/{path...}?ref=...` -> the matching GitHub Contents REST endpoint
- `GET|HEAD /github/latest-commit/{owner}/{repo}?path=...&sha=...` -> GitHub commits with fixed `per_page=1`
- `GET|HEAD /github/avatar/{owner}?size=...` -> `https://github.com/{owner}.png?size=...`, never with a token
- `GET|HEAD /bangumi/user-collections/{userId}` -> `https://api.bgm.tv/v0/users/{userId}/collections?limit=24`

Each route owns its query allowlist and path validator. Upstream URLs are assembled only after parse succeeds. Redirects are not followed. A request's authorization, cookie, forwarding, host, and arbitrary accept headers never pass upstream. Tokens are attached only to GitHub REST calls for exact entries in an adapter-provided public-repository allowlist; no allowlist means anonymous access.

## Cache contract

`CACHE_NONE` is the default and never reads/writes storage. `CACHE_EDGE` uses only the injected `EdgeCache`; `CACHE_PERSISTENT` uses only the injected `PersistentCache`. Missing or failing stores bypass to `CACHE_NONE` for that request; persistent mode does not silently claim edge or durable semantics when its adapter is missing. A cache entry carries status, safe headers, bounded bytes, and absolute fresh/stale times. Fresh entries return immediately. Stale entries are fallback data only: they are returned when refresh fails or yields a non-cacheable error. Successful and short-lived 404 responses follow the historic per-operation TTL policy; auth/rate-limit/server failures are not cached.

The Core makes no cross-provider consistency promise. An adapter must describe its own scope and consistency. Existing research records Cloudflare Cache API as data-center-local and Cloudflare KV as eventually consistent; Vercel CDN/runtime cache and EdgeOne Makers KV/cache have different or still partially unverified semantics. An adapter may expose only the levels it can verify and otherwise must report `CACHE_NONE`.

## Origins and CORS

Integrated mode is the default; an `Origin` header must match the request URL origin. Standalone mode requires a non-empty explicit list of exact HTTPS origins; wildcard and URL paths are invalid. Requests without `Origin` remain usable for server-to-server calls. Preflight permits only GET/HEAD and the small declared request-header set. The core never accepts a caller-provided upstream or CORS origin.

## Compatibility and migration

The current Worker suffix proxy and Vercel generated adapter are legacy consumers, not Core imports. This task does not alter their packaging. The migration matrix records the target mapping and defers adapter integration to #110–#112 after the Core interface is accepted. Existing card JSON keeps the same upstream shape, with repository owner avatar URLs rewritten to this handler's named avatar operation.
