# KIRARI v0.5.1 ADS v0.3 acceptance pilot

## Goal

Diagnose and, when evidence supports it, fix the Production first-screen layout jump; account for every meaningful `dev` versus `main` difference; and release `v0.5.1` only after the required review, CI, branch, tag, deployment, browser, and GitHub Project gates pass.

## Confirmed facts

- The requested repository is `markd3ng/KIRARI`; target Production URL is `https://kirari-main.vercel.app/`.
- The current local checkout was clean on `codex/v0.5.0-post-release-audit` before Trellis task artifacts were created.
- Fresh fetch reports `origin/main=60691880f04ae8d36ef49f710edea09a89075514`, `origin/dev=757b1aa9e5acb582ad71ee2f54491f48c6377f34`, merge base `5d3739a84c8bb813b89784e86a73032d95bd1696`; `v0.5.0` exists and `v0.5.1` did not exist at that check.
- `.ads` and `.gitmodules` are absent from the checkout. Official ADS GitHub Release `v0.3` (release ID `421553315`, published 2026-10-23T07:24:28Z) uses tag `v0.3`, which peels to `1e07d6c4bbd296b7d37dcd31934cfc70426f73ac`.
- The user explicitly authorizes the required PR merges and `v0.5.1` tag only after the stated gates pass.
- The 2026-10-23 read-only baseline found stable hero geometry on the current Production SHA; the visible 18px/680ms entrance animation remains a possible match for the reported jump, pending the user's symptom confirmation. See child task `10-23-baseline-ads-browser-branch-audit`.
- Current GitHub inspection found no branch-protection rule or ruleset. This is an unprotected repository configuration, not a license to merge without the task's exact-HEAD CI and independent-review gates; use the normal PR merge path and honor any policy enabled before merge.

## Requirements

- Follow the user-supplied acceptance plan and the frozen ADS v0.3 release; preserve KIRARI-specific deployment architecture and existing protections.
- Gather fresh remote GitHub, GitHub Project, Actions, Vercel, and Production evidence. Do not infer a successful check, merge, tag, or deployment.
- Investigate layout movement in clean browser contexts at 1440×900 and 390×844, including initial load, hard refresh, homepage/blog navigation, and refresh after scrolling; repeat initial load and hard refresh at least three times where feasible.
- Classify every meaningful dev-only commit and tip-tree difference as preserve, adapt, superseded, or explicitly abandon, with evidence.
- Implement a focused UI fix only if runtime evidence establishes a defensible root cause. Add a regression check where technically feasible.
- Use focused PRs, remote-first verification, independent review, protected merge paths, and actual post-merge checks.
- Update version/changelog only after implementation and reconciliation merges; synchronize `dev` to final `main` content before tagging.
- Create the annotated `v0.5.1` tag only when every prerequisite passes; verify tag CI and Production deployment against the release merge SHA.
- Reconcile only relevant GitHub Project items when evidence and permissions support the change.
- Preserve the audit report and evidence in task-scoped locations and populate the requested machine-readable summary with evidence or explicit `UNKNOWN`/`NOT_RUN`/`BLOCKED` values.

## Acceptance criteria

1. ADS release SHA, submodule state, Skill discovery, GitHub/Actions/Project/Vercel baselines, and browser-control capability are recorded from current evidence.
2. Layout root cause is either demonstrated with repeatable evidence and corrected with regression coverage, or explicitly remains unconfirmed with its evidence gap.
3. No meaningful `dev`-only change remains unexplained; all valid changes are reconciled and all superseded changes have evidence.
4. Required implementation and reconciliation PRs pass exact-HEAD checks and independent review, merge normally, and pass post-merge checks.
5. The separate 0.5.1 Release PR accurately records actual changes, passes required checks/review, and merges normally.
6. `dev` has the final `main` file tree before any tag is created.
7. The annotated tag points to the verified release commit, tag CI passes, and `v0.5.0` is unchanged.
8. Production Vercel deployment is READY on the canonical URL and matches the Release PR merge SHA; post-fix browser checks pass if a fix was implemented.
9. Relevant GitHub Project state and the final report reflect actual evidence. If any gate fails, report `PARTIAL` or `BLOCKED` and stop dependent actions.

## Task sequence

- `10-23-baseline-ads-browser-branch-audit`: read-only baselines, ADS inspection, browser investigation, and complete branch-difference ledger.
- `10-23-layout-fix-dev-reconciliation`: after the first child is reviewed, implement a supported fix and reconcile only valid branch differences in focused PRs.
- `10-23-v051-release-production-acceptance`: only after implementation/reconciliation gates pass, prepare the release, align branches, tag, verify Production, and reconcile project items.

## Out of scope

- General refactoring, unrelated dependency upgrades, broad ADS changes, replacement deployment infrastructure, production diagnostic instrumentation, branch protection bypasses, rewriting protected history, or unsupported claims of completion.

## Open questions

- Does the intentional 18px/680ms hero fade-up match the reported first-screen jump? Do not change runtime behavior until confirmed.
