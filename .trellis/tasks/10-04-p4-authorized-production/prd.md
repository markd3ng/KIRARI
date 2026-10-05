# P4 / RM-05 — Owner-authorized immutable Site production

GitHub Issue #99 and Project 1 are the execution control plane. Baseline main is c79659046cf6ea73ba69e03c3937d904c07ba93b; P3/#98 completed with source run 37189363285 and package 11297428920, digest sha256:47dcbda5ed9e6ed72a6856af9700fd40b1afeeaa24623871005a515881b0c33c.

Implement a separate owner-only manual main production workflow, isolated protected environment, exact immutable artifact and target approval, replay/concurrency denial, revalidated package/composition provenance, production health/browser/robots/canonical verification, bounded secret-free evidence and rollback to a cryptographically linked approved previous release. Preserve git.deploymentEnabled.main=false. Reuse P3 verification and browser boundaries without duplicating large security flows. All P1–P3 and full repository CI must pass. Reviewed PRs and an independent gpt-6-luna/max audit are required.

Only RM-05 is in scope. No Edge Gateway, indexing notifications, DNS, releases/tags, P5+, runtime redesign or automatic production via merging. No production settings/secrets/alias/deployment/rollback writes are authorized. Engineering code, tests, Project tasks, PR/review/merge after normal gates and read-only Vercel inspection are authorized. Stop at the exact owner proposal gate before any production mutation. A reviewed rollback simulation is allowed by #99; never label it live execution. Do not close #99 or mark RM-05 Done before actual authorized production evidence and Phase Exit Audit PASS.

## Remediation continuation — 2026-10-05

Re-read Project 1, #99/#129–#132, PR #133 and latest Phase Exit Audit before changes. Baseline and PR HEAD remain as recorded; Project README stale P4 statements were reconciled. Keep parent and tooling workstream Blocked until evidence clears their actual gates.

Three separate prerequisites: (A) supported documented deployment mechanism passing the existing moderate audit; (B) newly reviewed immutable CI package with canonical https://kirari-main.vercel.app from exact reviewed config/Core SHAs; (C) dedicated protected Production Environment, isolated least-required credential, target identity and authenticated Trusted Sources readback. Preserve P3 inputs/artifact, do not rewrite output, do not invent undocumented REST semantics or audit exceptions.

Independent gpt-6-luna/max streams research/remediate A/B/C. Main integrates and preserves regressions. After frozen implementation and deterministic CI, a fresh independent exact-head review is required; a different fresh independent Phase Exit Audit assesses remaining gates. No implementation agent may certify phase completion. No authorization phrase is issued until all operational prerequisites are independently ready.

## Approved T1/C1 application — 2026-10-05

Approved T1/C1 frameworks replace the abstract old tooling/exact-verb credential blockers only as specified by Owner request (evidence/t1-c1/owner-request.txt). Produce independent concrete decision manifests, no concrete self-approval. Full unchanged audit always runs, raw FAIL remains FAIL, amended acceptance fails closed without exact separate Owner approval. C1 exact-project Developer + only Full Production Deployment; unknown setup/grants remain blocked. Preserve all existing deployment/P1–P3 invariants. Stop before any Production action.
