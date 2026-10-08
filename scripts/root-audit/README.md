# Base-controlled R3 verifier and App check publisher

## Technical verifier

The trusted verifier remains `workflow_dispatch` only. Its job runs only for the selected `main` ref, checks out that exact trusted commit, and keeps `GITHUB_TOKEN` read-only (`contents`, `pull-requests`, and `issues`). It reads the selected PR's allowlisted files from GitHub's contents API at the exact head SHA and treats every response as data. It never checks out the PR, installs its dependencies, loads its package-manager config, or executes its workflow, scripts, evaluator, or artifacts. The PR's workflow, evaluator, CLI, and policy files are included only in the candidate digest.

The trusted side is the workflow and files in this directory at the selected `main` commit. The workflow pins every action by full commit SHA. The audit subprocess runs as the separate unprivileged `nobody` user with a fresh environment that contains no GitHub credentials; the token-bearing API process runs under the workflow user. Its temporary workspace is built from trusted generated workspace configuration and manifests containing only package identity and dependency fields; it has no candidate lifecycle scripts, `.npmrc`, or `.pnpmfile.cjs`. No install command is run. The verifier runs one raw, unignored `pnpm audit`, retains that JSON, stderr, and real exit code, then derives a separate normal view by removing only the independently validated #122 advisory. The raw severity counts must match the unignored advisory set. The derived view preserves pnpm 9.14.4's raw counts and other metadata, and differs only by that exact advisory row because pnpm calculates those totals before applying `ignoreCves`. All evidence is retained in a finite-lived artifact named with both workflow run ID and attempt.

The pinned pnpm 9 audit format counts affected package-version findings, rather than advisory IDs: one R3 advisory with two versions contributes two moderate findings. Optional `dev`, `optional`, and `bundled` flags may be absent; when present they must be booleans. The unignored totals must reconcile with every finding, including low findings and the separate #122 exception. pnpm enriches paths from installed modules, so the isolated workspace can return all-empty path arrays. Exact affected versions must still match, with every route checked independently by the lock parser; any supplied audit paths must match the complete expected inventory. See the [verified audit-format contract](../../.trellis/spec/repository/root-audit-format.md).

## One-time bootstrap Owner decision

Normal merge policy blocks on red required security checks. PR #136 establishes the trusted base needed to adjudicate later R3 consumption; requiring consumption before that infrastructure exists would be circular. An Owner may later explicitly approve **only the exact reviewed PR #136 head** despite generic CI failing solely on the existing R3 advisory. This is a manual, one-time bootstrap decision, not an automated check, consumption decision, general CI bypass, or repository setting.

Eligibility requires all source/build/test/verifier/publisher checks to pass, supported non-R3 findings to be remediated, the normally executed raw audit to remain honestly `FAIL`, and zero otherwise unapproved moderate/high/critical findings except `GHSA-rj75-hqrm-r3gf`. R3 must remain unsuppressed with its unchanged versions and paths; #122 remains separately scoped and validated. Browser fixtures and every pre-audit verify step must pass on the exact head. Any new qualifying non-R3 finding requires `NOT_READY_NEW_FINDING` and stops this policy.

The canonical Owner evidence package binds repository, PR, exact base/head, full file list/diff, manifests/lock/raw audit, R3 inventory, #122 body/state, verifier/publisher/workflow/proposal digests, test results, exact-head CI, and fresh independent code/security reports. Required verdicts are `PASS_NO_ACTIONABLE_FINDINGS` and `READY_FOR_BOOTSTRAP_OWNER_DECISION`. The proposed local decision uses `kirari.r3-trust-root-bootstrap-merge/v1`; it is never interpreted by the R3 consumption parser. A later source, lock, evidence, head, or base change invalidates it.

A future explicit approval may authorize merging only that exact head to establish reviewed code on `main`. App creation/installation, Environment/secrets, concrete ruleset application/readback, R3 consumption, PR #133, T1/C1, and Production remain separate later gates. Until then merge, consumption, and Production authorization remain `NO`. No runtime or CI suppression implements this policy.

## Protecting the publisher trust root

