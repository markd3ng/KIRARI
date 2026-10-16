# Directory Structure

- `packages/edge-gateway-core/src/index.ts`: Web-standard handler factory, operation routes, validation, upstream construction, response bounds, token rules, and injected cache ports.
- `packages/edge-gateway-core/test/index.test.ts`: Node built-in tests with injected `fetch` and cache doubles.
- `packages/edge-gateway-core/README.md`: public operation, cache, integration, and migration contract.

Keep provider handlers and runtime packaging out of this package. The Cloudflare, Vercel, and EdgeOne adapters are separately tracked by #110–#112 and must delegate request semantics to this Core after the interface is accepted.
