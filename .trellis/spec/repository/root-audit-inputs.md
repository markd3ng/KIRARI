# Root Audit Changed-Path Contract

## Scope

Apply to trusted candidate acquisition and protected-path verification. This contract establishes source validation, not live App provenance or continuing merge authorization.

## Signatures

```js
listImmutableChangedPaths({ request, apiRoot, headApiRoot, baseSha, headSha, candidateFiles })
changedPathsFromImmutableTrees(baseTree, headTree, { baseTreeSha, headTreeSha, candidateFiles })
listPullRequestChangedFiles(apiUrl, prNumber, expectedCount, token)
evaluateVerification({ changedFiles, policy, ...context })
```

## Authoritative immutable acquisition

Exact Git commit responses must match base/head SHA and bind exact recursive tree SHA. Fork head acquisition uses the authenticated head repository and the same API origin. Trees require `truncated: false`, at most 100,000 entries, unique clean relative paths, valid SHA/mode/type, and ordinary ancestor directories. Malformed data or API failure rejects acquisition.

Compare every base/head entry identity, type, and mode. Deleted paths remain; directory replacements retain trailing slash for protected-prefix matching. More than 6,000 affected paths rejects acquisition. Candidate workspace roots/immediate children cannot be symlinks/gitlinks, fixed inputs must be ordinary blobs, and the complete immediate apps/workers/packages package.json inventory must equal the trusted fixed manifest set. An unchanged extra importer also rejects acquisition.

The evaluator uses this immutable set for the protected gate. It rejects workflows, root-audit source, pnpm-workspace.yaml, and root/fixed-importer .npmrc/.pnpmfile.cjs changes. Candidate scripts and policy are data and cannot change these protections.

## Corroborating mutable PR rows

The Pull requests reader still reconciles rows against live integer `changed_files`, paginates to 3,000 rows, checks unique filenames, and retains valid distinct `previous_filename` origins. At most 6,000 affected paths result. Incomplete/unstable/duplicate/malformed rows reject acquisition. Rows never replace immutable evidence: metadata A, mutable file rows B, metadata A cannot hide an exact-head protected change.

## Required tests

Run `node --test scripts/root-audit/tests/*.test.mjs`. Tests cover rename in/out, deleted/mode/directory changes, separate fork origin, commit/tree binding, truncation/traversal/duplicate/ancestor corruption, oversized sets, immediate workspace symlink/gitlink, symbolic fixed input, unchanged extra manifest, API failure, mutable pagination/count/rename origins, and CLI A/B/A integration rejection.
