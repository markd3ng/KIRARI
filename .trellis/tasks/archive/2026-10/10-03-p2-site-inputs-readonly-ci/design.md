# Design

## Boundaries

- GitHub Project #1 is the formal queue. Issues #96/#97 own executable scope; this task stores working evidence only.
- `apps/site` / Core owns schemas, validation, transforms, build entry points, and deterministic safety. The Site owns config, content, assets, and its `.kirari/site.toml` bootstrap contract.
- `markd3ng/KIRARI-Site-Template` is a separate thin Site repository. It pins `.kirari/core` as a submodule at a full commit SHA; it does not copy the monorepo.
- `.github/workflows/ci.yml` remains deterministic CI and owns read-only config-ref artifacts. `.github/workflows/ocr-review.yml` is a separate advisory review workflow.
- P2 defines semantic SEO/GEO inputs only. P3 owns rendered/runtime/browser verification.

## Data flow

Site tree + schema-v2 metadata + immutable Core submodule SHA → one canonical local/CI validate/build entry point → static output + provenance (Core SHA, Site SHA, schema/toolchain, artifact identity). CI triggers on the configured Site ref push and its PRs; manual composition remains available. All paths use read-only permissions and publish an artifact without a deploy or indexing request.

## Contract decisions

- `.kirari/site.toml` owns bootstrap metadata, schema version, Core repository/pin, and setup state. Product data stays in the existing normal Site TOML/config model where consumers already expect it.
- Generic pages stay in `content/pages/`; taxonomy IDs/slugs remain locale-independent, while labels/descriptions/aliases are localized for `zh-Hans`, `zh-Hant`, `en`, and `ja`.
- Before finalizing exact field names/placement, inspect the current config loader, content schemas, route/localization code, Profile mapping, and output transforms. Add SEO/GEO input only when an existing or accepted near-term consumer needs it.
- Migration inventories every supported current Profile input and writes a mapping/report before output; generated output, secrets, Core files, and unapproved executable code are excluded.
- Minimal, full-feature, and legacy fixtures exercise one schema/build path. Legacy remains an explicit fixture, not a silent compatibility mode.

## Safety and compatibility

Reuse `build.sh --compose` and its current input validation, containment/symlink checks, disposable build, stale-output protection, indexing veto, atomic output publication, and provenance behavior. Review its `site_subdirectory` boundary before adopting a repository-root Site. Never use `git submodule update --remote`. Config PRs receive no write token or production credentials. Keep the main Git deployment guard unchanged.

## Operational limitation

OCR credentials exist by name, but `OCR_LLM_MODEL` is currently an encrypted repository secret while the accepted action contract requires a repository variable. The implementation must reference `vars.OCR_LLM_MODEL`; do not print or migrate the secret. Runtime review is unverified until the owner configures that variable.
