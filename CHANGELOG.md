# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-03-26

### Added

- **Full TOML Configuration Support**: All configuration fields can now be set via `kirari.config.toml`
  - Complete `site` module (url, title, subtitle, base, lang, themeColor, banner, toc, favicon)
  - Complete `profile` module (avatar, name, bio, links)
  - Complete `navBar` module with preset and custom link support
  - Complete `license`, `expressiveCode`, `mermaid`, `head`, `footer` modules
  - Complete `llms` and `og` modules
  - Enhanced `analytics` and `seo` module coverage
- **Type Guards and Validators**: Runtime validation for all configuration fields
  - `getNumber()`: Validates numeric fields (hue, toc depth)
  - `getStringArray()`: Validates string arrays (expressiveCode themes)
  - `validateNavBarLinks()`: Validates navigation links with preset support
  - `validateProfileLinks()`: Validates profile social links
  - `validateFavicons()`: Validates favicon configurations
- **Comprehensive JSDoc Comments**: All configuration files now have bilingual documentation
  - `src/utils/env.ts`: Environment variable reader functions
  - `src/utils/config-loader.ts`: Configuration loading and validation logic
  - `TomlConfig` type: Field-level documentation for all TOML options

### Changed

- **Configuration Priority**: TOML is now the primary configuration method
  - Old priority: `src/constants.ts` hardcoded values → limited TOML support
  - New priority: Environment Variables → `kirari.config.toml` → Default values
- **`src/constants.ts` Refactored**: Now loads configuration via `loadConfig()` instead of hardcoding
  - Removed all inline configuration values
  - Configuration now fully controlled by TOML file
  - Reduced from ~150 lines to ~16 lines
- **Documentation Overhaul**: README and README_CN completely rewritten
  - TOML configuration is now the recommended approach
  - Environment variables are now only recommended for sensitive data
  - Added comprehensive TOML examples with all fields
- **TOML Example Enhanced**: `kirari.config.toml` now includes:
  - All configuration fields with examples
  - Bilingual (English/Chinese) comments for every field
  - Type annotations and usage guidelines
  - Array field examples (navBar.links, profile.links, favicon)

### Migration Guide

**From v0.1.0 to v0.2.0:**

If you were using `src/constants.ts` for configuration:

1. Copy your configuration values to `kirari.config.toml`
2. See the updated `kirari.config.toml` for field names and structure
3. Environment variables still work with the same names

If you were using environment variables for non-sensitive data:

1. Consider moving non-sensitive config to `kirari.config.toml` for better readability
2. Keep sensitive data (analytics IDs, API keys) in environment variables
3. Both approaches work - choose based on your deployment needs

**No breaking changes**: All existing environment variables and TOML configurations continue to work.

---

## [0.1.0] - 2026-03-25

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
- Added `src/utils/env.ts` with unified env readers: `getEnvString`, `getEnvBoolean`, and `getEnvStringFromKeys`.
- Added backward-compatible analytics env alias: `PUBLIC_CLARITY_ID` (with `PUBLIC_CLARITY_PROJECT_ID` as preferred key).
- Added optional Hugo-style TOML config file support via root `kirari.config.toml`.
- Added `src/utils/config-loader.ts` to resolve config by priority: env > TOML > defaults.
- Added `PUBLIC_INDEXNOW_ENABLE` env override for `seo.indexNow`.



### Changed

- Replaced manual Clarity script with inline script (still controlled by `enable` switch). Other services use `astro-analytics` components.
- Analytics scripts are now rendered directly in `<head>` instead of via Partytown for component compatibility.
- **IndexNow integration is now opt-in** - Set `seo.indexNow: true` in `src/constants.ts` to enable. Default is `false` to avoid unnecessary external requests and potential 403 errors.
- Simplified OG selection logic to: `frontmatter.og` → `og.defaultImage`.
- Updated `README.md` and `README_CN.md` OG sections to match the new static selection model.
- Refactored `src/constants.ts` to load resolved config from `src/utils/config-loader.ts`, supporting optional TOML overrides.

- Analytics scripts now require both `analytics.enable` and production runtime (`import.meta.env.PROD`) before loading.
- Updated `.env.example`, `README.md`, and `README_CN.md` to document env priority, analytics production guard, and Clarity alias compatibility.


### Removed

- Removed dynamic OG image generation route `src/pages/og/[...slug].png.ts`.
- Removed `useCoverAsOg` and other obsolete dynamic OG config options from configuration/types.
- Removed unused component props (`draft` in `PostCard`, `size` in `ButtonTag`, `slug` in `License`) and synchronized callers.
- Removed empty unused component `src/components/GlobalStyles.astro`.
- Removed unused dependency `@swup/progress-plugin` and synchronized lockfile.

### Fixed

- Clarified that analytics scripts (Google Analytics, Umami, Microsoft Clarity, etc.) should be wrapped in backticks to avoid quote conflicts with HTML attributes.
- Removed duplicated `Config` type declarations in `src/types/config.ts` to keep a single source of type truth.

