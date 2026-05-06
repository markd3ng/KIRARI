# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Added Hugo-like i18n with BCP 47 routes, post-level `translationKey`, a navbar language switch, localized RSS feeds, canonical links, and `hreflang` alternates.
- Added localized static spec page lookup with default-content fallback and Simplified Chinese About/Friends examples.
- Added optional Algolia DocSearch configuration, runtime trigger integration, and `docsearch:*` meta tags.
- Added cross-platform deployment headers: generated `dist/_headers` for Cloudflare Pages and Netlify, plus `vercel.json` and `edgeone.json` cache rules.
- Added `default-language-in-subdir` to control whether the default language uses a prefixed URL.

### Changed

- Hid the default language route by default, so `/` serves `default-language` while non-default languages keep prefixes such as `/zh-CN/`.
- Localized navbar preset labels and common interactive control labels by the active language route.
- Kept sidebar profile links language-prefixed so About navigation stays inside the active locale.
- Filtered Pagefind queries by active language and avoided persisting stale navbar/sidebar DOM across locale changes.
- Kept performance improvements general-purpose: self-hosted Roboto, responsive images, selective Astro prefetch, and immutable caching for hashed `/_astro/*` assets.
- Updated README and README_CN with i18n, performance, and multi-platform deployment guidance.

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
