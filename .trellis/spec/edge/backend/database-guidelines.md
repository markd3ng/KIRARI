# Storage And Persistence

The current Worker has no configured storage binding. The optional Gateway
adapter can use the Cloudflare Cache API for data-center-local edge records or
an existing `KIRARI_EDGE_KV` binding for eventual persistent records. It does
not configure either capability by default, and it does not use D1, R2,
Durable Objects, or Queues.

Do not add bindings or persistence to solve a problem already covered by
upstream caching headers.

If a cache binding is enabled for a deployment, configure it explicitly outside
the portable Core and keep its consistency and retention semantics visible.
D1 queries must be parameterized and secret values must remain Worker bindings,
never public TOML or response payloads.
