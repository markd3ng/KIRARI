# Storage And Persistence

The current Worker is stateless. It uses upstream HTTP responses plus
`Cache-Control` headers; it does not use Cloudflare Cache API, KV, D1, R2,
Durable Objects, or Queues.

Do not add bindings or persistence to solve a problem already covered by
upstream caching headers.

If storage becomes an approved feature, update `Env`, `wrangler.jsonc`, tests,
deployment docs, and lifecycle/retention rules together. D1 queries must be
parameterized and secret values must remain Worker bindings, never public TOML
or response payloads.
