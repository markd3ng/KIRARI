# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] - 2026-06-13

### Removed

- Removed `AI_CONTEXT.md`, `ARCHITECTURE.md`, `HYDRATION_GUIDE.md` — content was fully redundant with `AGENTS.md` and `README.md`.
- Removed `KIRARI_RELEASE_AUDIT_2026-05-22.md` — one-time audit snapshot, now stale.
- Removed `.workbuddy/memory/` and `.sisyphus/` — local assistant state already covered by `.gitignore`.

### Changed

- Updated `README.md` and `README_CN.md` to reflect current `@astrojs/mdx` version (^5.0.6).
- Removed dead cross-references to deleted docs from `AGENTS.md`, `CONTRIBUTING.md`, and `DEPLOY.md`.

## [0.3.0] - 2026-05-22

### Added

- Added a Projects preset page that renders editable Markdown GitHub repository cards from `src/content/spec/projects.md`.

### Changed

- Updated Astro to 6.3.7 and refreshed the current dependency set for Tailwind CSS, `@tailwindcss/vite`, OverlayScrollbars, `@types/node`, and related lockfile-only transitive packages.

## [0.3.0] - 2026-05-22

### Added

- Added Google Programmable Search as a first-class search provider, including TOML configuration, Google CSE runtime loading, KIRARI-styled no-ads results, and AdSense-compatible rendering mode.
- Added optional Google Indexing API submission after build, with service account JSON restricted to environment variables and non-blocking warning behavior on submission failures.
- Added trusted Custom Head/Footer snippet files under `src/snippets/` so maintainers can inject multiline HTML and JavaScript without TOML escaping pain.
- Added AI and architecture governance documents covering TOML-first configuration, Astro Islands, hydration rules, transition initialization, public repo hygiene, security boundaries, and release validation.
- Added opt-in GitHub Card runtime adapters for Cloudflare Pages Service Binding and Vercel same-project Functions.
- Added a build-time materializer so `/ghc/*` routes are generated only when `githubCard.adapter.enabled = true`.

### Changed

- Rewrote all project documentation (README.md, README_CN.md, AGENTS.md, CONTRIBUTING.md, SKILL.md) with hard technical specificity: architecture diagrams, transition system event mapping, full plugin chain ordering, config pipeline internals, type guard documentation, and platform-specific caching rules. Eliminated filler language, unified terminology across files, and removed SKILL.md/AGENTS.md content duplication.
- Adopted TOML-first configuration governance: site behavior belongs in `kirari.config.toml`, TypeScript stays responsible for defaults/types/loading, and environment variables are reserved for secrets and deployment-specific values.
- Changed Search and Theme Toggle hydration guidance to `client:idle`, while keeping Display Settings as `client:only="svelte"`.
- Updated Astro to 6.3.6 and refreshed related dependencies, including Svelte, Mermaid, Expressive Code, KaTeX, Pagefind, and security-sensitive transitive overrides.
- Changed the default GitHub Card behavior back to direct `https://api.github.com` access for pure static builds.
- Added a fork checklist to README and README_CN so new users know which config, content, and asset files to edit first.
- Reworked GitHub Card adapter documentation with explicit mode selection, generated route behavior, token ownership tables, and verification checks.
- Clarified GitHub Card adapter token placement for Cloudflare Worker Secret versus Vercel Project Environment Variables.
- Tightened `.gitignore` for public repo hygiene, including local AI assistant state, browser/test artifacts, build output, coverage, and OS metadata.

### Fixed

- Backported selected upstream Fuwari PR fixes: GitHub admonition type mapping, nullable blank frontmatter handling, centered post card covers, and conditional pagination rendering.
- Removed page-level `DOMContentLoaded` initialization paths for post image lazy loading, Mermaid rendering, and GitHub File Card hydration-adjacent DOM initialization; these now use immediate initialization plus transition events.
- Fixed Mermaid and related dependency audit exposure by upgrading to the current safe 11.x release line and keeping lockfile state synchronized.

## [0.2.1] - 2026-05-08

### Added

- Added Hugo-like i18n with BCP 47 routes, language object config, post-level `translationKey`, inferred translation groups, inline post translation links, localized RSS feeds, canonical links, and `hreflang` alternates.
- Added localized static spec page lookup with default-content fallback and Simplified Chinese About/Friends examples.
- Added optional Algolia DocSearch configuration, runtime trigger integration, and `docsearch:*` meta tags.
- Added cross-platform deployment headers: generated `dist/_headers` for Cloudflare Pages and Netlify, plus `vercel.json` and `edgeone.json` cache rules.
- Added `default-language-in-subdir` and default-language prefix alias redirects.
- Added configurable post URL slugs with `frontmatter.slug` support and `crc32` hex fallback generation.
- Added tracked project agent/skill guidance for KIRARI repository workflows.

### Changed

- Hid the default language route by default, so `/` serves `default-language` while non-default languages keep prefixes such as `/zh-CN/`.
- Added support for language labels, locale tags, text direction, weights, disabled languages, and language content directories.
- Localized navbar preset labels and common interactive control labels by the active language route.
- Kept sidebar profile links language-prefixed so About navigation stays inside the active locale.
- Filtered Pagefind queries by active language and avoided persisting stale navbar/sidebar DOM across locale changes.
- Kept performance improvements general-purpose: self-hosted Roboto, responsive images, selective Astro prefetch, and immutable caching for hashed `/_astro/*` assets.
- Aligned inline post translation links with the existing post metadata row.
- Internalized project-owned postbuild tasks for robots, Pagefind, IndexNow, LLM files, platform headers, and analytics output.
- Updated compatible dependency versions within the existing semver ranges, including Astro integrations, Svelte, Tailwind CSS, Pagefind, Mermaid, KaTeX, Swup, and related tooling.
- Moved `@astrojs/check` to `devDependencies` while keeping the `pnpm astro check` workflow.
- Updated README and README_CN with i18n, performance, deployment, slug, and release maintenance guidance.

### Fixed

- Passed `width` and `height` through `ImageWrapper.astro` fallback `<img>` output when callers provide explicit dimensions.
- Prevented the initial page load from replaying the transition progress bar and causing a visible re-render.

### Removed

- Removed stale local review/fix report artifacts from the repository.

## [0.2.0] - 2026-03-26

### Added

- Added complete TOML configuration support through `kirari.config.toml`.
- Added runtime validators and type guards for site, navigation, profile, favicon, analytics, SEO, LLM, and rendering configuration.
- Added bilingual configuration comments and JSDoc around the config loader.

### Changed

- Refactored `src/constants.ts` to load resolved configuration instead of hardcoded values.
- Documented configuration priority: environment variables, TOML, then defaults.
- Rewrote README and README_CN around the TOML-first configuration workflow.

## [0.1.0] - 2026-03-25

### Added

- Added analytics integration, optional per-post OG image overrides, environment helpers, TOML config bootstrap, and IndexNow configuration.
- Added Pagefind search, Mermaid, KaTeX, View Transitions with Swup fallback, and LLM documentation generation.

### Changed

- Improved accessibility semantics for interactive controls.
- Optimized banner delivery and reduced first-render layout shift risk.
- Unified taxonomy slug normalization for tags and categories.

### Removed

- Removed obsolete dynamic OG route and unused components, props, dependencies, and debug noise.
