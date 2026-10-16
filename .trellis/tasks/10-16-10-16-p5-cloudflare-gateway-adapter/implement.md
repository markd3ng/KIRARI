# Execution

- [x] Verify #102 acceptance, merged main `d7b72b0360f9b1c312fc1fa476a78ad62454c374`, and its post-merge CI.
- [x] Read Issue #110, the accepted Core contracts, current Cloudflare Worker source/tests, and current official Workers/Cache/KV documentation.
- [x] Add the Cloudflare handler and injected Cache API/KV ports without editing deployment bindings.
- [x] Add focused Worker tests and route/cache/token regression coverage.
- [x] Document routes, Service Binding option, local/preview limits, and cache consistency.
- [x] Run focused checks, standard CI, dry-run build, and site build.
- [x] Complete independent review; the verifier passed after the legacy GitHub-header regression test was strengthened.
- [ ] Create and deliver a focused #110 PR.

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
pnpm build
git diff --check
```
