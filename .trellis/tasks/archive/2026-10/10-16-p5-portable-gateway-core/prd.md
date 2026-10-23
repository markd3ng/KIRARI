# P5 #102 Portable Gateway Core

## Goal

Implement the portable, platform-independent Gateway Core defined by GitHub Issue #102, preserving only the demonstrated KIRARI operations and the safe reusable GHCardCache behavior.

## Requirements

- Keep the core in a dedicated workspace package that uses only Web `Request`, `Response`, `URL`, `Headers`, `AbortSignal`, streams, and injected `fetch`/cache/secret capabilities. It must not import Cloudflare, Vercel, EdgeOne, Node, or Site runtime modules.
- Expose named read-only operations with fixed upstreams: `github.repository`, `github.contents`, `github.latestCommit`, `github.avatar`, and the currently used `bangumi.userCollections` request. Do not add subject/image/Cravatar operations without a Site caller.
- Default to the integrated `/_kirari/edge/*` path. Allow standalone hosting only with an explicit, exact origin allowlist. Keep platform selection outside Site config and the core.
- Reject unknown routes, methods, query parameters, duplicated parameters, malformed/dangerous segments, request bodies, and arbitrary URL/path forwarding before any upstream fetch.
- Construct upstream URLs from constants and validated operation fields. Create upstream headers from a clean allowlist; use GitHub tokens only for GitHub REST operations and only for explicitly allowlisted public repositories. Never return or log credentials.
- Bound URL, path, reference, timeout, and response body sizes. Normalize error responses and expose only selected rate-limit and entity headers.
- Provide injectable `EdgeCache` and `PersistentCache` ports and honest `CACHE_NONE`, `CACHE_EDGE`, and `CACHE_PERSISTENT` behavior. Missing or failing storage must degrade to `CACHE_NONE`; preserve per-operation fresh/stale TTLs and serve stale data only when upstream refresh fails or returns a non-cacheable error. Document that cache scope/consistency is adapter-specific.
- Record a source-backed GHCardCache `KEEP` / `ADAPT` / `REPLACE` / `DROP` matrix and the integrated/standalone/cache contracts.

## Acceptance Criteria

- Automated tests prove valid GitHub operations target only their fixed upstreams, normal requests work, and hostile URL/path/query forms fail before credentials or `fetch`.
- Tests cover token allowlisting and non-leakage, methods/CORS/errors/timeouts, response bounds, cache hits/freshness/stale fallback, unavailable-cache downgrade, and health behavior.
- A named Bangumi user-collections operation matches the live Site request (`/v0/users/{id}/collections?limit=24`); no unused Bangumi API is exposed.
- The package and core adapter contract are in standard type-check/test CI. No platform adapter, Production setting, secret, or deployment is changed in this task.
- Independent review and CI pass before the Core PR is merged. Issue #102 remains open until the Core contract is accepted; #110–#112 remain unstarted until that acceptance.
