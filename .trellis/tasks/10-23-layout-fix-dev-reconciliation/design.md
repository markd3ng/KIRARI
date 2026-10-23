# Design

Use child 1's evidence and ledger as the source of scope. First-screen code remains owned by `@kirari/site`; read applicable frontend specs before edits. The current evidence demonstrates content entrance animation, not hero-box reflow, so wait for the user's symptom confirmation before touching runtime code. If confirmed, fix the narrowest cause and cover it with the smallest meaningful regression check.

For reconciliation, begin from current `main`; the audited three dev-only commits are all superseded, and merging `dev` would reintroduce obsolete history/tree state. Create focused changes only for the confirmed fix and ADS v0.3. Target `main` through normal PRs after exact-HEAD checks and independent review. No protection/ruleset is currently configured; obey any policy enabled before merge.

Rollback through reviewed revert PRs. Do not weaken checks or alter deployment architecture.


## Route-transition follow-up

The additional production symptom is in the shared `Navbar` used by `MainGridLayout` and the landing variant. Explore opens through CSS `:hover` / `:focus-within`; `MainGridLayout` assigns one View Transition name to the whole top row. Selecting a child route therefore captures the open dropdown as part of the outgoing navbar bitmap while the navbar fades. Give the dropdown an independent transition identity and suppress only its outgoing snapshot. Keep the fixed top progress indicator, main navbar fade, and keyboard focus styling intact. Avoid a new global state store or route-event abstraction.

Verification should use the same action sequence that reproduced the issue, then sample the page-template families enumerated in `prd.md` on desktop and mobile. Inspect direct-load state separately from SPA transitions so the initial-load report is not conflated with the confirmed hover-menu snapshot.
