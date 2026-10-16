# Cache Contract

`CACHE_NONE` is the default. `CACHE_EDGE` and `CACHE_PERSISTENT` require their matching injected ports; they do not substitute for each other. Missing or failing cache capability must bypass storage and identify the effective level as `CACHE_NONE`.

Cache entries contain only bounded 200/404 responses, safe headers, bytes, and absolute freshness/stale timestamps. Use operation-specific TTLs and a short 404 TTL. Do not store rate-limit, authorization, redirect, server, malformed-content, or oversized responses. Stale entries are fallback data only when a refresh fails or is non-cacheable.

`EdgeCache` and `PersistentCache` adapters declare their real consistency model. The Core makes no global consistency promise. Cloudflare Cache API is data-center local; Cloudflare KV is eventually consistent. Vercel CDN/runtime cache and EdgeOne Makers storage have distinct or partially unverified behavior. Adapters must use `CACHE_NONE` where a capability is unavailable or not verified.
