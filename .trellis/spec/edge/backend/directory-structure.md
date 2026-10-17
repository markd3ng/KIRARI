# Directory Structure

- `src/index.ts`: feature routing, legacy proxy helpers, and the default Worker
  `fetch` handler. It delegates `/_kirari/edge/*` to the portable Core.
- `src/cloudflare-gateway.ts`: Cloudflare Cache API and optional KV adapters
  for the Core's injected ports.
- `test/index.test.ts` and `test/cloudflare-gateway.test.ts`: Node built-in
  tests with mocked fetch, cache, and KV bindings.
- `wrangler.jsonc`: Worker name, entrypoint, compatibility date.
- `package.json`: type-check, test, dry deploy, and deploy scripts.

Keep the legacy proxy helpers small. Gateway operation parsing and cache policy
belong to `@kirari/edge-gateway-core`; Cloudflare binding adaptation belongs in
`src/cloudflare-gateway.ts`. Do not add router frameworks or unconfigured
storage bindings.

The site-facing `[edge]` TOML section and Worker environment variables are
separate current mechanisms. No code in this package reads TOML directly and
no deployment script currently proves automatic TOML-to-binding propagation.
