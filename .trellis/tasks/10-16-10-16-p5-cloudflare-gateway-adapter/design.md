# Design

The Cloudflare Worker remains the platform entry point. When `KIRARI_EDGE_ENABLED` is not `"true"`, it remains inert. Requests below `/_kirari/edge` are delegated to a handler created from `@kirari/edge-gateway-core`; existing legacy routes stay outside this new route boundary.

The adapter translates `caches.default` to `EdgeCache` and an optional `KIRARI_EDGE_KV` binding to `PersistentCache`. Cache records preserve Core timestamps and safe response metadata. Edge cache URLs use the actual incoming `Request.url` origin; the origin and Core key are SHA-256 hashed under a private KIRARI path. The origin is not derived from request headers. KV keys are SHA-256 digests of the Core key; cache bodies are stored as bounded bytes. KV records use a length-prefixed metadata block followed by the body, avoiding binary-to-text expansion. KV consistency is eventual; Cache API scope is data-center local.

The configured cache level defaults to `CACHE_NONE`. Selecting an unavailable capability leaves the Core without that port so the Core advertises a `CACHE_NONE` downgrade. GitHub token access is passed only when both the secret binding and a non-empty comma-separated public repository allowlist are present. The adapter does not add bindings to Wrangler configuration.

The Core's `/_kirari/edge/*` namespace is the only new public routing contract. Same-origin routing and optional Service Binding examples are documentation only; no route or binding is configured in this change.
