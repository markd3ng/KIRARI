# Execution plan

1. Confirm child 2 implementation/reconciliation PRs merged and post-merge CI passed; check Project state and refresh remote refs.
2. Confirm no existing `v0.5.1` tag. Inspect actual release conventions and changes since `v0.5.0`; update version metadata/changelog on a dedicated branch.
3. Run actual repository-defined release/version/type/test/build checks. Open Release PR, obtain exact-head required Actions and independent review, then merge normally.
4. Verify post-merge `main`, metadata, changelog, and CI. Synchronize `dev` with final `main` through an allowed history-preserving operation; prove tree equality and required sync checks.
5. Freeze final SHA; re-check all gates and tag absence. Create and push the annotated tag, verify object/peeled SHA/tag CI and unchanged `v0.5.0`.
6. Verify provider project/environment/branch/repository/deployment ID/status/commit and canonical URL; run post-fix browser checks at the required viewports where applicable.
7. Re-read affected Project items and save final evidence/report; populate every requested summary field using real values or explicit status markers.

## Stop conditions

Any failed pre-tag gate, existing `v0.5.1`, failed tag CI, non-READY deployment, SHA mismatch, or unverified browser result prevents a PASS declaration. Never move a tag or bypass branch protection.
