# Root Audit Changed-Path Contract

## 1. Scope / Trigger

Apply when changing the trusted verifier's PR file acquisition or protected-path
gate in `scripts/root-audit/`. The implementation remains a bootstrap prototype;
this contract does not establish live App provenance or branch protection.

## 2. Signatures

```js
listPullRequestChangedFiles(apiUrl, prNumber, expectedCount, token)
// Promise<string[]>: sorted, unique affected paths, including rename origins
evaluateVerification({ changedFiles, policy, ...context })
```

The reader uses `GET /repos/markd3ng/KIRARI/pulls/{prNumber}/files` with
`per_page=100` and explicit `page`. It reconciles API **rows** against the live
PR's integer `changed_files` value; the maximum is 3,000 rows.

## 3. Contracts

- `filename`: nonempty string without NUL; unique among API rows.
- `status: "renamed"`: requires a nonempty, NUL-free `previous_filename`
  different from `filename`. Any supplied `previous_filename` is validated
  and retained, even when `status` is absent.
- Each row contributes its current path and any original path to a set.
  At most 6,000 affected paths can result from 3,000 file rows.
- The evaluator rejects any affected path matching the trusted base's
  `trustedRootPaths`: currently `.github/workflows/` and `scripts/root-audit/`.
- The API reader runs with read-only credentials. Candidate paths are data;
  the path list never authorizes executing candidate bytes or changing policy.

## 4. Validation & Error Matrix

| Input/state | Result |
|---|---|
| Invalid count, more than 3,000 rows, duplicate filename, inconsistent/incomplete pages | Reject acquisition |
| Renamed row missing a valid distinct original path | Reject acquisition |
| A protected current **or original** path | Reject technical verification |
| Duplicate/malformed affected paths or more than 6,000 paths | Reject evaluation |
| Complete rows affecting only unprotected paths | Continue other verification gates |

## 5. Good / Base / Bad Cases

- Good: `docs/a.md` → `docs/b.md` contributes two paths and continues validation.
- Base: an ordinary modification contributes its one current path.
- Bad: `.github/workflows/r3-trusted-publisher.yml` → `docs/old.yml`
  still touches the protected original path and must fail.

## 6. Tests Required

`scripts/root-audit/tests/cli-http.test.mjs` exercises acquisition through the
evaluator. Assert rename-out rejection for both protected roots, rename-in
rejection, allowed unprotected renames, missing/malformed origins, 3,000 rows
producing 6,000 paths, and rejection above the affected-path bound. Preserve
pagination/count/duplicate tests. Run `node --test scripts/root-audit/tests/*.test.mjs`.

## 7. Wrong vs Correct

Wrong: gate only `rows.map(row => row.filename)`; a renamed workflow's
protected original path disappears from the gate.

Correct: count API rows independently, collect both `filename` and valid
`previous_filename`, deduplicate the affected paths, and check every path
against policy from the trusted base.
