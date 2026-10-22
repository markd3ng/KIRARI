# Dependency security evidence — 2026-10-22

Baseline: `main` `3f86df5fe5a320373aa51aa58a29ff494e9354b4`; fresh pnpm audit: 0 critical, 3 high, 7 moderate, 7 low (903 dependency instances).

| Package | Installed | Advisory / status | Initial disposition |
|---|---:|---|---|
| `vite` | 8.0.16 | Multiple high/moderate/low advisories; fixed from 8.1.6 | Upgrade within Vite 8 and test Astro/Svelte integrations. |
| `markdown-it` | 14.3.2 | High and low advisories; fixed from 14.3.3 | Patch update within 14.x. |
| `sanitize-html` | 2.17.7 | Moderate and low advisories; fixed from 2.18.0 | Patch update within 2.x; exercise existing sanitization tests/build. |
| `dompurify` | 3.4.13 | Two low advisories; fixed from 3.4.16 | Update existing override to a patched 3.4.x release. |
| `http-cache-semantics` | 4.2.0 | GHSA-ch52-4w7c-c8xp says affected `<=4.2.0`, patched versions none. Upstream maintainer disputes the report and closed its report as not planned. | Do not call a version bump a confirmed fix. Inspect actual source and Astro usage; retain as a documented advisory unless a safe, verifiable workaround exists. |
| `postcss-selector-parser` | 6.1.4, 6.0.10 | Moderate; advisory's patched range begins at 7.1.6 | Assess major-version override compatibility and exploitability; only apply with build/test evidence. |
| `katex` | 0.17.0, 0.16.47 | Low; patched from 0.18.2 | Test whether the site and Mermaid's declared dependency range permit a safe update; do not force an unsupported range silently. |

Astro is a static site and this dependency tree is used in build/tooling paths; there is no evidence from the initial scan that these packages are deployed as a server-side runtime. Verify that against the installed package usage before using reachability to classify any remaining issue.

Sources: [Vite advisory](https://github.com/advisories/GHSA-587h-7wmj-h5pm), [markdown-it advisory](https://github.com/advisories/GHSA-gfr2-rv44-r23c), [postcss-selector-parser advisory](https://github.com/advisories/GHSA-rj75-hqrm-r3gf), [http-cache-semantics advisory](https://github.com/advisories/GHSA-ch52-4w7c-c8xp), [upstream http-cache-semantics issue](https://github.com/kornelski/http-cache-semantics/issues/56), [KaTeX 0.18.2 release](https://github.com/KaTeX/KaTeX/releases/tag/v0.18.2).

## Implemented and verified

The compatible fixes applied on this branch are `vite@8.3.5`, `markdown-it@14.3.3`, `sanitize-html@2.18.1`, and `dompurify@3.4.17`. A new full workspace audit reports 0 critical, 1 high, 2 moderate, and 2 low advisories (down from 17 total to 5). The Vite, markdown-it, sanitize-html, and DOMPurify advisories are gone.

The remaining five findings are not being concealed:

- `http-cache-semantics@4.2.0` remains a high audit finding because the advisory lists no patched release. The npm `4.3.0` source was inspected and retains the same `max-stale` acceptance branch; it does not remediate the disputed behavior. Astro 7.3.5 declares it as a dependency, but a source search of the installed Astro package and workspace found no imports or calls outside the package itself. KIRARI publishes static output, not an Astro request server. Treat this as an upstream supply-chain advisory with no demonstrated reachable KIRARI path, not as fixed.
- `postcss-selector-parser` 6.1.4 and 6.0.10 remain moderate because the fixed version is 7.1.6, outside the v6 ranges declared by Expressive Code and Tailwind Typography. Those consumers run during the trusted local/CI CSS build; KIRARI has no request-time untrusted selector parser. No unsupported major override was introduced.
- `katex` 0.17.0 and 0.16.47 remain low. The direct dependency and `rehype-katex`, `remark-math`, and Mermaid consumers resolve distinct versions; forcing 0.18.2 would violate Mermaid's `^0.16.47` and rehype-katex's `^0.16.0` dependency ranges. Current rendering is static and source-controlled, so the trust-policy bypass has no untrusted request-time content path. No forced override or framework-major upgrade was introduced.

Verification on the final candidate: frozen pnpm install; the full blocking CI `verify` job; site tests (142 pass, one browser test skipped before installing Playwright); full Chromium site/Mermaid tests and TOC/analytics/CSP browser checks (all pass); production build; release checks; and `git diff --check`. The independent CI browser-harness `npm audit` reports zero vulnerabilities. The informational workspace audit exits nonzero only for the five residual advisories above; CI's dependency-audit job is explicitly non-blocking.
