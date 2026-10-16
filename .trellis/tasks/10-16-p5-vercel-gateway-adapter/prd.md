# P5 #111 Vercel Gateway Adapter

## Goal

Package the accepted `@kirari/edge-gateway-core` contract as a Vercel Node.js
Functions adapter at the same-origin `/_kirari/edge/*` route. Keep deployment
and project configuration changes local to source control; do not deploy or
change live Vercel settings.

## Requirements

- Delegate all operation parsing, fixed upstreams, request validation, response
  bounds, CORS, error policy, token allowlisting, and stale behavior to Gateway
  Core.
- Provide a Vercel Node.js Function entrypoint with Web `Request`, `Response`,
  and `fetch` interfaces, plus a deterministic rewrite from
  `/_kirari/edge/:path*` to the Vercel function route.
- Disable the adapter unless explicitly enabled by a Vercel environment
  variable. Default to integrated mode, no token, and `CACHE_NONE`.
- Attach a GitHub token only with a non-empty explicit public repository
  allowlist. Never forward request credentials or arbitrary headers.
- Map `CACHE_EDGE` to conservative Vercel CDN response caching. Map
  `CACHE_PERSISTENT` to optional `@vercel/functions` Runtime Cache with
  environment/preview-branch key isolation. Unavailable, invalid, oversized,
  or failing cache capabilities must degrade to `CACHE_NONE`.
- Document route packaging, environment-scoped secrets, Preview behavior,
  cache headers, Runtime Cache limits/consistency, and no-deploy verification.
- Do not change the Gateway Core contract, Site config, external Site export,
  live Vercel settings, secrets, credentials, or deployments.

## Acceptance Criteria

- Tests prove valid named operations reach only Core-validated fixed upstreams;
  unsupported methods, paths, query values, bodies, and disabled state do not
  reach upstream fetch or expose credentials.
- Tests cover the route rewrite, safe `CACHE_EDGE` response policy,
  `CACHE_PERSISTENT` serialization/key scope/TTL, 2 MB cache value limit, and
  cache failure or unavailable-runtime fallback.
- Root type-check, adapter type-check/tests, `pnpm check`, `pnpm build`, Vercel
  config parity, Trellis sync, and `git diff --check` pass.
- No Vercel deployment or live project mutation is performed. The final local
  candidate is reported with its exact HEAD; remote push is deferred because
  the linked native Git integration automatically creates Preview deployments.
