# PR151 review reconciliation

The initial first-batch OCR sitemap comment was a real defect: optional customPages still advertised the retired output. Removed it; actual sitemap-enabled staged builds verify absence.

Expanded candidate 2512adb standard CI39015742639 and OCR39015742663 passed. Opinions below were investigated by actual trigger, not by their number or badge severity.

| Thread/comment | Classification | Finding and disposition |
|---|---|---|
| PRRT_kwDOROfCIs6tef1d / 4301981426 | False premise | External builds create unique mkdtemp roots; the mutable cache is now local to each root, and destination locks serialize publication to a shared output. Raw simultaneous builds in one working directory already share dist and are not an isolated build API. The old default dependency-relative cache was what mixed separate stages. The explicit simultaneous distinct-Site test proves content and asset isolation. No cache-key framework added. |
| PRRT_kwDOROfCIs6tef1f / 4301981429 | Nonblocking maintainability | The pinned installed Astro package declares bin astro=./bin/astro.mjs. The repository requires pinned pnpm/node_modules already. Real staged builds prove this invocation works; npx would still traverse the broken .bin shim. A future supported dependency upgrade runs full builds; PnP is not a claimed platform. |
| PRRT_kwDOROfCIs6tef1j / 4301981433 | Real output-format defect; not a new privilege boundary | Plain frontmatter description could emit Markdown links/formatting in an index. Escape it as text with the label; real postbuild output parsed through remark now has no injected external link and preserves readable description text. Maintainers already control Site content; a high security badge does not establish an untrusted write path. |
| PRRT_kwDOROfCIs6tef1l / 4301981437 | Duplicate test request | Same description defect and parser-level regression above. |
| PRRT_kwDOROfCIs6tef1m / 4301981439 | Reasonable hardening | No bad path reproduced with the existing trailingSlash=always configuration. Reuse shared url('/') for the non-i18n response Link path, matching Layout and removing an unnecessary trailing-slash assumption. |
| PRRT_kwDOROfCIs6tef1p / 4301981443 | Nonblocking edge-test suggestion | Existing element/tag/location guards handle whitespace, comment-first fragments and nested same-name HTML. Table-driven actual renderer cases preserve text, links and tail and omit nested template contents. No runtime grouping rewrite needed. |
| PRRT_kwDOROfCIs6tef1r / 4301981445 | Intentional failure policy; reasonable diagnostic improvement | Missing local images and unsupported attachments deliberately fail the build rather than publish fabricated destinations. This is documented/tested, not a missing fallback. Wrap errors with canonical page context and retain the cause. No partial/empty Markdown publication. |

Independent follow-up found an additional real compatibility defect: resolving an unused reference definition such as [unused]: ./missing.png could fail an otherwise valid HTML source. Discover referenced identifiers before resolving/serializing definitions. Regression covers unused image/page destinations, first-definition shadowing, case normalization and escaped identifiers; no unused resolver call occurs.

No provider configuration, credentials, deployment controller or approval system changed. Issue101 stays open until authorized merge and acceptance; source/CI readiness is separate from live provider deployment evidence.
