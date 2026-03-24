# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Integrated `astro-analytics` plugin supporting multiple analytics services:
  - Master switch `enable` (default: `false`) to control all analytics loading
  - Google Analytics (`googleAnalyticsId`)
  - Umami (`umami.id`, `umami.src`)
  - Plausible (`plausible.domain`, `plausible.src`)
  - Microsoft Clarity (`clarityProjectId`)
  - Fathom (`fathomSiteId`)
  - Simple Analytics (`simpleAnalyticsDomain`)
  - Matomo (`matomo.siteId`, `matomo.src`)
  - Amplitude (`amplitudeApiKey`)
- Added environment variables for all analytics services (e.g., `PUBLIC_GOOGLE_ANALYTICS_ID`, `PUBLIC_UMAMI_ID`, etc.)
- Added optional `og` field to post frontmatter for per-post OG image override.

### Changed

- Replaced manual Clarity script with inline script (still controlled by `enable` switch). Other services use `astro-analytics` components.
- Analytics scripts are now rendered directly in `<head>` instead of via Partytown for component compatibility.
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
