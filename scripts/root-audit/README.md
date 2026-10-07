# Base-controlled R3 verifier and App check publisher

## Technical verifier

The trusted verifier remains `workflow_dispatch` only. Its job runs only for the selected `main` ref, checks out that exact trusted commit, and keeps `GITHUB_TOKEN` read-only (`contents`, `pull-requests`, and `issues`). It reads the selected PR's allowlisted files from GitHub's contents API at the exact head SHA and treats every response as data. It never checks out the PR, installs its dependencies, loads its package-manager config, or executes its workflow, scripts, evaluator, or artifacts. The PR's workflow, evaluator, CLI, and policy files are included only in the candidate digest.

The trusted side is the workflow and files in this directory at the selected `main` commit. The workflow pins every action by full commit SHA. The audit subprocess runs as the separate unprivileged `nobody` user with a fresh environment that contains no GitHub credentials; the token-bearing API process runs under the workflow user. Its temporary workspace is built from trusted generated workspace configuration and manifests containing only package identity and dependency fields; it has no candidate lifecycle scripts, `.npmrc`, or `.pnpmfile.cjs`. No install command is run. The verifier runs one raw, unignored `pnpm audit`, retains that JSON, stderr, and real exit code, then derives a separate normal view by removing only the independently validated #122 advisory. The raw severity counts must match the unignored advisory set. The derived view preserves pnpm 9.14.4's raw counts and other metadata, and differs only by that exact advisory row because pnpm calculates those totals before applying `ignoreCves`. All evidence is retained in a finite-lived artifact named with both workflow run ID and attempt.

The lock parser accepts the pnpm v9 importer/snapshot structures used by the candidate, validates the candidate workspace manifests against all four lockfile importers, checks package resolutions against snapshot identities, and walks the full dependency graph. It compares the exact eight R3 paths and versions. It separately pins #122's GHSA, CVE, package, version, canonical route, and observed lockfile routes to the same package/version. It does not treat #122 as an R3 exception or use candidate policy data to decide what is ignored.

## Decision record lookup

The verifier does not scan or paginate all Issue #135 comments. `decision_comment_id` is optional. If omitted, the decision remains `PENDING` and non-consumable; unrelated comments cannot affect the result. If supplied, the verifier fetches only that exact comment ID and validates the issue URL, API comment ID, marker, `markd3ng` login, `OWNER` association, record schema, bound candidate/base/policy/verifier/security-review digests, and expiry. A deleted or unmarked selected comment remains pending and non-consumable; a malformed or unauthorized selected marker fails closed. The publisher re-fetches a selected decision and rejects publication if its exact body digest, author, issue, or expiry changed.

Every technical PASS also requires `security_review_sha256`, the exact SHA-256 of an independent security review. The verifier binds that digest into its result with the repository, candidate head/base and digest, policy digest, and trusted verifier digest. A missing or malformed review digest blocks PASS; when an Owner decision is selected, its record must carry the same digest. This input records review evidence and does not itself grant merge or R3 authorization.