After this bootstrap lands on `main`, the verifier reads the complete changed-file list for the exact PR and compares it against the protected path policy from its trusted base. Ordinary App checks fail if a PR changes any file under `.github/workflows/` or `scripts/root-audit/`. That covers the publisher workflow, verifier workflow, publisher/verifier implementation, action and policy manifests, and any new workflow that could request the publisher Environment. The list is fetched through the read-only Pull requests API, paginated to GitHub's documented 3,000-file ceiling, reconciled against the PR's `changed_files` count, and re-read with PR metadata after the audit; incomplete, unstable, duplicate, or oversized results fail closed. Candidate copies of the policy and scripts remain data and cannot weaken the trusted base's path rule.

For renamed API entries, both `filename` and `previous_filename` enter the affected-path set. Moving a workflow or verifier source out of a protected directory therefore fails the same gate as editing or deleting it. The API row count remains separate from that deduplicated path set: at most 3,000 file rows can yield 6,000 paths. A renamed row without a valid, distinct original path fails closed. See the [verified changed-path contract](../../.trellis/spec/repository/root-audit-inputs.md).

This path rule is the second gate after the separately required App source binding. The bootstrap PR itself is reviewed manually against its full frozen diff because the pre-bootstrap `main` does not yet contain this rule. Once installed, an ordinary PR cannot use the zero-approval required-check design to update the trust root. Such updates need a separate Owner-controlled trust-root change procedure; they are not authorized by an ordinary App check and no ruleset bypass actor is proposed.

The lock parser accepts the pnpm v9 importer/snapshot structures used by the candidate, validates the candidate workspace manifests against all four lockfile importers, checks package resolutions against snapshot identities, and walks the full dependency graph. It compares the exact eight R3 paths and versions. It separately pins #122's GHSA, CVE, package, version, canonical route, and observed lockfile routes to the same package/version. It does not treat #122 as an R3 exception or use candidate policy data to decide what is ignored.

The #122 record uses the SHA-256 of its exact API body, with no trimming or normalization. The bootstrap's before/after readback found that the issue itself was unchanged while the prior policy body hash was stale; only that hash is corrected to the recorded actual body. The issue, exception scope, independent validation, dependency routes, and existing package-manager ignore remain unchanged. A recorded API-body fixture verifies the binding and rejection of a changed body.

## Decision record lookup

The verifier does not scan or paginate all Issue #135 comments. `decision_comment_id` is optional. If omitted, the decision remains `PENDING` and non-consumable; unrelated comments cannot affect the result. If supplied, the verifier fetches only that exact comment ID and validates the issue URL, API comment ID, marker, `markd3ng` login, `OWNER` association, record schema, bound candidate/base/policy/verifier/security-review digests, and expiry. A deleted or unmarked selected comment remains pending and non-consumable; a malformed or unauthorized selected marker fails closed. The publisher re-fetches a selected decision and rejects publication if its exact body digest, author, issue, or expiry changed.

The verifier can record an optional Owner-supplied `security_review_sha256` reference, but it does not fetch or inspect the report or authenticate the reviewer. This value is not a condition for the automated technical PASS and the App check does not claim an independent review occurred. Before any separate Owner decision, the Owner must inspect the exact report and verify its digest; an authenticated Owner decision may bind that reference. This technical check is not a substitute for the independent code/security review gate.

If supplied, the digest is a `workflow_dispatch` input reference. The verifier checks its format and binds the value, but does not fetch the review report or authenticate the reviewer's identity. It is optional for technical PASS and required to match any selected approved decision record. For the bootstrap decision, the Owner must inspect the actual reports and verify their digests against the frozen PR head; a syntactically valid digest alone is not proof that a review occurred.

An audit pass is technical evidence only. The App check is an enforcement-facing technical verifier result. It is not an R3 consumption approval, exception application, or merge authorization. A pending decision remains non-consumable, and `exceptionApplied` and `exceptionConsumed` remain false. Issue #135's current authorization remains `NO`.

For a future exact decision comment, put the JSON object immediately after the marker and include only these fields:

