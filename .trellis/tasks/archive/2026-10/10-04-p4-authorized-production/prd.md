> **Historical scope, superseded by the native Git architecture correction (2026-10-15).**
> Do not execute the custom admission/upload/promotion plan below. Current implementation and acceptance are in `../10-07-p4-r3-trusted-base-bootstrap/` and Issue #99.
> P4 remains incomplete; this retirement does not claim Production deployment or authorize operational changes.

> **Owner continuation — 2026-10-10:** PR #139 retired the R3 dependency admission platform. T1 dependency approval/exception requirements below are historical and superseded. Current work refreshes existing PR #133 on main `0945eb82e76cab1878e7324ef3447f37855dfe79`, removes obsolete root-audit/T1 consumers, and retains strict artifact, credential, browser and rollback checks. Production remains separately authorized.

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

## Owner-authorized Hobby C1 remediation — 2026-10-12

Continue from main c2231c8572fb9e0961bbd296e3678acdc86a407f. Replace impossible Pro/Enterprise role/group/extended-permission assertions with exact project-scoped PAT binding on the actual Hobby account. Keep exact target/main/Owner/artifact/replay/15-minute/isolation/health/rollback controls, Issue129 detached concrete decision and no Production execution. Scope is engineering only; current candidate is not selected and a new exact merge decision is required.

Provider facts, failure readbacks, threat model and implementation/verification design: evidence/c1-hobby-20261012/capability-matrix.md and design.md. Implement schema2 with exact credential fingerprint plus authenticated Owner setup lifecycle/principal/scope metadata; fresh unfiltered project list and exact project read runtime proof; tests for malformed/unrelated/unauthenticated/stale/expired/secret-bearing/wrong-target/missing or revoked Owner approval and zero writes on failure. Run full P3/P4/build/type/QA/Trellis/browser and standard CI, then fresh independent source/security review. One unmerged PR; no duplicate governance Issue, actual token/Environment setup, Production, release/tag/P5/Gateway.
