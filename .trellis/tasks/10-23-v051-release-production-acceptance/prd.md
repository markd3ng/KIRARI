# v0.5.1 release and Production acceptance

## Goal

Prepare and verify the `v0.5.1` release after all implementation and branch-reconciliation gates pass.

## Requirements

- Recheck fresh refs and verify `v0.5.1` does not already exist; never move or overwrite a tag.
- Create a separate Release PR from latest `main`; update only repository-standard version metadata, accurate changelog, and necessary lockfile data.
- Verify release scripts/checks from actual package configuration; require exact-HEAD CI and independent review before normal merge.
- Verify post-merge metadata and CI; align `dev` to final `main` content using permitted history-preserving operations.
- Create/push an annotated tag only after every user-specified prerequisite passes. Verify tag object, peeled release SHA, tag CI, and unchanged `v0.5.0`.
- Verify actual Vercel `kirari-main` Production deployment is READY, points to the Release PR merge SHA, and serves `https://kirari-main.vercel.app/`; repeat post-fix browser checks if a fix exists.
- Reconcile and re-read relevant GitHub Project items; produce the complete requested machine-readable summary and evidence report.

## Acceptance

- Release PR merges after required checks/review and matches actual changes since `v0.5.0`.
- `dev` file tree equals final `main` before tag creation.
- Tag points to frozen verified release SHA and tag CI passes.
- Production status and SHA match, and layout regression verification is recorded without overclaiming.
- If any prerequisite fails, no dependent tag/release action proceeds and the exact blocker is reported.
