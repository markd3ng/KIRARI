# Pinned pnpm Root Audit Format

## 1. Scope / Trigger

Apply when parsing or deriving pnpm 9.14.4 root audit evidence in
`scripts/root-audit/evaluator.mjs`. Raw audit bytes, stderr, and exit code remain
evidence; a technical verifier PASS does not make the raw audit green.

## 2. Signatures

`deriveNormalAudit(raw, policy)` removes only the separately validated #122
advisory. `evaluateVerification(context)` validates both views, the pinned pnpm
version, source bindings, lock topology, and authorization independently.

## 3. Contracts

- Findings require a version string and path array. `dev`, `optional`, and
  `bundled` may be omitted by pnpm 9; each must be boolean when present.
- Run `pnpm audit --json --audit-level=moderate` at the sanitized workspace root.
  pnpm 9's `audit` is not recursive/filterable: `--filter` injects an unsupported
  recursive option and returns an error instead of audit JSON. Audit every
  workspace importer, never narrow the candidate inventory by filtering.
- Unignored `metadata.vulnerabilities` counts affected package-version findings
  per severity, not advisory IDs. Reconcile all finding rows, including lows.
- The normal view removes only #122's exact advisory row and preserves raw
  metadata: pnpm calculates totals before applying its existing ignore.
- R3 eligibility remains pinned to its GHSA, package, versions, and eight
  versioned paths. Parser compatibility never broadens advisory allowance.
- pnpm enriches paths from installed modules. In the uninstalled isolated audit
  workspace every path array can be empty. Require exactly one finding row per
  expected affected version; obtain exact R3/#122 routes independently from the
  already validated lock graph. If any audit paths are supplied, require the
  complete exact path/version inventory, rejecting partial enrichment.
- A new unapproved moderate/high/critical advisory fails closed. Raw R3 FAIL
  is permitted only as evidence for the separately authorized one-time PR #136
  Owner bootstrap decision described in `scripts/root-audit/README.md`.

- Any changed immediate workspace manifest matched by the trusted apps/workers/packages globs but absent from the fixed candidate allowlist fails closed, even if the candidate leaves its lockfile unchanged.

## 4. Validation & Error Matrix

| Input | Result |
|---|---|
| Omitted optional finding flags | Accept structure; continue other gates |
| Present non-boolean flag | Reject schema drift |
| Two affected versions under one advisory | Count two findings |
| Any raw severity count mismatch | Reject evidence |
| All scoped audit paths empty, exact versions and independently exact lock graph | Continue other gates |
| Partial audit paths or duplicate/missing/extra version rows | Reject evidence |
| Unexpected qualifying advisory/version/path | Reject technical verification |
| Exact existing R3 and separate #122, all other bindings valid | Technical PASS with consumption still pending |

## 5. Good / Base / Bad Cases

- Good: two R3 versions contribute two moderate findings with optional flags
  omitted, matching real pinned-pnpm JSON.
- Base: boolean flags from legacy fixtures remain accepted.
- Bad: counting the two versions as one, dropping low rows, or using parser
  compatibility to suppress a finding.

## 6. Tests Required

Run `node --test scripts/root-audit/tests/*.test.mjs`. Evaluator regressions
exercise omitted flags, invalid supplied flags, per-version totals, count drift,
unexpected qualifying advisories, and separate #122 derivation. Also retain a
fresh real raw JSON/lock smoke-check result in the active task evidence.

## 7. Wrong vs Correct

Wrong: require optional booleans, then sum one per advisory ID. Synthetic tests
can pass while real pnpm 9 JSON fails or miscounts.

Correct: validate supplied optional booleans, sum finding rows by severity,
preserve raw metadata, and validate exact GHSA/version/path scope separately.
