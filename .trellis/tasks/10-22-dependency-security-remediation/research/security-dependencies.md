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

## Follow-up remediation of the prior residuals

The branch additionally overrides `postcss-selector-parser` to `7.1.6` and `katex` to `0.18.7`. The direct KaTeX range now accepts `^0.18.7`; the overrides also replace the older transitive versions requested by `postcss-nested@6.2.0`, `@tailwindcss/typography@0.5.20`, `mermaid@11.17.2`, and `rehype-katex@7.0.1`. These overrides cross the consumers' declared major-version ranges, so they were kept only after the existing Mermaid browser test, all 143 site tests, type checks, Astro check, full static build, and release checks passed. The lockfile now contains only `postcss-selector-parser@7.1.6` and `katex@0.18.7`.

This resolves the two moderate PostCSS parser findings and both low KaTeX findings in the dependency graph. The PostCSS consumers process repository-controlled CSS during the build. KaTeX rendering is static from repository-controlled content; the Mermaid and rehype-katex integrations were exercised by the site tests and production build.

`http-cache-semantics@4.2.0` remains unresolved. The GHSA lists no patched version, and the package maintainer disputes the report. Astro 7.3.5 declares it directly; a search of the installed Astro package and workspace found only the manifest/lockfile reference, not an import or call site. KIRARI's Astro build emits static files and has no Astro request server. Do not claim this as patched or silently suppress the high audit finding; no safe upstream update is available.

The local npm audit endpoint timed out during recheck. Final advisory counts are pending the GitHub dependency-audit artifact for the updated PR HEAD. The prior HEAD's audit artifact reported 0 critical, 1 high, 2 moderate, and 2 low; this is historical evidence only for that prior SHA.

## Verification on the follow-up candidate

- `fnm exec --using=22.23.2 -- corepack pnpm install --frozen-lockfile`
- `pnpm site:test`: 143 passed, 0 failed
- `pnpm site:type-check`, `pnpm site:astro-check`: pass, 0 Astro errors/warnings/hints
- `pnpm build`: pass, 112 static pages generated
- `pnpm release:check`, `pnpm release:version-check`, and `git diff --check`: pass
- Browser tests include Mermaid render/lifecycle coverage; the GitHub browser fixture and complete CI will run after push