The digest is supplied as a `workflow_dispatch` input after the independent review. The verifier checks its format and binds the value, but does not fetch the review report or authenticate the reviewer's identity. For the bootstrap decision, the Owner must inspect the actual reports and verify their digests against the frozen PR head; a syntactically valid digest alone is not proof that a review occurred.

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
  "securityReviewDigest": "<64-character SHA256>",
  "expiresAt": "<UTC ISO-8601 timestamp within seven days>"
}
```

When that ID is selected, `security_review_sha256` must match the record. No current decision record is asserted by this task.

## Dedicated App publisher (Model A prototype)

The separate `r3-trusted-publisher.yml` workflow listens for completion of the named verifier on `main`. The event name and workflow-name filter are only preliminary routing. An uncredentialed `validate-source` job checks the authenticated upstream run ID and attempt against the Actions REST API, resolves its numeric workflow ID through the workflow API, and requires the exact `.github/workflows/r3-trusted-verifier.yml` path, `workflow_dispatch` event, `main` ref, same repository ID, successful conclusion, and matching run/attempt. It also verifies the exact artifact name, canonical result and evidence digest, current PR head/base/state, and any selected decision. The API's workflow-run `path` contains a ref suffix (for example `.github/workflows/build.yml@main`); it is checked against the exact path and selected main ref, then the workflow-ID endpoint is checked for the bare exact file path. The code does not assume an undocumented event-payload path field.

Only after this read-only job succeeds can the dependent publisher job start with the `r3-trusted-publisher` Environment. It repeats the evidence and live-state validation, then mints a repository-scoped App installation token for `KIRARI` with `Checks: write` only. The private key is referenced only in the token-mint step. The workflow does not check out or execute candidate content; it checks out publisher source from `github.workflow_sha`, a trusted default-branch workflow definition commit. A candidate workflow with the same name or a same-named check/status cannot pass the run-ID/workflow-ID/API source binding, and the future ruleset binds the required context to the App integration ID.

The canonical publisher bundle records repository ID/name, PR number, exact candidate head/base, candidate digest, verifier main SHA/path/workflow SHA, run ID/attempt, verifier/policy/evidence/security-review digests, and optional decision identity/expiry. The publisher recomputes the evidence digest and compares the bundle to `result.json`. Its deterministic external ID hashes those bindings plus publisher SHA/path and publisher-policy digest. A repeated exact run/result is idempotent; reusing an external ID with changed evidence is rejected. Every check is created for the exact current PR HEAD. The publisher re-reads live PR state immediately before completing the check. A head update produces a check on an old SHA, which cannot satisfy the current-head requirement; a base update must invalidate freshness through the proposed strict/up-to-date required-check rule and requires a new verifier run. API errors leave the check absent or in progress, never successful.

Only `success` and `failure` are valid App conclusions. The publisher creates an `in_progress` check and completes it as `success` after the full binding validates. It never emits `neutral` or `skipped`. Failed, cancelled, timed-out, or missing upstream evidence prevents the privileged job from running, so the required App check is absent and merge remains blocked. `workflow_dispatch` execution and the publisher workflow's Actions job are evidence/orchestration; only the dedicated App check is the future required status.

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

Model A is selected for this prototype with a required live-setup gate. GitHub documents that an Environment's selected branch policy compares against the workflow run's `GITHUB_REF`; `workflow_run` uses the default-branch ref. The future Environment must therefore allow the explicit branch `main`, not “protected branches only” (which is not restrictive when no protection exists), and must disable administrator bypass. A candidate-generated run may still trigger the listener and the listener's own ref will be `main`, so Environment policy alone does not isolate the secret. The uncredentialed API-validation job and its dependent job-level eligibility condition provide the upstream event/workflow ID/repository/path checks before the Environment-bearing job starts. These contracts and event fixtures can be tested locally, but the live Environment and credential boundary are not created or proven by this task; Owner setup and independent security review remain required.

Model B, a separately hosted App publisher, is not selected because it adds a network-facing service/webhook, long-lived key custody, persistent replay state, retry/idempotency handling, availability duties, and another operational attack surface. It remains a fallback only if independent security review rejects Model A's Environment/job boundary. No App, key, secret, Environment, or external endpoint is created here.

The `pull_request_target` event is not used. The documented public-repository event-policy enforcement scheduled for 2026-11-02 is not part of this architecture.

## Ruleset and later Owner gates

`ruleset-proposal.json` is an inert planning wrapper, not a GitHub REST API payload. It proposes `main`, an up-to-date branch, required PRs, zero approving reviews, no bypass actors, force-push prevention, deletion protection, and only `KIRARI / R3 trusted verifier` from the dedicated App. The current repository Rules REST API represents this as a `required_status_checks` rule whose parameters contain `required_status_checks` entries (`context` and optional integer `integration_id`) and the required `strict_required_status_checks_policy` boolean. Because the real App ID is `PENDING_OWNER_SETUP`, the wrapper stores only that pending marker as planning metadata and keeps `apiPayload` null; it does not invent a number or encode an incomplete object. There is no current required status check or active ruleset. The proposal stays unapplied and not apply-ready until the App exists, a benign App check is read back with its real ID/name/head/status/conclusion/timestamps, and the post-bootstrap main SHA and CI set are known.

Bootstrap merge, App creation/installation, Environment/secret setup, real App-check observation, ruleset construction/application/readback, R3 consumption, and Production work remain separate Owner decisions. Do not use this technical check to merge PR #133, consume R3, or authorize T1, C1, Production, release, P5, or Edge Gateway work.

## Sources

- [GitHub workflow event semantics](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- [GitHub workflow-run webhook payload](https://docs.github.com/en/webhooks/webhook-events-and-payloads#workflow_run)
- [GitHub workflow and workflow-run REST APIs](https://docs.github.com/en/rest/actions/workflows)
- [GitHub Environment and deployment branch policy](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
- [GitHub Checks API](https://docs.github.com/en/rest/checks/runs)
- [GitHub required status-check semantics](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks)
- [GitHub rules REST API](https://docs.github.com/en/rest/repos/rules)
