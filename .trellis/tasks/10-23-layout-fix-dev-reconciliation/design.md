# Design

Use child 1's evidence and ledger as the source of scope. First-screen code remains owned by `@kirari/site`; read applicable frontend specs before edits. The current evidence demonstrates content entrance animation, not hero-box reflow, so wait for the user's symptom confirmation before touching runtime code. If confirmed, fix the narrowest cause and cover it with the smallest meaningful regression check.

For reconciliation, begin from current `main`; the audited three dev-only commits are all superseded, and merging `dev` would reintroduce obsolete history/tree state. Create focused changes only for the confirmed fix and ADS v0.3. Target `main` through normal PRs after exact-HEAD checks and independent review. No protection/ruleset is currently configured; obey any policy enabled before merge.

Rollback through reviewed revert PRs. Do not weaken checks or alter deployment architecture.
