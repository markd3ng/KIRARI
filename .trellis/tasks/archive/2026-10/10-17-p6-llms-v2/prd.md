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

## Continued implementation — Owner continuation
After first-batch PR151 passed CI, Owner requested continued development without routine pauses. Implement the remaining source-backed Markdown, canonical language/path indexes and discovery within the same scoped P6 branch/PR; retain full aggregation. #101 stays open until complete verified acceptance and merge. No automatic PR merge is authorized by this continuation.

## Owner-approved completion
Owner approved sequential Squash Merge #150 then #151 and committing final evidence/handoff to GitHub. Both merges, exact-main CI, native Production identity/READY/alias and fresh browser/source/discovery/policy acceptance PASS. P6 is accepted at code SHA219bd26fa6024876fc8a1ba9b334936d04b844e3. The earlier no-merge continuation boundary is historical and superseded by this explicit Owner decision. P7 implementation is not part of this handoff closeout.
