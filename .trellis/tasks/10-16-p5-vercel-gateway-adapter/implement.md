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

## Review and reconciliation continuation — 2026-10-16

- [x] Archive completed P2, retired/custom P4, native P4, P5 first-batch and
  Portable Core tasks; preserve historical evidence and retirement reasons.
- [x] Correct Project #110 to In Review: PR #147 is implemented and open,
  not unstarted. Keep #102/#103/#104/#105/#109 Done and #112 Todo.
- [x] Reproduce and fix mixed-directory cleanup deleting hand-written routes;
  preserve symlinks and prove repeat-build idempotence.
- [x] Exclude both health route prefixes from CDN caching and add safe fixed
  unexpected-error logging without raw errors, request data or credentials.
- [x] Fix independently reproduced symlink-root and route-target escapes;
  reject them before cleanup/write and preserve outside files.
- [x] Namespace Runtime Cache by provider project ID (Hobby cache is shared
  within a team), downgrade when project identity is absent, and test distinct
  project keys without claiming a provider ACL.
- [x] Downgrade Preview Runtime Cache when branch identity is absent and prove
  the provider is never accessed. Add adapter type-check/tests to standard CI.
- [x] Restore a complete frozen-lockfile install using Node 22 / pnpm 9.14.4;
  the earlier local registry limitation no longer applies to this candidate.
- [x] Run the complete repository local checks.
- [x] Complete independent full-diff code/security review (PASS).
  Current remote HEAD/CI is tracked on PR #148 and the Issue #111 progress
  record; re-read those instead of treating initial-head CI as current proof.
- [x] Classify all three PR #148 OCR opinions and record conclusions in
  `research/progress-reconciliation.md`; synchronize their remote threads
  with the pushed candidate as part of this delivery.

The Node.js `{ fetch(request) }` export is supported by the current official
Vercel Node.js runtime and Functions API reference. The repeat-generation OCR
claim is not reproducible because cleanup runs before generation; the added
test passes on the original script. The mixed-owner-file deletion and public
health CDN behavior fail against the original source and pass after fixes.

Continuation local results before independent-review follow-ups: frozen install
PASS; `pnpm check` PASS (18 Vercel adapter tests); `pnpm site:test` 103 passed /
1 skipped; `release:check`,
`build` (112 pages), `edge:deploy:dry`, `trellis:check`,
`deploy:config:check`, and `git diff --check` PASS.

Final code verification: implementation commit `4324fb3e7a09be26384f9cbdc841662e4dc9bb98`; Vercel
adapter 20/20, route materializer 8/8, full local `pnpm check` and build PASS
after project scoping; Site suite 105 passed / 1 skipped. Independent review
PASS, with no remaining actionable code/security findings. See
`research/independent-review.md`. Final remote verification is held in
PR #148 checks and Issue #111 to avoid self-referential CI evidence commits.