```json
{
  "schema": "kirari.r3-consumption-decision/v1",
  "decision": "APPROVE_R3_CONSUMPTION",
  "repository": "markd3ng/KIRARI",
  "issue": 135,
  "commentId": 0,
  "candidateHeadSha": "<40-character SHA>",
  "baseSha": "<40-character SHA>",
  "candidateDigest": "<64-character SHA256>",
  "policyDigest": "<64-character SHA256>",
  "verifierDigest": "<64-character SHA256>",
  "securityReviewDigest": "<64-character SHA256 of the manually inspected review report>",
  "expiresAt": "<UTC ISO-8601 timestamp within seven days>"
}
```

When that ID is selected, `security_review_sha256` must match the record. No current decision record is asserted by this task.

## Dedicated App publisher (Model A prototype)

The separate `r3-trusted-publisher.yml` workflow listens for `requested`, `in_progress`, and `completed` events for the named verifier on `main`. The workflow name is only preliminary routing. An uncredentialed `validate-source` job checks the authenticated upstream run ID, run number, attempt, and creation timestamp against the Actions REST API, resolves its numeric workflow ID through the workflow API, and requires the exact `.github/workflows/r3-trusted-verifier.yml` path, `workflow_dispatch` event, `main` ref, same repository ID, and matching run/attempt. The trusted `run-name` binds PR number, candidate head, and base for every event. Before Environment access and again before a check mutation, the publisher lists authenticated verifier runs created at or after the current run's authenticated `created_at` time and rejects any event superseded by a later run or attempt for the same PR/head/base. This avoids paging through irrelevant historical runs while failing closed if the recent relevant result set itself exceeds the REST API's 1,000-result search ceiling. A `requested` or `in_progress` event writes an App check with `in_progress` and invalidates any earlier same-head App success while verification runs. Successful completed runs additionally require the exact artifact name, canonical result and evidence digest, current PR head/base/state, and any selected decision. Non-success conclusions and missing/invalid success evidence write a dedicated-App failure for the exact target. Publisher events serialize by the authenticated run title, which binds the target PR/head/base. The API's workflow-run `path` contains a ref suffix (for example `.github/workflows/build.yml@main`); it is checked against the exact path and selected main ref, then the workflow-ID endpoint is checked for the bare exact file path.

Only after this read-only job succeeds can the dependent publisher job start with the `r3-trusted-publisher` Environment. It repeats the evidence and live-state validation, then mints a repository-scoped App installation token for `KIRARI` with `Checks: write` only. The private key is referenced only in the token-mint step. The workflow does not check out or execute candidate content; it checks out publisher source from `github.workflow_sha`, a trusted default-branch workflow definition commit. A candidate workflow with the same name or a same-named check/status cannot pass the run-ID/workflow-ID/API source binding, and the future ruleset binds the required context to the App integration ID.

The canonical publisher bundle records repository ID/name, PR number, exact candidate head/base, candidate digest, verifier main SHA/path/workflow SHA, run ID/attempt, verifier/policy/evidence digests, optional Owner-supplied review-reference digest, and optional decision identity/expiry. The publisher recomputes the evidence digest and compares the bundle to `result.json`. Its deterministic external ID hashes those bindings plus publisher SHA/path and publisher-policy digest. A repeated exact run/result is idempotent; reusing an external ID with changed evidence is rejected. The trusted verifier run title binds the exact PR number/head/base so even a failed, cancelled, timed-out, neutral, or skipped verifier run can be authenticated without its success artifact. The publisher writes an App failure for that exact candidate and changes any earlier success from the same App/check/head to failure; the subsequent verifier start also invalidates older success by leaving an exact-head App check in progress. A successful App check publishes only after canonical evidence passes, an exact APPROVED eligibility record is revalidated with open Issue #135, and no later run for the same target superseded it. A PENDING technical PASS publishes failure, never merge-eligible success. Every check is created for the exact current PR HEAD, and the publisher re-reads PR, `main`, and verifier-run order immediately before completing the check. A head update yields a check on an old SHA; a base update requires a new verifier run and the future strict/up-to-date rule. If the publisher itself is unavailable, it cannot revoke an older check; the live setup must test this operational dependency, and the App check remains a point-in-time technical result rather than continuing R3 authorization.

