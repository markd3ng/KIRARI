# Implementation Plan

- [x] Refresh the evidence bundle from GitHub: all 34 Project items, 16 fields,
  parent/dependency relationships, open Issues/PRs, relevant merged PRs and
  reviews, exact-main CI, tag CI, and #122's current state.
- [x] Refresh read-only Vercel Production deployment and canonical alias
  evidence; compare `main`, `v0.5.0`, and `dev` without integrating branches.
- [x] Trace all 33 roadmap items to Issue acceptance, PR/main commits,
  implementation files, and current or archived verification evidence.
- [x] Recheck active workflows and deployment/rollback docs for retired
  controller behavior; inspect P1–P8 source/test coverage and classify live
  runtime limits separately from code acceptance.
- [x] Update `README.md` and `README_CN.md` from the current Site manifest and
  all Astro `client:*` directives; include component names, route use, and
  hydration strategies.
- [x] Correct the verified Site Trellis index if it disagrees with the current
  manifest; guard the documented Astro major with a regression test.
- [x] Add a compact `node:test` regression under `apps/site/scripts/tests/` and
  rely on the existing `pnpm site:test` glob.
- [x] Correct the current Project #1 README checkpoint using the verified main,
  Production, tag, and #122 state; read back and verify the saved text.
- [x] Write `docs/audits/KIRARI-v0.5.0-drift-audit.md` with baseline, 33-row
  matrix, field/dependency results, findings, accepted deviations, evidence
  gaps, fixes, and verdict. Do not claim an independent release review that
  did not happen.
- [x] Run `pnpm site:test`, `pnpm release:check`, `pnpm site:type-check`,
  `pnpm site:astro-check`, `pnpm build`, and `git diff --check`; use exact-head
  GitHub CI as the full standard validation.
- [x] Review the complete diff, create a short-lived branch, push, and open
  PR #163 against `main`.
- [x] Verify PR #163 final HEAD and actual standard CI after all audit metadata
  updates. Leave it open.

## Risk / rollback

The repository edits are documentation and a read-only test. Revert those
paths if validation exposes an incorrect mapping. The Project README update is
reversible and must not alter Project items or custom fields. No Production,
tag, release, credential, or deployment action is in scope.
