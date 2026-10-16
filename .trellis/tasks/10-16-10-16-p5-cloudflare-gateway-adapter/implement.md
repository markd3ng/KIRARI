# Execution

- [x] Verify #102 acceptance, merged main `d7b72b0360f9b1c312fc1fa476a78ad62454c374`, and its post-merge CI.
- [x] Read Issue #110, the accepted Core contracts, current Cloudflare Worker source/tests, and current official Workers/Cache/KV documentation.
- [x] Add the Cloudflare handler and injected Cache API/KV ports without editing deployment bindings.
- [x] Add focused Worker tests and route/cache/token regression coverage.
- [x] Document routes, Service Binding option, local/preview limits, and cache consistency.
- [x] Run focused checks, full local checks, release regression checks, dry-run build, and site build.
- [x] Complete the independent review of the final follow-up patch.
- [x] Create and deliver the focused #110 PR #147; update it with the review fixes below.

## Review follow-up

The first GitHub CI run failed only because the release regression script still
searched for the historical `proxyGitHubCard` test marker after the test was
renamed. The marker is preserved in the updated test name and `pnpm
release:check` passes.

OCR review disposition:

- Cache API TTL now uses the actual remaining lifetime; Workers KV alone keeps
  its 60-second minimum while Core timestamps prevent stale reads.
- Cache records with a missing freshness/stale timestamp are rejected.
- Test type checking no longer mixes Node and Worker globals or suppresses
  library checks; executable Node tests still run through the repository's
  built-in test command.
- Adapter-construction failures log only a fixed event and error class; the
  response stays generic and `no-store`.
- The Core route intentionally keeps its exact same-origin CORS policy; a
  Worker-level test verifies foreign origins get 403 before upstream fetch.

The independent review passed on the current code. GitHub CI and advisory OCR
must still pass on the updated PR HEAD before #110 can be considered accepted.

The next OCR pass reported three additional points. The Worker now validates
the cache-level environment value before calling Core; the legacy suffix route
remains anonymous because it cannot enforce Core's operation/repository
allowlist (and the anonymous rate-limit tradeoff is documented); and unexpected
Core handler throws become a sanitized, no-store 500. Regression coverage
exercises each runtime boundary. Final independent review and GitHub checks for
this follow-up are pending.

The Worker tests cover a normal fixed-upstream request, exact token allowlisting,
legacy anonymous behavior, invalid operation rejection before fetch, cache
serialization bounds, and cache failure downgrade. No Cloudflare account or
deployment configuration was changed.

## Validation

```bash
pnpm edge:type-check
pnpm edge:test
pnpm edge:deploy:dry
pnpm check
pnpm release:check
pnpm build
git diff --check
```
