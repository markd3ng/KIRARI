# Execution

- [x] Add the dedicated Vercel adapter workspace package and Vercel Function
      route entrypoint; keep Core unchanged.
- [x] Add the canonical rewrite to the generated Vercel config and parity
      regression coverage.
- [x] Implement disabled-by-default environment parsing, allowlisted token
      injection, CDN `CACHE_EDGE`, and Runtime Cache `CACHE_PERSISTENT` with
      safe downgrade and environment isolation.
- [x] Add focused request, route, cache, and security tests.
- [x] Document Vercel setup, environment scopes, Preview, route, and cache
      semantics and limits.
- [x] Run focused adapter tests/type-check and the complete repository check,
      build, Vercel config parity, Trellis sync, and diff validation.
- [x] Review the exact final diff and HEAD. Do not push, deploy, or mutate live
      Vercel settings during this task.

## Verification evidence

- `pnpm site:test`: 101 passed, 1 skipped, 0 failed.
- `pnpm check`: passed, including Vercel adapter type-check and 16 adapter
  tests; Gateway Core tests passed (37).
- `pnpm build`: passed; 112 static pages generated.
- `pnpm release:check`, `pnpm deploy:config:check`, `pnpm edge:deploy:dry`,
  `pnpm trellis:check`, and `git diff --check`: passed.
- A clean frozen install could not fetch from the package registry in this
  environment (`ENOTCONN`). Verification used existing workspace dependencies
  and integrity-checked official Vercel package tarballs; no deployment ran.
