# Implementation plan

1. Finish the live Project/Issue/PR reconciliation. Update #96/#97 acceptance contracts, status/dependencies, and Project readme before implementation. Keep the closed #108 duplicate as history; preserve #110–#112 future roadmap entries.
2. Inspect current Profile mapping, config/content consumers, localization/routes, build boundary checks, and `KIRARI-Site-Template`; freeze field placement and fixture mappings in the two Issues.
3. Gate 1: reconcile the existing workflow in place. Retain `workflow_dispatch`; add config push and config PR read-only behavior, root-Site boundary validation, provenance, and focused event/path tests. Do not duplicate CI or deploy.
4. Gate 2: add `.github/workflows/ocr-review.yml` separately. Verify pinned action SHA/input names, event and fork/Draft guards, concurrency, permissions, secrets-by-name, and advisory-only status. Runtime OCR requires `vars.OCR_LLM_MODEL`; do not expose the similarly named secret.
5. Re-read remote main at `9a9c496c191ba541d3882bd00e831e5fbc1d8721`, create `config` from that validated head if still absent, and create the scoped P2 development branch.
6. Implement Site Contract v2 and schema validation; immutable Core submodule bootstrap; thin template; deterministic AI setup protocol; stable taxonomy and locale semantics; consumed SEO/GEO semantic inputs.
7. Inventory and migrate every supported `packages/site-profile` input with a pre-write report and deterministic mappings. Add minimal, full-feature, and legacy fixtures and negative safety tests.
8. Run focused checks as each contract lands, then the full requested CI/security gate: frozen install, composition, Site/Profile/Trellis/QA/types/Astro, Edge tests/types/dry package, default/external builds, release checks, moderate audit, YAML/actionlint/schema parsers, and diff check.
9. Push scoped changes and open PR(s) only after local gates; read back exact heads, Actions checks, artifacts/provenance, OCR results or explicit configuration block, and review findings. Fix current-P2 findings; link future findings to existing Project Issues.
10. Merge only scoped P2 PRs; read current main and exact-head CI/artifacts; update #96/#97 and Project from evidence. Do not start P3.
11. Launch a fresh independent `gpt-6-luna` / `max` Phase Exit Audit from Project → Issues → PRs → exact code/CI/artifacts. Correct discrepancies and repeat the audit before marking P2 Done.

## Rollback points

- Keep all P2 work on a branch from verified main; leave existing untracked user paths untouched.
- Preserve the main deployment guard and do not promote artifacts.
- If migration validation fails, retain the source fixture and report; do not overwrite or delete source inputs.
- No secret changes, deployment, release/tag, DNS, or indexing API call is part of rollback or validation.
