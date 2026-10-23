# P5 #110 Cloudflare Gateway Adapter

## Goal

Implement a thin Cloudflare Workers adapter for the accepted portable Gateway Core contract, without changing or deploying production bindings.

## Requirements

- Keep operation parsing, upstream rules, response policy, and token allowlisting in `@kirari/edge-gateway-core`; the Worker supplies the runtime handler and Cloudflare capabilities.
- Expose the accepted same-origin `/_kirari/edge/*` path only when the existing Worker master switch is enabled.
- Provide `CACHE_EDGE` through the Cloudflare Cache API and `CACHE_PERSISTENT` through an optional KV binding, while reporting their real consistency and degrading to `CACHE_NONE` when the selected binding is unavailable or fails.
- Use GitHub credentials only when a token binding and an explicit public-repository allowlist are both present; do not edit secret or production configuration.
- Document route and optional Service Binding setup, local/preview behavior, and local-edge versus eventual KV consistency.
- Preserve the existing Worker routes unless a change is required to prevent a credential exposure or to keep the new Core route isolated.

## Acceptance Criteria

- The Worker delegates the new Gateway route to the Core and forwards only validated upstream requests.
- Tests cover the disabled switch, route isolation, valid operations, cache serialization/fallback, cache levels, and token non-leakage.
- `pnpm edge:type-check`, `pnpm edge:test`, `pnpm edge:deploy:dry`, and the repository checks pass.
- Independent review passes and the focused PR is accepted before any other Cloudflare adapter deployment work.
- No production setting, secret, namespace, deployment, or Site configuration is modified.
