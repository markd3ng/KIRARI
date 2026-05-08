# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
