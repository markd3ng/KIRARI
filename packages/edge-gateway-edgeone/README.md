# `@kirari/edge-gateway-edgeone`

EdgeOne **Makers Edge Functions** adapter for the accepted [Gateway Core](../edge-gateway-core/README.md). No classic EdgeOne/SCDN handler, Node runtime dependency, provider SDK, deployment controller, or Site configuration change is introduced.

## Supported scope

`createMakersGateway()` delegates `context.request` to Core. It exposes the existing named GitHub repository, contents, latest-commit, avatar and Bangumi user-collections operations under `/_kirari/edge/*`, plus local health. Core validates paths, methods, query parameters, upstream origins, redirects, bodies, response size and timeouts. Makers does not document inbound `Request.signal` or fetch cancellation; the adapter supplies a fallback signal when missing and enforces the Core abort deadline across headers and streaming body reads, even if provider fetch ignores it. The response bridge uses the documented `TransformStream` constructor rather than the unsupported `new ReadableStream`. Network-level cancellation itself remains unverified; an abandoned native request may continue until the provider ends it. A catch-all file route does not permit arbitrary upstream paths. `HEAD` and preflight remain Core behavior.

This adapter deliberately always uses `CACHE_NONE`. It supplies no cache or token port, never reads `context.env`, KV, global caches or request forwarding headers, and never logs upstream errors or bindings. Even if the project already has a GitHub token, it will not be used. All upstream calls are anonymous and subject to public API rate limits. There is no feature flag that enables Secrets or persistence accidentally. See the [dated capability evidence](../../.trellis/tasks/10-17-p5-edgeone-gateway-adapter/research/makers-capabilities.md) for supported, partial and unverified platform claims.

Same-origin integrated mode is the default. Browser CORS restriction is **not authentication**: originless server clients may call public operations. For an explicitly standalone package, change only public policy in `src/config.ts` to `mode: "standalone"` and set exact HTTPS `allowedOrigins`, then rebuild. Wildcards are rejected by Core. Never place tokens or private configuration in this source file: it is bundled into the package.

## Local package, without deployment

From the repository root, with the pinned pnpm/Node versions:

```sh
pnpm install --frozen-lockfile
pnpm gateway:edgeone:type-check
pnpm gateway:edgeone:test
pnpm gateway:edgeone:package
```

The last command only writes `packages/edge-gateway-edgeone/dist/`:

```text
dist/
  package.json                         # private ESM, no dependencies
  edgeone.json                         # outputDirectory: public
  public/404.html
  edge-functions/_kirari/edge/index.js
  edge-functions/_kirari/edge/[[path]].js
```

The two function files contain the same self-contained ESM bundle, exporting the documented default handler and named `onRequest`. `index.js` covers the base path (Core returns 404), while `[[path]].js` covers operation paths. No runtime imports, sourcemaps, env interpolation or deployment metadata are emitted. A strict local uncompressed bundle-size budget supplements the platform limit. The generator uses a fixed dedicated output, refuses symlink traversal and never recursively deletes files. Keep that generated directory dedicated to this package; discard it before assembling a different project.

This directory is an optional standalone source package, not the current Production Site output. For a future Makers Site integration, place these two routes at the same paths inside that project root and coordinate its static output with #98. Do not replace the Site `edgeone.json`, output directory, or existing functions automatically. Static resources take precedence over function routes in Makers: the project must have no static file under `/_kirari/edge`. The generic `index` plus catch-all routes do not cover requests outside the fixed Core namespace.

## Preview and runtime verification limits

For a future separately authorized Makers project, its root must contain `edge-functions/` beside `edgeone.json`; the static output is `public/`. Native repository Preview builds may run the local packaging command and use this package root, without adding a GitHub deployment workflow. Exact project-root/build settings and route/static collision checks belong to that integration. Existing KIRARI Vercel Production is unaffected.

No Makers login, variable binding, Preview deployment or Production deployment is performed by these scripts or tests. Node Web API tests and importing the generated ESM prove routing delegation, isolation, no-secret behavior and package completeness; they do not prove live Makers routing, cancellation, CPU time, global cache behavior or Preview isolation. CLI local emulation has provider-specific limitations, so it is not a replacement for a later live check. Cache/Secrets stay unavailable until their documented protection, scope and semantics are verified and separately implemented.
