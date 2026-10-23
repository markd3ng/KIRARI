# Execution plan

1. [x] Complete child `10-23-baseline-ads-browser-branch-audit`: fetch fresh state; inspect ADS v0.3 integration/guidance; read assigned issue or owner criteria; capture GitHub, Actions, Project, Vercel, and Production SHA; inspect Ego Lite; run browser matrix with captured evidence; audit all unique dev commits and tip-tree differences; write the ledger and baseline report.
2. [x] Review child 1 artifacts and confirm its report contains the required facts and unresolved evidence gaps; the user confirmed the animation is the symptom.
3. Complete child `10-23-layout-fix-dev-reconciliation`: reproduce and isolate cause; implement only a supported fix with regression coverage; preserve/adapt valid dev changes; create focused PRs; run exact-HEAD required Actions and independent review; merge only passing PRs through the normal PR process and verify post-merge CI. Do not bypass any active protection.
4. Complete child `10-23-v051-release-production-acceptance`: confirm `v0.5.1` is still absent; create a dedicated Release PR with accurate metadata/changelog; run repository-defined release checks, required Actions, and independent review; merge and verify post-merge state; align dev with final main content through the normal process.
5. Re-evaluate all tag gates. If any fail, stop before tagging and report the precise blocker. Otherwise create the annotated tag at the frozen verified release SHA, push, and verify tag object, peeled commit, tag CI, and unchanged `v0.5.0`.
6. Verify the automatic Vercel Production deployment is READY, uses the exact release merge SHA, and serves the canonical URL; run post-fix regression checks where applicable.
7. Re-read relevant GitHub Project items after any justified status change. Save the complete evidence ledger/report and populate every machine-readable summary field.

## Validation and evidence

- Prefer existing GitHub Actions, Preview deployment, and platform integrations; use local checks only when remote verification cannot proceed.
- Discover actual repository scripts before running build/test/release commands.
- No code, tag, merge, project write, or deployment action before its documented prerequisite gate.
- Keep browser traces/screenshots and audit artifacts in task-scoped evidence locations, outside Production source and the Release PR.

## Rollback points

- Before merge: close or revise the focused PR.
- After implementation merge: use a reviewed revert PR if the behavior is wrong.
- Before tag: resolve branch/version issues normally; no tag exists to move.
- After tag creation: never move it; report the issue and use a corrected follow-up release if needed.
