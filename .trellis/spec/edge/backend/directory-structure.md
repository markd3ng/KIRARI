# Directory Structure

- `src/index.ts`: `Env`, feature routing, proxy helpers, CORS, cache headers,
  and the default Worker `fetch` handler.
- `test/index.test.ts`: Node built-in tests with a mocked `globalThis.fetch`.
- `wrangler.jsonc`: Worker name, entrypoint, compatibility date.
- `package.json`: type-check, test, dry deploy, and deploy scripts.

Keep this single-file implementation while the feature set remains four small
proxies. Do not introduce a router, service classes, or storage abstractions for
future possibilities.

The site-facing `[edge]` TOML section and Worker environment variables are
separate current mechanisms. No code in this package reads TOML directly and
no deployment script currently proves automatic TOML-to-binding propagation.
