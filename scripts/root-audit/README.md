# Base-controlled R3 verifier

This verifier is a manually dispatched, read-only workflow. It reads the selected PR's allowlisted files from GitHub's contents API at the exact head SHA and treats every response as data. API bodies are size-limited while streaming, with a separate cumulative limit for Owner-decision comments. It does not check out the PR, install its dependencies, load its package-manager config, or execute its workflow, scripts, evaluator, or artifacts. The PR's workflow, evaluator, CLI, and policy files are included only in the candidate digest.

The trusted side is the workflow and files in this directory at the selected `main` commit. The workflow pins every action by full commit SHA and grants only `contents: read`, `pull-requests: read`, and `issues: read`. The audit subprocess runs as the separate unprivileged `nobody` user with a freshly constructed environment that contains no GitHub credentials; the token-bearing API process runs under the workflow user. Its temporary workspace is built from trusted generated workspace configuration and manifests containing only package identity and dependency fields; it has no candidate lifecycle scripts, `.npmrc`, or `.pnpmfile.cjs`. No install command is run. The verifier runs one raw, unignored `pnpm audit`, retains that JSON, stderr, and real exit code, then derives a separate normal view by removing only the independently validated #122 advisory. The raw severity counts must match the unignored advisory set. The derived view preserves pnpm 9.14.4's raw counts and other metadata, and differs only by that exact advisory row because pnpm calculates those totals before applying `ignoreCves`. This avoids relying on pnpm's ignored `package.json` audit configuration. All evidence is retained in a finite-lived artifact.

The lock parser accepts the pnpm v9 importer/snapshot structures used by the candidate, validates the candidate workspace manifests against all four lockfile importers, checks that every package resolution has a supported integrity value and matches a snapshot identity, and walks the full dependency graph. It compares the exact eight R3 paths and versions. It separately pins #122's GHSA, CVE, package, version, canonical route, and four observed lockfile routes to the same package/version. It does not treat #122 as an R3 exception or use candidate policy data to decide what is ignored.

An audit pass is evidence only. R3 is consumable only when the verifier also finds one unexpired `KIRARI_R3_CONSUMPTION_DECISION_V1` record posted on Issue #135 by the exact GitHub account `markd3ng` with GitHub's `OWNER` association. The record binds the repository, issue, comment identity from the GitHub API, candidate head and base SHAs, sorted candidate digest, trusted policy digest, verifier digest, independent security-review digest, decision, and expiry. No decision record is present for this task, so the result remains `PENDING` and non-consumable.

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

The workflow dispatch input `security_review_sha256` must match that record. The verifier does not apply or consume an exception. The live run must be checked outside the workflow against the GitHub Actions API: event `workflow_dispatch`, `head_branch=main`, the exact workflow path and workflow SHA, run ID, candidate SHA, and every digest in the artifact. A job name, check name, candidate artifact, or Actions summary alone is not authority.

## Current repository governance finding

Owner-authenticated API reads observed an empty ruleset list and a successful `main` protection lookup returning GitHub's `404 Branch not protected`; this is not an access-denied result. The verifier cannot itself prevent a writer from replacing or force-pushing the trusted workflow after review. The proposal in `ruleset-proposal.json` is staged for independent review only and has not been applied. It requires pull requests, one approval, stale approval dismissal, no bypass actors, force-push protection, and deletion protection. It intentionally does not require a status-check name: this `workflow_dispatch` run does not produce a PR required check, and a check name alone would not bind the evidence to the reviewed workflow/run.

Do not use this result to merge PR #133, consume R3, or authorize T1, C1, Production, release, P5, or Edge Gateway work.
