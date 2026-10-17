# Design

First batch keeps the existing postbuild architecture and removes its condensed-only branches. Delete the fixed obsolete output before the enable guard so repeated postbuild runs cannot retain it; add no alias or redirect. Preserve full output generation, robots exclusion and no-store headers. Tests execute the actual postbuild script inside an isolated fixture using the existing package dependencies; do not assert source text as behavior.

A read-only researcher maps remaining #101 gaps from current source and official llmstxt.org guidance. Subsequent Markdown views should use content/source AST and existing canonical/base/language helpers, not duplicate Site rendering or infer completion from historical Markdown. No new dependency in this first batch.

Root owns postbuild/tests/docs/config and Trellis P5 completion record; separate worker owns only Makers package portability in another worktree.

## Source-backed view slice
Shared public collection descriptors reuse published HTML route selection. A static directory index.md endpoint exports only selected canonical posts/spec pages. Source AST preserves Markdown meaning and rewrites assets/internal links through the shared descriptor resolver; HTML discovery advertises only emitted views. Postbuild consumes actual alternate/describedby links, deduplicates canonical HTML identities, recognizes nested slugs/base paths and emits covering locale/path indexes plus existing locale convenience outputs.

Ownership: root postbuild/index/tests/config/docs/task; p6_llms_research descriptors/endpoints/discovery/layout/pages; p6_markdown_renderer renderer and necessary dependency manifests/renderer tests. Shared worktree, no reverting peers.
