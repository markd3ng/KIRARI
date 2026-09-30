# Implementation and Verification Plan

1. Confirm current baseline and keep `kirari-agent-pack-v2/` untouched.
2. Dispatch A, B, and C in parallel with disjoint ownership; dispatch D when a runtime slot opens. Primary independently researches F3/F7.
3. Review every worker diff and test evidence; coordinate any cross-task interface before integration.
4. Run clean-checkout/profile negative checks, `site:test`, default and external builds, indexing isolation, dist failure/crash/repeatability checks, workflow validation, doc consistency, release checks, and diff hygiene where supported by current scripts.
5. Run an independent audit on the final diff; fix and re-verify any in-scope Blocking/High finding.
6. Create a local commit only when all required engineering gates pass. Never push, create a PR, merge, or deploy.

## Final verification — 2026-09-29

Verification checkout: `/Users/ian/.codex/worktrees/pr1-final-verify/KIRARI`, based on `d1286c9c65e561fe7ac62501d1ea027bef3be326`, with the candidate diff overlaid. `pnpm install --frozen-lockfile` completed successfully; no package manifest or lockfile changed. The profile was materialized using the repository CI step before `pnpm profile:check`.

| ID | Status | Command and result |
|---|---|---|
| V01 clean checkout and frozen install | PASS | Separate managed worktree at the baseline plus candidate diff; `pnpm install --frozen-lockfile` — exit 0. |
| V02 profile | PASS | `node apps/site/scripts/materialize-profile.mjs`; `pnpm profile:check` — exit 0. |
| V03 site tests | PASS | `pnpm site:test` — 39/39. Includes same/different-target contention, SIGKILL recovery, orphan-child shutdown, stale owner recovery, dist rollback, temp lifecycle, indexing isolation, and actual default/external integrations. |
| V04 repository checks | PASS | `pnpm check` — exit 0; site type-check, Astro check (118 files, zero diagnostics), edge type-check/tests (10/10), profile check, and Trellis check. |
| V05 default Site build | PASS | `env -u KIRARI_ALLOW_INDEXING_SUBMISSIONS pnpm build` — 112 pages; postbuild reported submissions skipped. |
| V06 external Site build | PASS | `env -u KIRARI_ALLOW_INDEXING_SUBMISSIONS ./build.sh --site packages/site-profile` — 112 pages, published complete static output; submissions skipped. |
| V07 build-only indexing isolation | PASS | `pnpm site:test` indexing cases — build-only and test environments veto both integrations before side effects; only explicitly authorized stubbed fetch is exercised. No real submission performed. |
| V08 single-process dist recovery | PASS | `pnpm site:test` dist recovery cases — injected move/rename/rollback/backup-cleanup failures recover prior or installed dist on retry. |
| V09 concurrent publication | PASS | `pnpm site:test` lock cases — same destination serialized, distinct destinations concurrent, killed waiter left owner intact; complete dist remained valid. |
| V10 publisher SIGKILL recovery | PASS | `pnpm site:test` — killed publisher preserved old dist; recovery contenders serialized; orphan build child was stopped before retry could publish. |
| V11 temporary directory lifecycle | PASS | `pnpm site:test` — SIGKILL immediately after workspace creation was recovered; same-destination recovery preserved a live owner temp; another target's live temp was preserved. |
| V12 release checks | PASS | `pnpm release:check` — all 16 checks passed. |
| V13 release version check | PASS | `pnpm release:version-check` — release metadata agrees on `0.4.1`. |
| V14 audit, independent review, and diff hygiene | PASS / findings present | `pnpm audit --audit-level moderate` completed registry scan, exit 1 for 61 findings (not an execution failure); see `research/pnpm-audit-2026-09-29.md`. Independent final audit found no Blocking/High engineering findings after the timezone fix. `git diff --check` and manifest/lockfile diff check passed. Remote CI: NOT_RUN. |

### Gate state

- `AUDIT_EXECUTION=SUCCESS`; `AUDIT_FINDINGS=FAIL` because vulnerable dependencies remain.
- `ENGINEERING_GATE=PASS`; all required local checks and the independent engineering audit passed.
- `SECURITY_RELEASE_GATE=BLOCKED`; F3 and F7 remain unresolved and the complete audit also contains other High/Critical findings. No dependency upgrade was made.
- No push, PR, merge, deployment, or real indexing submission was performed. `kirari-agent-pack-v2/` was excluded from changes and the local commit.
- Dispatch requested `gpt-6-luna` with max reasoning. The runtime exposed only `GPT-6` and did not expose a reasoning-effort value. Maximum observed concurrency was four agents including the primary agent (primary plus A/B/C).