Only `success` and `failure` are valid completed App conclusions. The publisher may create an `in_progress` check when a verifier run is requested or starts, then completes the same attempt check as `success` only after all bindings pass. A non-success verifier run or missing/invalid result artifact completes as `failure`; `neutral` and `skipped` are never emitted. If the publisher itself is unavailable, it cannot revoke an earlier check, so live setup must test the publisher's availability dependency and the separate Owner gates remain authoritative. `workflow_dispatch` execution and the publisher workflow's Actions job are evidence/orchestration; only the dedicated App check is the future required status.

## Existing PR #136 checks against the future gate

These are the observed results at PR #136's 2026-10-06 baseline head. The four Actions checks all use the shared GitHub Actions app ID `15368`; none authenticates the protected-base verifier or qualifies as the dedicated App source. Vercel contexts succeeded but the status endpoint did not expose a GitHub creator identity.

| Check | Observed baseline | Trigger and skip coverage | Source authentication | Future-gate assessment |
|---|---|---|---|---|
| `verify` | `FAILURE` at the `pnpm audit` step | CI workflow triggers on pull requests, pushes to `main`/`dev`/`config`, `v*` tags, and manual dispatch; the `verify` job has no fork-specific skip | Candidate-branch Actions workflow, shared app ID `15368` | PR coverage is broad, but its source is candidate-controlled and not independently authenticated; currently failing and not required |
| `browser-fixtures` | `SUCCESS` | Shares the CI triggers; its job skips fork PRs and runs for same-repository PRs | Candidate-branch Actions workflow, shared app ID `15368` | Not universal across forks; success does not prove trusted source; not required |
| `composition` | `SKIPPED` | Runs on manual dispatch, pushes to `config`, and PRs whose base is `config` | Candidate-branch Actions workflow, shared app ID `15368` | Not applicable to ordinary `main` PRs; not required |
| `Advisory OCR Review` | `SKIPPED` | PR `opened`/`synchronize`/`reopened`/`ready_for_review`; job skips drafts and fork PRs | Candidate-branch Actions workflow, shared app ID `15368` | Not universal across drafts or forks; not required |
| Four Vercel status contexts | `SUCCESS` | Deployment-specific; available evidence does not show universal PR coverage | External Vercel source; creator identity is absent from the observed status response | No demonstrated universal trigger or dedicated GitHub App identity; not required |

The baseline demonstrates current outcomes only. It does not establish an active ruleset or branch-protection requirement, and none of these existing checks substitutes for `KIRARI / R3 trusted verifier` from the future dedicated App.

### Credential and endpoint permissions

| Operation | Credential | Minimum permission |
|---|---|---|
| Check out trusted publisher source | `GITHUB_TOKEN` | `contents: read` |
| Read upstream workflow run, attempt, and artifact metadata/download | `GITHUB_TOKEN` | `actions: read` |
| Read live PR head/base/state | `GITHUB_TOKEN` | `pull-requests: read` |
| Read one selected Issue #135 comment | `GITHUB_TOKEN` | `issues: read` |
| List/create/update check runs | Dedicated App installation token | `checks: write` |

No App read permission is needed for candidate, PR, workflow, artifact, issue, or evidence access. The App is planned for installation only on `markd3ng/KIRARI`; GitHub's implicit metadata baseline is the only other App permission. No Contents, Pull requests, Issues, Actions, Administration, Deployments, Secrets, Environments, or status permission is proposed for the App.

### Model A and Model B

Model A is selected for this prototype with a required live-setup gate. GitHub documents that an Environment's selected branch policy compares against the workflow run's `GITHUB_REF`; `workflow_run` uses the default-branch ref. The future Environment must therefore allow the explicit branch `main`, not “protected branches only” (which is not restrictive when no protection exists), and must disable administrator bypass. A candidate-generated run may still trigger the listener and the listener's own ref will be `main`, so Environment policy alone does not isolate the secret. The uncredentialed API-validation job and its dependent job-level eligibility condition provide upstream event/workflow ID/repository/path checks before the Environment-bearing job starts. After bootstrap, the trusted-base path gate also blocks ordinary PR changes to every workflow and publisher/verifier source before the App check can succeed. These contracts and event fixtures can be tested locally, but the live Environment and credential boundary are not created or proven by this task; Owner setup and independent security review remain required.

