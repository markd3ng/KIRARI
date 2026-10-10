# Base-controlled R3 verifier and App publisher

## Current readiness

This implementation deliberately cannot publish a successful native required check. A valid exact decision may produce technical `PASS` and eligibility `VALIDATED`, while merge admission remains `BLOCKED` and the App check completes as `failure`. This is hard-coded, independent of policy or environment overrides. The ruleset proposal is disabled, unapplied, and not apply-ready.

GitHub Checks API conclusions have no authorization-expiry predicate. Required status checks bind a context and optional integration ID to a commit; their rules do not atomically evaluate this verifier's external ID, decision body, PR/base bindings, or expiration. Periodic invalidation can race a merge or fail during an App/API outage. The implementation therefore does not establish continuing merge authorization. A separately reviewed final merge-admission design and live App/Environment/recovery verification remain activation prerequisites.

## Technical verifier and immutable candidate inputs

The verifier is `workflow_dispatch` only, selected on current `main`. Every action is pinned by commit. It checks out the exact trusted main commit and keeps GitHub permissions read-only. Candidate allowlisted files come from the contents API at an exact head SHA and remain data. No candidate checkout, installation, workflow, evaluator, policy, lifecycle script, package-manager config, hook, or artifact executes.

Exact base/head Git commits bind complete recursive Git trees. The authoritative changed-path set compares blob/tree/gitlink identities and modes, retaining protected deleted paths and directory replacement paths. Truncated, malformed, duplicate, oversized, or incomplete trees fail closed. Mutable Pull requests file rows retain original rename paths and count/pagination checks, but are corroboration only: an A/B/A metadata race cannot substitute those rows for the immutable tree comparison. Candidate immediate workspace symlinks/gitlinks, symbolic fixed inputs, or extra immediate workspace package manifests fail closed even when unchanged and absent from the lockfile.

Trusted policy protects `.github/workflows/`, `scripts/root-audit/`, `pnpm-workspace.yaml`, and root/fixed-importer `.npmrc` and `.pnpmfile.cjs`. Changes require a separate Owner-controlled trust-root procedure. Candidate copies cannot weaken the rule. See the [changed-path contract](../../.trellis/spec/repository/root-audit-inputs.md).

The audit subprocess runs as Linux `nobody` in a generated workspace and a fresh environment without GitHub credentials. Only fixed identity/dependency manifest fields, the candidate lockfile, and trusted generated workspace configuration are materialized. No install runs. One unignored `pnpm@9.14.4 audit` retains JSON, stderr, and its real exit code. A separate derived normal view removes only independently validated #122. Counts and complete affected versions reconcile with the pinned [audit-format contract](../../.trellis/spec/repository/root-audit-format.md). Lock topology independently pins the eight R3 routes and separate #122 routes. Existing root CI continues to fail visibly on R3; nothing consumes or suppresses it.

The CI Linux isolation smoke executes the actual audit boundary with a nonsecret token sentinel and malicious lifecycle/hook inputs. It checks the real `nobody` UID, clean subprocess environment, nonexecution, and raw R3/#122 findings. Candidate CI is engineering evidence, not live App provenance or a trusted-base establishment procedure.

## Decision and continuing eligibility

A missing `decision_comment_id` leaves eligibility `PENDING` and non-consumable. A supplied ID fetches only that exact #135 comment and verifies issue, marker, Owner login/association, schema, exact candidate/base/policy/verifier/review digest bindings, body digest, and expiration. A deleted/unmarked record remains pending; malformed or unauthorized records fail closed. Review-reference digests supplied by an Owner are references, not independently fetched or authenticated review evidence.

Trusted policy separately pins open #122 and #135 state, exact title, and exact API body SHA-256 without trimming. The publisher bundle includes both contracts and `checkedAt`. Evidence age must be nonnegative and under fifteen minutes; expiration and full live identities are checked before credential eligibility, publication, and completion. Changed head repository, PR/head/base, current main, issue body, selected decision, or newer verifier attempt invalidates eligibility. Same-run changed evidence is rejected and exact blocked results are idempotent.

The publisher authenticates upstream run/repository/workflow IDs, path, event, branch, run/attempt, creation timestamp, immutable main SHA, target run title, and later-run ordering through read-only APIs before entering its Environment. Artifact name, canonical result/evidence digests, policy provenance, and candidate source must match. Workflow names alone confer no authority. Pending events invalidate prior same-App/head successes and publish `in_progress`; every completed path emits `failure`, including valid eligibility. No `success`, `neutral`, or `skipped` conclusion is allowed. Publication and revocation share one serialization group, but that serialization does not include native GitHub merge admission.

