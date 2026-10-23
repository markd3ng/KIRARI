# Gateway Adapter Boundaries

`packages/edge-gateway-core` owns approved named operations, path/query/method validation, fixed upstreams, response/time bounds and cache ports. Do not change that public contract as an incidental adapter fix.

`packages/edge-gateway-edgeone` owns current Makers context routing and local file-route packaging. Read its README and dated official-doc capability evidence. It supplies no token or cache port, never reads `context.env`, and always declares CACHE_NONE. Do not infer supported protected Secrets, Preview isolation, or cache semantics from Cloudflare or Node mocks. Never add classic EdgeOne addEventListener handlers.

Public policy is compiled source. Packaging emits self-contained ESM only into its fixed dedicated dist, rejects symlinks, and does not deploy. Keep standalone packaging separate from Site materialization and #98 Site export. Existing static files must not shadow `/_kirari/edge` when later integrated.

For changed Makers contracts, run `pnpm gateway:edgeone:type-check`, `pnpm gateway:edgeone:test`, `pnpm gateway:edgeone:package`, the repository full checks and exact-head CI. Tests must exercise the emitted handler as well as direct calls; Node simulation does not prove live provider limits or cancellation.
