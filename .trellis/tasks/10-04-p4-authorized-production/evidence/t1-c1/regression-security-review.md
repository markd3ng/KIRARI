# T1/C1 regression and security review

Reviewed the live shared worktree at `/Users/ian/.codex/worktrees/p4-t1-c1/KIRARI`, focusing on the T1/C1 admission code, Production workflow changes, positive fixtures, owner-decision readback, and the pending evidence package. This is the independent C review requested for the amendment. It is not the post-freeze exact-head code review or Phase Exit Audit.

## Current decision state

The concrete T1 manifest and independent review file are not present yet. The existing T1 decision reference is `PENDING`; the captured full npm audit is raw FAIL with 8 moderate, 24 high, and 1 critical finding. The C1 manifest is explicitly `INCOMPLETE_OWNER_SETUP_REQUIRED`; principal, plan, roles, groups, grants, token scope, and expiry remain absent. No credential or Provider readback was fabricated.

The production gate remains fail-closed at this point. `evaluateCurrentCredential` accepts an observation only from a supplied reader callback and otherwise passes `null` to the validator. The checked-in credential gate supplies no callback, so it reports FAIL until a trusted current reader and actual Owner setup evidence exist. That is appropriate for this decision-only phase; it is not a claim that C1 is operationally ready.

## Confirmed fixes and probes

- **Audit status/count inconsistency:** I first built a synthetic complete candidate observation where both npm invocations returned exit 0 but the full v2 report contained one moderate finding. The then-current evaluator returned P4 PASS without concrete approval. The implementation added complete npm v2 count validation and `RAW_AUDIT_EXIT_CODE_INCONSISTENT_WITH_THRESHOLD_COUNTS`. Re-running the same shape against the current evaluator now returns raw `PASS`, P4 `FAIL`, and that failure code. The negative case is also represented in `p4-production-tooling-acceptance.test.mjs`.
- **Owner decision edits and later revocation:** the initial reader fetched only the referenced comment. The current reader rejects an edited approval (`updated_at` must equal `created_at`) and scans paginated issue comments, failing on a later Owner comment or incomplete scan. A synthetic exact-body approval with a later `updated_at` now fails with `CONCRETE_OWNER_DECISION_EDITED_RE_REVIEW_REQUIRED`. Tests cover a later Owner comment on the next page and an unreadable scan.
- **Per-advisory review coverage:** the evaluator now derives an advisory/reference matrix from the raw npm JSON and binds every review row to package, advisory/reference, severity, affected range, all installed paths, and proposed fix. Missing rows, substituted paths, and stub analysis fail closed. The corresponding negative cases are present in `p4-production-tooling-acceptance.test.mjs`.
- **C1 scope/elevation shape:** the pure validator requires the exact target project and team, a personal project PAT scoped to that sole project, effective Team Developer / Project Developer, complete direct and group evidence, only `Full Production Deployment`, finite token expiry, and the documented same-project capability disclosures. Owner/Member/Admin elevation, unknown groups, extra grants, missing plan/role/scope/expiry, and changed readback are rejected. Endpoint-level rights remain `UNKNOWN` and role intersection remains an inference. The operational reader is deliberately unavailable, so these fixture checks do not establish live readiness.

## Remaining fail-closed review item

The Production job executes root `pnpm install`, the P3 browser `npm ci`, and Playwright installation before installing/auditing the Vercel CLI; all are on the same hosted runner later used by the credential-bearing operation step. The Vercel CLI install helper strips Action-file variables, GitHub/Vercel credentials, npm config, and the existing user home from its own lifecycle-script environment, which narrows that exposure. It still uses inherited `PATH`, and code from earlier install steps can affect the shared workspace or process state before `VERCEL_TOKEN` is mapped.

The T1 unknown-path inventory correctly declares same-job install/postinstall persistence into the later credential-bearing step as exposed. However, the T1 material-source hash list currently omits the root install graph (`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`) and P3 browser package/lock inputs. Changes to those pre-credential install inputs therefore do not change the T1 manifest's measured material-source hashes. Bind those inputs or retain them as an explicit unbound, exposed residual risk that requires renewed T1 review; do not describe the T1 digest as binding the complete pre-credential job runtime while they remain omitted.

The concrete T1 manifest is still absent, so no nonzero audit has been accepted. This residual source-binding concern must be resolved or explicitly carried into the Owner decision package before any future T1 approval can be treated as current.

## Regression and boundary assessment

The amended workflow keeps the full moderate audit unconditional, records the plain and JSON audit invocations and both exit codes, retains the raw JSON and human-readable inventory, and keeps raw audit status distinct from P4 acceptance. T1 requires exact version, lock, tarball integrity, installed-tree fingerprint, runner/runtime/install fields, target, source hashes, finite expiry, current digest-bound Owner decision, and an independent per-advisory review. New or changed inventory data cannot reuse the previous digest. The audit command and path cannot be suppressed by the evaluator.

The Vercel secret is mapped only in the final stage/validate/promote operation step. T1 install/audit and the C1 manifest gate run before that step without `VERCEL_TOKEN`; `run.mjs` checks the concrete contracts again, and the runtime guard rechecks them before guarded writes. The workflow remains `main`-only, owner-triggered, first-attempt-only, concurrency-serialized, and attached to `kirari-site-production`. No deployment, promotion, rollback, secret/settings, or alias behavior was changed in the reviewed diffs. P1-P3 workflow/source contracts and `git.deploymentEnabled.main=false` were not changed by this amendment.

The dedicated GitHub Environment, actual reviewer/branch readback, Vercel project PAT metadata, C1 live readback, and Trusted Sources readback are still unknown/absent. The code changes do not turn those unknowns into PASS.

## Verification boundary

I ran two temporary direct evaluator probes only: the audit exit/count contradiction and an edited Owner approval. Both now fail as described. They wrote no tracked files. I did not run or alter the test suite; root owns full validation and the later frozen-head review. This review does not approve a concrete T1/C1 manifest or authorize Production.
