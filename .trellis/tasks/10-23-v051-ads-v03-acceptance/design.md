# Design

This is a gated acceptance workflow, not a broad product redesign. Keep evidence, implementation, reconciliation, and release as independently reviewable stages.

The parent task owns the acceptance contract and final integration report. Child 1 is read-only and establishes the exact ADS/repository/deployment/browser/branch facts. Child 2 owns the confirmed first-screen fix and valid dev reconciliation, using separate PRs when changes are unrelated. Child 3 owns version metadata, branch alignment, tag, deployment verification, and final Project/report state after earlier merges.

Use the exact ADS `v0.3` peeled commit `1e07d6c4bbd296b7d37dcd31934cfc70426f73ac`. Inspect existing repository integrations first; adopt or pin only if ADS guidance and current repository evidence justify it. Do not replace KIRARI instructions.

For browser work, use Ego Lite only if its installed documentation and capabilities are actually present. Otherwise record the limitation and use the available Chrome DevTools/CDP path for required early instrumentation and runtime evidence. Diagnostics remain read-only and outside Production source.

For branch reconciliation, distinguish unique commits from direct file-tree differences. Never replay all historical dev commits blindly. Build a ledger from unique commits and actual tip diffs, preserving current-main behavior and the audited valid changes. Use normal protected-branch PRs and maintain ancestry.

Release order is strict: implementation/reconciliation merges and post-merge checks; separate Release PR and post-merge checks; `dev` content alignment; then annotated tag and tag CI; finally Production deployment/browser checks. Any failed prerequisite stops dependent operations.

Rollback is by reverting focused PR commits through normal review. Do not force-push, move a published tag, deploy diagnostics, or modify Production settings to make a gate pass.
