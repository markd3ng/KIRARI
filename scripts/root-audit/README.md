# Root audit policy evaluator

`pnpm audit --json --audit-level moderate` remains the raw root audit. CI stores
its stdout, stderr, invocation marker, and actual exit code before evaluating
the result. It also records a successful `pnpm install --frozen-lockfile
--ignore-scripts --ignore-pnpmfile` and the complete
`pnpm ls --recursive --depth Infinity --json` workspace output. After the
unignored-audit preparation and installation, CI compares every tracked file's
working-tree bytes directly with the candidate commit's Git blob, then checks
HEAD and untracked files. This catches source edits even if Git index flags hide
them. The evaluator runs only after this integrity gate passes. The pinned
pnpm 9.14.4 install command supports both hook-disabling options.
The raw pnpm 9 audit report has empty `findings[].paths` arrays, so the
evaluator joins the report's affected versions and action resolutions against
that lock-resolved dependency tree. It requires the exact eight R3 version and
path pairs plus the exact reviewed #122 action path. Both audit runs must agree
on their action resolutions and advisory set except for #122.

The evaluator accepts the observed pnpm 9.14.4 schema only. It validates
top-level and nested action, resolution, advisory, finding, metadata, and
dependency-tree fields; unknown fields, malformed records, unexplained
vulnerability counts, unsuccessful commands, and mismatched paths fail
closed. `RAW_AUDIT_FINDINGS` reports pnpm's severity counts; the separate
`RAW_AUDIT_FINDING_PATHS` value reports lock-resolved package paths.

The only candidate R3 tuple is `GHSA-rj75-hqrm-r3gf` for
`postcss-selector-parser` at moderate severity. `policy.json` lists every
reviewed version/path pair and the exact pnpm audit action paths. The evaluator
compares the sorted complete lock-resolved set, not a count or package-name
match. For PR #133 it checks the checked-out HEAD against the event SHA and
current public GitHub PR API state, including current base/head SHAs and
repository identity. The candidate binds the audit/tree bytes and command
statuses, install output, repository, Issue/PR, base and head SHAs, lockfile,
manifests, policy, evaluator files, and workflow. Canonical JSON recursively
sorts object keys, preserves array order, encodes UTF-8 without insignificant
whitespace, and rejects non-JSON and non-finite values before SHA-256 hashing.

The only package-manager ignore remains the exact `CVE-2026-93748` entry
already recorded under #122. CI retains the normal configured raw audit, then
runs a second audit against a temporary copy of the same lockfile, workspace
manifest, and importer manifests with only that one ignore removed. The
evaluator requires both reports to agree except for one exact high-severity
`GHSA-ch52-4w7c-c8xp` finding on `http-cache-semantics@4.2.0` at the path
listed in `policy.json`. It also reads #122 from the public GitHub API and
requires the Issue to remain open with its exact temporary-policy contract.
This prevents the metadata-only count for #122 from standing in for package,
version, or path identity. The R3 policy never absorbs or broadens #122.

R3 is committed as `OWNER_REVIEWED_FOR_ENGINEERING` with consumption set to
`NO`. A future decision requires two structured comments on #135. The latest
Owner evidence comment for the current candidate must use
`<!-- KIRARI-R3-EVIDENCE:v1 -->` followed by one JSON object containing the
exact candidate/policy digests, code and security review digests and verdicts,
an explicit UTC expiry, and an `evidenceDigest` computed over all preceding
fields. The latest Owner decision comment for that candidate must use
`<!-- KIRARI-R3-DECISION:v1 -->` followed by JSON with this exact schema:

```json
{
  "schemaVersion": 1,
  "repository": "markd3ng/KIRARI",
  "issueNumber": 135,
  "decision": "APPROVE",
  "consumptionAuthorization": "YES",
  "candidateDigest": "<current canonical candidate SHA-256>",
  "policyDigest": "<current canonical policy SHA-256>",
  "reviewDigest": "<evidence review SHA-256>",
  "evidenceDigest": "<current evidence SHA-256>",
  "evidenceCommentId": 0,
  "baseSha": "<current base SHA>",
  "headSha": "<current PR head SHA>",
  "expiresAt": "<explicit UTC instant>"
}
```

`DEFER`, `REJECT`, or `REVOKE` in a newer structured Owner comment supersedes
an earlier approval for the same candidate. Expiry equality is expired.
Missing, malformed, expired, edited, or mismatched evidence fails. The CLI
has no local approval-file option: it reads public #135 comments from GitHub's
fixed unauthenticated API endpoint and requires the API's exact `markd3ng`
login and `OWNER` association. Its decision digest records the source comment
ID together with the body. API failure fails closed.

## Trust boundary

This PR's `pull_request` workflow and evaluator are supplied by the PR itself.
The repository currently has no observed branch protection, ruleset, or
CODEOWNERS rule anchoring this check. A PR can therefore alter its own
workflow/evaluator. The root-audit job is useful audit evidence for this
candidate, but its result is **not a trusted authorization gate** until a
verifier is run from protected base-branch code or another independently
pinned trust root. No R3 consumption decision may rely on this PR-only CI
result. This change does not create that trust root or authorize a merge.
