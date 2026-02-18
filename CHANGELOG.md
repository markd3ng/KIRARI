# Changelog

All notable changes to this project will be documented in this file.

## [2026-02-18]

### Added
- Added Mermaid diagram support via custom `rehype-mermaid-pre.mjs` plugin for client-side rendering
- Added `mermaid.enable` global toggle in `src/constants.ts`
- Added per-post `mermaid` frontmatter option to control Mermaid JS loading
- Added comprehensive tag/category mapping configuration with 26 tags and 8 categories in `src/constants.ts`
- Created 4 test articles to verify mapping functionality across different categories

### Fixed
- Fixed tag/category mapping functionality to ensure proper Chinese display in UI components
- Fixed `Categories.astro` not using `getCategoryName` mapping function for localized category display
- Fixed GitHub Actions workflow pnpm version conflict by removing manual version specification
- Removed unused `LinkPreset` import from `Navbar.astro` (TypeScript hint cleanup)
- Fixed pnpm-lock.yaml: updated all svelte@5.49.1 references to 5.51.3
- Fixed pnpm-lock.yaml: removed @biomejs/biome 2.3.14 platform package remnants
- Updated swup dependencies in package.json to match lockfile versions

### Changed
- Optimized GitHub Actions workflows (`ci-main.yml` and `ci-edgeone.yml`):
  - Removed Node.js version matrix (now using Node 22 LTS only)
  - Added pnpm cache for faster dependency installation
  - Added timeout settings to prevent stuck jobs
  - Added environment variables for centralized version management
  - Deploy job now depends on both `check` and `build` jobs
  - Artifact retention reduced to 1 day
  - Deployment condition now requires `push` event (not PR)

## [2026-02-13]

### Added
- Integrated [astro-llms-generate](https://github.com/ColdranAI/astro-llms-generate) plugin for LLM-friendly documentation
- Enabled i18n support for LLM documentation generation