## Best-effort revocation and outage

The main-only revalidation workflow can run manually, every five minutes, or after issue/comment events. Its repository enable variable defaults off; source validation occurs before the Environment or private key. It enumerates bounded PR heads and invalidates every observed success from the dedicated App/context/head, including legacy success lacking decision metadata. It never renews success. API responses and readback must prove each observed success became failure; partial errors, missing credentials, App outage, or installation revocation report incomplete invalidation and a nonzero exit. Historical green may remain during outage. This is a revoke-only mitigation, not continuous or atomic enforcement.

## App, Environment, ruleset, and recovery

The prepared private App belongs to `markd3ng`, installs only on `KIRARI`, and requests `checks: write` plus implicit `metadata: read`. The read-only workflow token handles Contents, Actions, Pull requests, and Issues. Installation tokens are short-lived and revoked by the pinned token action. No PAT is proposed as a long-term trust root. The manifests and consolidated Owner checklist describe disabled callbacks/webhooks, key custody, exact Environment branch policy `main`, no administrator bypass, opt-in variable, and live verification gates.

Keep the private key outside repository Actions until the trusted base, reviewed final admission, credential isolation, and separately authorized protection prerequisites are established. An Owner-controlled isolated harness must prove actual App identity, installation permissions, benign check provenance, source binding, outage behavior, and settings recovery. Never paste keys into the conversation or evidence. The documented UI source-selection permission discrepancy is an isolated live REST binding gate, not permission to silently grant `statuses: write`.

The ruleset is an inert planning wrapper with `apiPayload: null`, `enforcement: disabled`, a pending real integration ID, required PRs, zero review approvals, stale review dismissal, strict up-to-date checks, no bypass actors, force-push/deletion protection, and the repository's three existing merge methods. It would lock out ordinary merges while required success is disabled, so it must not be activated. Owner recovery uses Settings or the authenticated ruleset-management API to disable the exact ruleset ID and restore/read back prior JSON independently of branch updates or App health. The App has no Administration permission. Static recovery checks are not a live recovery demonstration.

A future exact-head implementation merge while root CI remains R3-red needs new narrow Owner authorization. It does not authorize App credentials, ruleset activation, R3 consumption, PR #133, Production, release/tag, P5, or Edge Gateway work.

## Final admission inspection and isolated live verification

PR #137 was merged under its exact Owner engineering authorization at `c46fa39e0028c03fc134952c985c10494a4daf63`. The reviewed source tree matched its frozen head. This established an inert engineering base; it did not establish protected main, App custody, operational success, or R3 consumption.

`final-admission.mjs` reconstructs exact verifier evidence, checks current eligibility twice around authenticated publisher observations, and rejects drift, replay, expiry, revoked decisions, incorrect App provenance and unreadable APIs. Its fixed platform capability is `NOT_READY`. Even a valid observation returns `VALIDATED_BUT_BLOCKED`; the module issues no grant and performs no merge. GitHub's native merge API compares the expected head SHA but has no server transaction over decision expiry/revocation and Issue contracts. An exclusive external controller can reduce alternative merge paths, but a client-side last read still leaves a race before GitHub commits. App setup cannot close that platform limitation.

`app-custody-inspect.mjs` is a local Owner-only metadata/token inspector for the fixed KIRARI repository and numeric identity. It verifies a real App's ID/client ID/slug/owner, minimal permissions, selected installation and exact short-lived token scope, then revokes and confirms rejection. Its transport permits only metadata reads, exact token mint and revocation; it cannot publish a production check, change refs/settings, merge or apply a ruleset. Run it from the independently reviewed source on an isolated Owner host with a private key file outside source trees. It does not attest required-check provenance or PR credential isolation from metadata alone.

```sh
KIRARI_APP_PRIVATE_KEY_FILE=/secure/local/publisher.pem node scripts/root-audit/app-custody-inspect.mjs /secure/local/app-public.json /secure/local/app-inspection.json
```

The public JSON contains numeric `id`, numeric `installationId`, `clientId` and `slug`, taken from actual Owner App settings. Private keys must be regular Owner-owned files, mode600 or tighter; never place key contents in public JSON, chat, source or evidence.

