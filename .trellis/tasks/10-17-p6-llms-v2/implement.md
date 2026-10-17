# Execution

1. Record accepted P5 merges and archive the three completed task records on this branch; sync GitHub Issue/Project.
2. Research current LLM paths/output contract; implement first batch legacy-output removal and full-retention regressions.
3. Run targeted postbuild tests, type/QA/check/build/release and standard final-head CI; independent review.
4. Open scoped P6 first-batch PR, keep #101 In Progress until all remaining Markdown-view/discovery acceptance passes. No automatic merge under the three-PR merge authorization.

## Expanded P6 implementation
Source-backed public descriptors, static Markdown endpoints, AST fidelity/fallbacks, emitted asset resolution, canonical discovery and covering locale indexes are implemented in PR151. Final independent review PASS; actual staged builds cover prefixed/unprefixed/disabled and simultaneous Sites. Local real-browser English/Chinese/spec view/discovery responses PASS. The first full suite exposed shared Astro cache cross-Site contamination; project-local caches plus explicit concurrent asset/content regression corrected it, and the repeated Site suite passes 127 with one optional browser skip. Full aggregate retained. Merge/Issue closure remains outside this branch's authorization until Owner approves PR151.
