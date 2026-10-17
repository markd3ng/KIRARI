# P6 #101 — LLM discovery v2

## Goal and Owner decision
Start P6 after accepted sequential Squash Merges #147/#148/#149. Baseline main 1ae7b7efdd632db2b16c9daa07cd087576312484 and exact post-merge CI39005176626 passed; native Production READY and live browser smoke passed. Owner explicitly retains llms-full.txt (2026-10-17). No further retention decision is pending.

## Full issue acceptance
- Curated language/path-aware llmstxt.org-aligned indexes and canonical/base-aware URLs.
- Source/AST Markdown views preserving links, code, math and diagrams, excluding nonpublic/draft content.
- HTML alternate/describedby discovery to canonical Markdown views.
- Retire the legacy condensed output and its public references without redirect/shim.
- Retain the full aggregation and existing no-store/robots mitigations; do not change privacy policy or deploy settings.

## First implementation batch
Remove legacy condensed generation/link/config/documentation references and stale output. Keep existing main/language indexes and full aggregation behavior. Add executable postbuild output regressions for enabled/disabled, locales/base paths and full-retention policy. Full Markdown view/discovery acceptance remains open; do not close #101 on this batch alone.

## Boundaries
Normal source PR/CI/review and native Git hosting. No provider configuration, credentials, manual deployment, indexing submissions or retired deployment controller. P5 local Windows packager compatibility follow-up is a separate small PR, not a new phase gate.