The executable [live harness](./live-harness-setup.md) uses a disposable repository (private by default, or explicitly public with harmless fixture data), nonce-owned non-default branches, two separate checks-only lab Apps and an independent lab-only Owner administration credential. It exercises real GitHub check-source binding, native merge attempts, expiry/revocation/stale-green observations, client outage injection, token revocation, and exact ruleset disable/restore/readback. Its real mode has no path to KIRARI; loopback HTTP tests execute the same orchestrator using synthetic server fixtures. Controlled client faults are not a claim that GitHub's servers failed. A successful stale-green lab merge demonstrates the native limitation and retains `NOT_READY`.

Real App/installation permissions and live native recovery remain unverified until Owner setup supplies real identities and isolated credentials. Private personal-repository rulesets also require a supported account plan; unavailable rulesets fail the harness rather than being silently skipped. Keep the production App installed only on KIRARI, with separate lab Apps installed only on the lab. No key may enter Actions or publisher opt-in be enabled while final admission remains unavailable. Disabled payload preparation never authorizes applying production protection.

The advisory OCR launcher in pinned npm version1.12.11 can start a detached global updater during earlier composite steps. The workflow sets `OCR_NO_UPDATE=1` to preserve the pinned executable. The observed exit127 may be consistent with that reinstall race; the old log lacks enough telemetry to prove its exact low-level cause. A live advisory review must be observed separately before claiming launcher recovery.

## Verification

Run `node --test scripts/root-audit/tests/*.test.mjs` and the existing workflow contract suite. Run `node scripts/root-audit/tests/activation-matrix.mjs <output.json>` for the isolated expected/observed matrix, and `node scripts/root-audit/tests/linux-isolation-smoke.mjs` only on Linux with the workflow's sudo boundary. Exact-head CI, independent code/security review, and independent Phase/Gate assessment are recorded in the existing Trellis task. Local mocks and candidate CI do not establish live enforcement.

## Historical one-time bootstrap policy

PR #136 was merged at `b3a295f30bc89083d03f03d77e6060b602f785e5` after explicit approval of head `0d8525249803e3f51d4b056a3552b4d7fe99fd33`. Its evidence and authorization are historical; neither authorizes a future implementation merge. The original bootstrap policy follows.


Normal merge policy blocks on red required security checks. PR #136 establishes the trusted base needed to adjudicate later R3 consumption; requiring consumption before that infrastructure exists would be circular. An Owner may later explicitly approve **only the exact reviewed PR #136 head** despite generic CI failing solely on the existing R3 advisory. This is a manual, one-time bootstrap decision, not an automated check, consumption decision, general CI bypass, or repository setting.

Eligibility requires all source/build/test/verifier/publisher checks to pass, supported non-R3 findings to be remediated, the normally executed raw audit to remain honestly `FAIL`, and zero otherwise unapproved moderate/high/critical findings except `GHSA-rj75-hqrm-r3gf`. R3 must remain unsuppressed with its unchanged versions and paths; #122 remains separately scoped and validated. Browser fixtures and every pre-audit verify step must pass on the exact head. Any new qualifying non-R3 finding requires `NOT_READY_NEW_FINDING` and stops this policy.

The canonical Owner evidence package binds repository, PR, exact base/head, full file list/diff, manifests/lock/raw audit, R3 inventory, #122 body/state, verifier/publisher/workflow/proposal digests, test results, exact-head CI, and fresh independent code/security reports. Required verdicts are `PASS_NO_ACTIONABLE_FINDINGS` and `READY_FOR_BOOTSTRAP_OWNER_DECISION`. The proposed local decision uses `kirari.r3-trust-root-bootstrap-merge/v1`; it is never interpreted by the R3 consumption parser. A later source, lock, evidence, head, or base change invalidates it.

A future explicit approval may authorize merging only that exact head to establish reviewed code on `main`. App creation/installation, Environment/secrets, concrete ruleset application/readback, R3 consumption, PR #133, T1/C1, and Production remain separate later gates. Until then merge, consumption, and Production authorization remain `NO`. No runtime or CI suppression implements this policy.

## Sources

- [GitHub Checks REST API](https://docs.github.com/en/rest/checks/runs)
- [GitHub rules REST API](https://docs.github.com/en/rest/repos/rules)
- [GitHub Git trees API](https://docs.github.com/en/rest/git/trees)
- [Required status-check semantics](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks)
- [Workflow event semantics](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- [Environment branch policy and deployment protections](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