Model B, a separately hosted App publisher, is not selected because it adds a network-facing service/webhook, long-lived key custody, persistent replay state, retry/idempotency handling, availability duties, and another operational attack surface. It remains a fallback only if independent security review rejects Model A's Environment/job boundary. No App, key, secret, Environment, or external endpoint is created here.

The `pull_request_target` event is not used. The documented public-repository event-policy enforcement scheduled for 2026-11-02 is not part of this architecture.

## Ruleset and later Owner gates

`ruleset-proposal.json` is an inert planning wrapper, not a GitHub REST API payload. It proposes `main`, an up-to-date branch, required PRs, zero approving reviews, no bypass actors, force-push prevention, deletion protection, and only `KIRARI / R3 trusted verifier` from the dedicated App. The trusted verifier's additional path gate rejects ordinary PR changes under `.github/workflows/` and `scripts/root-audit/`, so the App check cannot approve changes to the code that publishes it or any workflow that could request its credential. Trust-root maintenance remains a separate Owner-controlled change procedure. The current repository Rules REST API represents the required check as a `required_status_checks` rule whose parameters contain `required_status_checks` entries (`context` and optional integer `integration_id`) and the required `strict_required_status_checks_policy` boolean. Because the real App ID is `PENDING_OWNER_SETUP`, the wrapper stores only that pending marker as planning metadata and keeps `apiPayload` null; it does not invent a number or encode an incomplete object. There is no current required status check or active ruleset. The proposal stays unapplied and not apply-ready until the App exists, a benign App check is read back with its real ID/name/head/status/conclusion/timestamps, and the post-bootstrap main SHA and CI set are known.

Bootstrap merge, App creation/installation, benign App-check observation, ruleset construction/application/readback, Environment/secret setup, R3 consumption, and Production work remain separate Owner decisions. Keep the private key out of the repository Environment until the App-bound ruleset has been separately authorized, applied, and authenticated-read back; use an Owner-controlled one-time method for the benign provenance check before then. Do not use this technical check to merge PR #133, consume R3, or authorize T1, C1, Production, release, P5, or Edge Gateway work.

## Sources

- [GitHub workflow event semantics](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- [GitHub workflow-run webhook payload](https://docs.github.com/en/webhooks/webhook-events-and-payloads#workflow_run)
- [GitHub workflow and workflow-run REST APIs](https://docs.github.com/en/rest/actions/workflows)
- [GitHub Pull requests REST API and changed-file listing](https://docs.github.com/en/rest/pulls/pulls#list-pull-requests-files)
- [GitHub Environment and deployment branch policy](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
- [GitHub Checks API](https://docs.github.com/en/rest/checks/runs)
- [GitHub required status-check semantics](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks)
- [GitHub rules REST API](https://docs.github.com/en/rest/repos/rules)

## Pending eligibility and later live enforcement

Technical verifier PASS can remain PENDING and non-consumable. The required App
check completes as **failure** for that result and invalidates previous same-head
App success. App success requires a separately authenticated APPROVED eligibility
record for the exact candidate/evidence, re-fetched together with the open #135
issue before publication and completion. This neither applies nor consumes R3,
and the local bootstrap-merge proposal is never parsed by this mechanism.
Publication errors route to the existing failure publisher; no neutral/skipped
conclusion can satisfy the proposed required context.

An App result is point-in-time and cannot expire itself. Issue closure, expiry,
and revocation after publication must not be treated as continuing authorization.
The ruleset remains not apply-ready: before any live ruleset application or
R3-bearing merge/auto-merge/queue use, separately implement and independently
review continuing expiry/revocation enforcement that invalidates stale success.
A fresh trusted run and Owner revalidation are also required immediately before
later consumption. Those later engineering/setup decisions are outside this
bootstrap execution; trustRootReadyNow remains NO.

The sanitized root audit covers the fixed four workspace importers. Any added or
renamed immediate workspace `package.json` outside that trusted manifest set fails
closed before audit, including a candidate that leaves the lockfile unchanged.
Expanding the workspace inventory requires a separately reviewed trust-root change.
