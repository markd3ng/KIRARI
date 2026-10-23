# Execution plan

1. Record `git status`, remote URLs, fresh `main`/`dev`/tags, merge base, unique commits, tree diffs, and existing issue/PR/milestone/Project state.
2. Inspect ADS v0.3 release guidance and current repository submodule/skill integration; record exact SHA and recommendation.
3. Inspect Vercel project/configuration and latest Production deployment. Verify project, environment, source commit, status, and canonical URL.
4. Inspect installed Ego Lite docs and command/API availability. Set up a clean browser context and run the required viewport/navigation/repetition matrix; capture console and early runtime/layout evidence.
5. Inspect relevant UI source and controlled candidate causes: scrollbar initialization, animation, page transition, theme initialization, and scroll restoration.
6. Review each dev-only commit and relevant tip-tree difference, especially CI/package/lockfile; record graph and compatibility evidence.
7. Save a concise audit report, difference ledger, and machine-readable initial-state values. Leave all runtime behavior unchanged.

## Results

- [x] Fresh GitHub/Actions/Project/Vercel and branch baselines recorded in `research/audit.md`.
- [x] ADS v0.3 release and repository adoption state recorded; no files were integrated.
- [x] Production browser matrix run; premature initial hard-refresh samples are identified, and corrected settled hard-refresh repetitions are in `research/evidence/hard-reload-confirmed.json`.
- [x] Every unique dev commit and meaningful three-dot file difference dispositioned in `research/difference-ledger.md`.
- [x] No runtime or remote state was changed.
- [x] User reviewed the audit, confirmed the 18px/680ms fade-up is the reported symptom, and authorized child 2.

**Gate:** baseline audit is reviewed and its confirmed symptom is handed to child 2. GitHub has no branch-protection rules or rulesets; merge only through the reviewed PR path after exact-head required Actions and independent review pass, and honor any policy added before merge.

## Commands and tools

Use repository Git, existing GitHub Actions/Project and Vercel integrations, installed browser tooling, and actual package scripts as discovered. Do not invent scripts or rely on past SHA hints.
