# Dependency security evidence — 2026-10-22

Baseline: `main` `3f86df5fe5a320373aa51aa58a29ff494e9354b4`; fresh pnpm audit: 0 critical, 3 high, 7 moderate, 7 low (903 dependency instances).

| Package | Installed | Advisory / status | Initial disposition |
|---|---:|---|---|
| `vite` | 8.0.16 | Multiple high/moderate/low advisories; fixed from 8.1.6 | Upgrade within Vite 8 and test Astro/Svelte integrations. |
| `markdown-it` | 14.3.2 | High and low advisories; fixed from 14.3.3 | Patch update within 14.x. |
| `sanitize-html` | 2.17.7 | Moderate and low advisories; fixed from 2.18.0 | Patch update within 2.x; exercise existing sanitization tests/build. |
| `dompurify` | 3.4.13 | Two low advisories; fixed from 3.4.16 | Update existing override to a patched 3.4.x release. |
| `http-cache-semantics` | 4.2.0 → 4.3.0 | GHSA-ch52-4w7c-c8xp lists no patched version; upstream maintainer disputes the report. The 4.3.0 code still honors `max-stale` on a zero-age shared Set-Cookie entry. | Refresh to the latest published release, verify KIRARI's call path, and keep the package-level advisory visible rather than claiming the disputed behavior is fixed. |
| `postcss-selector-parser` | 6.1.4, 6.0.10 | Moderate; advisory's patched range begins at 7.1.6 | Assess major-version override compatibility and exploitability; only apply with build/test evidence. |
| `katex` | 0.17.0, 0.16.47 | Low; patched from 0.18.2 | Test whether the site and Mermaid's declared dependency range permit a safe update; do not force an unsupported range silently. |

Astro is a static site and this dependency tree is used in build/tooling paths; there is no evidence from the initial scan that these packages are deployed as a server-side runtime. Verify that against the installed package usage before using reachability to classify any remaining issue.

Sources: [Vite advisory](https://github.com/advisories/GHSA-587h-7wmj-h5pm), [markdown-it advisory](https://github.com/advisories/GHSA-gfr2-rv44-r23c), [postcss-selector-parser advisory](https://github.com/advisories/GHSA-rj75-hqrm-r3gf), [http-cache-semantics advisory](https://github.com/advisories/GHSA-ch52-4w7c-c8xp), [upstream http-cache-semantics issue](https://github.com/kornelski/http-cache-semantics/issues/56), [KaTeX 0.18.2 release](https://github.com/KaTeX/KaTeX/releases/tag/v0.18.2).

## Follow-up remediation of the prior residuals

The branch additionally overrides `postcss-selector-parser` to `7.1.6` and `katex` to `0.18.7`. The direct KaTeX range now accepts `^0.18.7`; the overrides also replace the older transitive versions requested by `postcss-nested@6.2.0`, `@tailwindcss/typography@0.5.20`, `mermaid@11.17.2`, and `rehype-katex@7.0.1`. These overrides cross the consumers' declared major-version ranges, so they were kept only after the existing Mermaid browser test, all 143 site tests, type checks, Astro check, full static build, and release checks passed. The lockfile now contains only `postcss-selector-parser@7.1.6` and `katex@0.18.7`.

This resolves the two moderate PostCSS parser findings and both low KaTeX findings in the dependency graph. The PostCSS consumers process repository-controlled CSS during the build. KaTeX rendering is static from repository-controlled content; the Mermaid and rehype-katex integrations were exercised by the site tests and production build.

`http-cache-semantics` now resolves to `4.3.0` through Astro's existing `^4.2.0` range. The GHSA still lists no patched version, and the upstream maintainer disputes the report. A direct behavioral probe confirms 4.3.0 still returns a cache hit when a shared `Set-Cookie` response with zero max-age is requested with `max-stale`; this work does not claim that library behavior is fixed. Astro's installed call site is its static remote-image build cache, which uses only `storable()` and `timeToLive()`; no KIRARI request handler or user-controlled request reaches `satisfiesWithoutRevalidation()`. The package-level advisory therefore remains visible, with no demonstrated KIRARI runtime exposure. Keep it tracked until upstream/GHSA records converge or Astro removes the dependency.

The valid GitHub JSON inventory for earlier candidate `94f792d8b9bc9c4765e9989388fde50320e6da14` reported 0 critical, 1 high, 0 moderate, and 0 low; its sole entry was `http-cache-semantics@4.2.0`. The first audit request after upgrading to 4.3.0 timed out, so its empty JSON was not counted. A subsequent successful audit on PR HEAD `d790cf2bdf58df38cfa731a792e4d97e35a75586` reported “No known vulnerabilities found” and 0 findings at every severity. This clears the dependency audit for the candidate. The GHSA page still says no patched version, while its affected range ends at 4.2.0; 4.3.0 is outside that range. The disputed `max-stale` behavior remains documented above, with no demonstrated KIRARI runtime exposure.

## Verification on the follow-up candidate

- `fnm exec --using=22.23.2 -- corepack pnpm install --frozen-lockfile`
- `pnpm site:test`: 143 passed, 0 failed
- `pnpm site:type-check`, `pnpm site:astro-check`: pass, 0 Astro errors/warnings/hints
- `pnpm build`: pass, 112 static pages generated
- `pnpm release:check`, `pnpm release:version-check`, and `git diff --check`: pass
- Independent review verified Mermaid math rendering with KaTeX 0.18.7 in Chromium (default MathML and legacy mode), direct rehype-katex inline/display math, and PostCSS nesting fixtures against the overridden parser.
- GitHub CI run `39714987373` passed `verify`, `site-browser-validation`, and `browser-fixtures` on code HEAD `fa1ef2b573308e02932cca2827b2d9a8ec415e36`; the follow-up audit on docs-only HEAD `d790cf2bdf58df38cfa731a792e4d97e35a75586` succeeded with 0 findings.
- Advisory OCR Review failed before file analysis because its provider returned HTTP 402. Independent code review found no blocking defects; it independently checked math rendering and CSS nesting compatibility.
