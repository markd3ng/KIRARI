# Dependency security evidence — 2026-10-22

Baseline: `main` `3f86df5fe5a320373aa51aa58a29ff494e9354b4`; fresh pnpm audit: 0 critical, 3 high, 7 moderate, 7 low (903 dependency instances).

| Package | Installed | Advisory / status | Initial disposition |
|---|---:|---|---|
| `vite` | 8.0.16 | Multiple high/moderate/low advisories; fixed from 8.1.6 | Upgrade within Vite 8 and test Astro/Svelte integrations. |
| `markdown-it` | 14.3.2 | High and low advisories; fixed from 14.3.3 | Patch update within 14.x. |
| `sanitize-html` | 2.17.7 | Moderate and low advisories; fixed from 2.18.0 | Patch update within 2.x; exercise existing sanitization tests/build. |
| `dompurify` | 3.4.13 | Two low advisories; fixed from 3.4.16 | Update existing override to a patched 3.4.x release. |
| `http-cache-semantics` | 4.2.0 → 4.3.0 | GHSA-ch52-4w7c-c8xp still lists no patched version; upstream maintainer disputes the report. Astro's October 4 triage says 4.3.0 is published and clears npm audit, but the package's 4.3.0 code still honors `max-stale` on a zero-age shared Set-Cookie entry. | Refresh the lock to 4.3.0, verify the actual KIRARI call path, and keep the advisory discrepancy explicit rather than claiming the behavior is fixed. |
| `postcss-selector-parser` | 6.1.4, 6.0.10 | Moderate; advisory's patched range begins at 7.1.6 | Assess major-version override compatibility and exploitability; only apply with build/test evidence. |
| `katex` | 0.17.0, 0.16.47 | Low; patched from 0.18.2 | Test whether the site and Mermaid's declared dependency range permit a safe update; do not force an unsupported range silently. |

Astro is a static site and this dependency tree is used in build/tooling paths; there is no evidence from the initial scan that these packages are deployed as a server-side runtime. Verify that against the installed package usage before using reachability to classify any remaining issue.

Sources: [Vite advisory](https://github.com/advisories/GHSA-587h-7wmj-h5pm), [markdown-it advisory](https://github.com/advisories/GHSA-gfr2-rv44-r23c), [postcss-selector-parser advisory](https://github.com/advisories/GHSA-rj75-hqrm-r3gf), [http-cache-semantics advisory](https://github.com/advisories/GHSA-ch52-4w7c-c8xp), [upstream http-cache-semantics issue](https://github.com/kornelski/http-cache-semantics/issues/56), [KaTeX 0.18.2 release](https://github.com/KaTeX/KaTeX/releases/tag/v0.18.2).

## Follow-up remediation of the prior residuals

The branch additionally overrides `postcss-selector-parser` to `7.1.6` and `katex` to `0.18.7`. The direct KaTeX range now accepts `^0.18.7`; the overrides also replace the older transitive versions requested by `postcss-nested@6.2.0`, `@tailwindcss/typography@0.5.20`, `mermaid@11.17.2`, and `rehype-katex@7.0.1`. These overrides cross the consumers' declared major-version ranges, so they were kept only after the existing Mermaid browser test, all 143 site tests, type checks, Astro check, full static build, and release checks passed. The lockfile now contains only `postcss-selector-parser@7.1.6` and `katex@0.18.7`.

This resolves the two moderate PostCSS parser findings and both low KaTeX findings in the dependency graph. The PostCSS consumers process repository-controlled CSS during the build. KaTeX rendering is static from repository-controlled content; the Mermaid and rehype-katex integrations were exercised by the site tests and production build.

`http-cache-semantics` now resolves to `4.3.0` through Astro's existing `^4.2.0` range. The GHSA page still says no patched version, while Astro's October 4 triage says npm audit clears at 4.3.0; the upstream maintainer disputes the advisory. A direct behavioral probe confirms 4.3.0 still returns a cache hit when a shared `Set-Cookie` response with zero max-age is requested with `max-stale`. Astro's actual call site is its static remote-image build cache, which uses only `storable()` and `timeToLive()`; no KIRARI request handler or user-controlled request reaches `satisfiesWithoutRevalidation()`. So the lockfile can move to the latest release and KIRARI has no demonstrated runtime exposure, but this report does not claim the disputed library behavior itself was changed. Keep the advisory discrepancy visible until upstream/GHSA records converge.

The GitHub full JSON inventory for candidate HEAD `94f792d8b9bc9c4765e9989388fde50320e6da14` reported 0 critical, 1 high, 0 moderate, and 0 low advisories; its sole entry was `http-cache-semantics@4.2.0`. This follow-up changes only that lock entry to 4.3.0. A local `pnpm audit` request timed out against the npm audit endpoint; wait for the new-head GitHub dependency-audit artifact before recording its advisory count.

## Verification on the follow-up candidate

- `fnm exec --using=22.23.2 -- corepack pnpm install --frozen-lockfile`
- `pnpm site:test`: 143 passed, 0 failed
- `pnpm site:type-check`, `pnpm site:astro-check`: pass, 0 Astro errors/warnings/hints
- `pnpm build`: pass, 112 static pages generated
- `pnpm release:check`, `pnpm release:version-check`, and `git diff --check`: pass
- Independent review verified Mermaid math rendering with KaTeX 0.18.7 in Chromium (default MathML and legacy mode), direct rehype-katex inline/display math, and PostCSS nesting fixtures against the overridden parser.
- The dependency-audit and browser validation jobs must be read from CI for the final pushed HEAD; earlier jobs correspond to `94f792d8b9bc9c4765e9989388fde50320e6da14` and are not final evidence.
