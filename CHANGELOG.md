# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Added optional `og` field to post frontmatter for per-post OG image override.

### Changed

- **IndexNow integration is now opt-in** - Set `seo.indexNow: true` in `src/constants.ts` to enable. Default is `false` to avoid unnecessary external requests and potential 403 errors.
- Simplified OG selection logic to: `frontmatter.og` → `og.defaultImage`.
- Updated `README.md` and `README_CN.md` OG sections to match the new static selection model.

### Removed

- Removed dynamic OG image generation route `src/pages/og/[...slug].png.ts`.
- Removed `useCoverAsOg` and other obsolete dynamic OG config options from configuration/types.
- Removed unused component props (`draft` in `PostCard`, `size` in `ButtonTag`, `slug` in `License`) and synchronized callers.
- Removed empty unused component `src/components/GlobalStyles.astro`.
- Removed unused dependency `@swup/progress-plugin` and synchronized lockfile.

### Fixed

- Clarified that analytics scripts (Google Analytics, Umami, Microsoft Clarity, etc.) should be wrapped in backticks to avoid quote conflicts with HTML attributes.
