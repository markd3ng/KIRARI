# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Added optional `og` field to post frontmatter for per-post OG image override.

### Changed

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


---

## How to Use `customScript` / `customHtml`

When adding third-party scripts or HTML snippets to `src/constants.ts`, always use **template literals (backticks)**:

```typescript
// ✅ Correct
footer: {
  customScript: `<script type="text/javascript">
    (function(c,l,a,r,i,t,y){
      c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
      y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "YOUR_PROJECT_ID");
  </script>`
}

// ❌ Wrong - will cause parse error
footer: {
  customScript: "<script type="text/javascript">...</script>"
}
```

**Why?** HTML attributes use double quotes (`type="text/javascript"`). If you wrap the string with double quotes, the parser sees the first `"` after `type=` as the end of your string, causing a syntax error.

Template literals (backticks) allow:
- Unescaped single and double quotes inside
- Multi-line strings without concatenation
- Direct copy-paste of third-party script snippets
