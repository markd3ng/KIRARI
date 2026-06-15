# KIRARI Code Audit Report

**Range**: `400ce38..fcdc683` (14 commits, 36 files, +2264/−96)  
**Date**: 2026-06-13

---

## 1. XSS via innerHTML — Bangumi page

**File**: `src/pages/bangumi.astro:61`  
**Severity**: High

```js
card.innerHTML = `...<div class="font-bold text-90">${item.name}</div>...${item.rate ? "Rate " + item.rate : "Bangumi"}...`;
```

**Root cause**: `item.name` and `item.rate` originate from the external Bangumi API (`api.bgm.tv`). They are interpolated directly into `innerHTML` without sanitization. If the API response is compromised or returns unexpected HTML/script content, this becomes a stored/reflected XSS vector.

**Fix**: Replace `innerHTML` with DOM APIs that implicitly escape content:

```js
const card = document.createElement("a");
card.href = item.url;
card.className = "flex gap-3 rounded-xl border ...";

const nameDiv = document.createElement("div");
nameDiv.className = "font-bold text-90";
nameDiv.textContent = item.name;

const metaDiv = document.createElement("div");
metaDiv.className = "mt-1 text-sm text-50";
metaDiv.textContent = item.rate ? "Rate " + item.rate : "Bangumi";

card.appendChild(nameDiv);
card.appendChild(metaDiv);
```

---

## 2. XSS via innerHTML — Search pages

**File**: `src/pages/search.astro:71`, `src/pages/[lang]/search.astro:71`  
**Severity**: High

```js
a.innerHTML = "<div class='font-bold text-90'>" + (item.meta?.title || a.href) + "</div><div class='mt-1 text-sm text-50'>" + (item.excerpt || "") + "</div>";
```

**Root cause**: Pagefind indexes user-authored Markdown content. If a post contains raw HTML (e.g., inside a code block, or via MDX component output), Pagefind may return it unescaped in `excerpt` or `meta.title`. The unsanitized string is then interpolated into `innerHTML`.

**Fix**: Use `textContent` or pass through the project's existing `sanitize-html` dependency:

```js
const titleDiv = document.createElement("div");
titleDiv.className = "font-bold text-90";
titleDiv.textContent = item.meta?.title || a.href;
a.appendChild(titleDiv);

const excerptDiv = document.createElement("div");
excerptDiv.className = "mt-1 text-sm text-50";
excerptDiv.textContent = item.excerpt || "";
a.appendChild(excerptDiv);
```

---

## 3. Sponsor page: No i18n support, broken redirect

**File**: `src/pages/sponsor.astro:7,10,15`  
**Severity**: Medium

```astro
if (!sponsorConfig.enabled) {
  return Astro.redirect("/404/");
}
const title = sponsorConfig.title || "Sponsor";
```

**Root cause**:
1. Title is hardcoded as `"Sponsor"` — not localized via i18n keys.
2. Redirect path `/404/` ignores the active language prefix. Visiting `/zh-CN/sponsor/` should redirect to `/zh-CN/404/`, not `/404/`.
3. No `src/pages/[lang]/sponsor.astro` variant exists — unlike guestbook, search, and other pages.

**Fix**: Mirror the guestbook pattern — add `src/pages/[lang]/sponsor.astro` with `getStaticPaths`, localized title via `i18n()`, and a language-prefixed redirect using `withLangPrefix("/404/", lang)`.

---

## 4. Advertisement: `displayCount` renders literal `"undefined"`

**File**: `src/components/widget/Advertisement.astro:30`  
**Severity**: Medium

```astro
data-display-count={config.displayCount}
```

**Root cause**: When `displayCount` is unset in `kirari.config.toml`, the type guard may leave it as `undefined`. Astro renders `undefined` as the **string** `"undefined"` in the HTML attribute. In the client-side JS:

```js
const limit = Number(widget.dataset.displayCount || "-1");  
// "undefined" || "-1" → "undefined" (truthy string)
// Number("undefined") → NaN
// NaN > 0 → false → behaves as no-limit by accident
```

This happens to produce the correct behavior (no limit), but is semantically wrong and fragile.

**Fix**: Provide an explicit default:

```astro
data-display-count={config.displayCount ?? -1}
```

---

## 5. SideBar.astro: Widget rendering duplicated 3×

**File**: `src/components/widget/SideBar.astro:55-105`  
**Severity**: Medium (maintenance burden)

**Root cause**: The switch-case block over 9 widget types (`profile`, `toc`, `categories`, `tags`, `announcement`, `advertisement`, `siteStats`, `siteInfo`, `calendar`) is copy-pasted three times — once for desktop top widgets, once for desktop sticky widgets, and once for mobile widgets. Adding a new widget type requires editing three identical blocks, risking copy-paste drift.

**Fix**: Extract a shared fragment or iterable mapping:

```astro
const WIDGET_COMPONENTS = {
  profile: Profile,
  toc: TOC,
  categories: Categories,
  // ...
} as const;
```

Then render with a single loop.

---

## 6. Comments: Third-party CDN scripts without SRI

**File**: `src/components/comments/Comments.astro:80,92`  
**Severity**: Low

```js
await loadScript("https://unpkg.com/@waline/client@v3/dist/waline.js", "kirariWaline");
await loadScript("https://cdn.jsdelivr.net/npm/twikoo@1.7.6/dist/twikoo.all.min.js", "kirariTwikoo");
```

**Root cause**: Waline and Twikoo are loaded from public CDNs without `integrity` attributes. If the CDN is compromised or the package is tampered with, arbitrary JavaScript executes in the page's origin.

**Fix**: Pin versions precisely and add `integrity` hashes. Extend `loadScript` to accept an optional integrity parameter, or use `import()` with a known-good source.

---

## 7. Calendar: Unconditional build-time computation

**File**: `src/components/widget/Calendar.astro:16-24`  
**Severity**: Low

```ts
const posts = await getSortedPosts(lang);
// ...builds full heatmap data...
```

**Root cause**: `getSortedPosts()` and the entire heatmap computation execute at build time for every page that includes the SideBar, **even when** `widgetsConfig.calendar.enabled` is `false`. The template guards rendering with `{config.enabled && (...)}`, but the computation has already completed by that point — wasted build work.

**Fix**: Short-circuit early:

```ts
const config = widgetsConfig.calendar;
const posts = config.enabled ? await getSortedPosts(lang) : [];
```

---

## 8. TOC typo: `removeTailingHash`

**File**: `src/components/widget/TOC.astro:34`  
**Severity**: Low

**Root cause**: Function named `removeTailingHash` instead of `removeTrailingHash`. Not a functional bug, but misleading for maintainers reading the code.

**Fix**: Rename to `removeTrailingHash`.

---

## 9. SiteInfo: Fragile cross-directory import

**File**: `src/components/widget/SiteInfo.astro:5`  
**Severity**: Low

```ts
import { resolveBuildCommit } from "../../../scripts/build-commit.mjs";
```

**Root cause**: Imports a function from `scripts/` — an operational tooling directory containing build scripts like `materialize-ghc-adapter.mjs` and `postbuild.mjs`. The `scripts/` directory is not a stable library surface. Reorganizing scripts would silently break this import.

**Fix**: Move `build-commit.mjs` to `src/utils/build-commit.ts` so it lives alongside other stable utility modules consumed by components.

---

## 10. Bangumi / Sponsor: Missing i18n route variants

**File**: `src/pages/bangumi.astro`, `src/pages/sponsor.astro`  
**Severity**: Low

**Root cause**: Guestbook and Search both have `src/pages/[lang]/guestbook.astro` and `src/pages/[lang]/search.astro` variants. Bangumi and Sponsor do not — they exist only at the top-level route (`/bangumi/`, `/sponsor/`), with no language-prefixed equivalents. This breaks the i18n URL scheme and means the navbar can't link to these pages with the correct language prefix.

**Fix**: Add `src/pages/[lang]/bangumi.astro` and `src/pages/[lang]/sponsor.astro`, following the same `getStaticPaths` + `getPrefixedLanguages()` pattern used by guestbook.

---

## Summary

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | **High** | `bangumi.astro:61` | XSS via innerHTML from external Bangumi API |
| 2 | **High** | `search.astro:71` | XSS via innerHTML from Pagefind excerpts |
| 3 | Medium | `sponsor.astro:7` | No i18n support, redirect ignores language prefix |
| 4 | Medium | `Advertisement.astro:30` | `displayCount` renders literal `"undefined"` string |
| 5 | Medium | `SideBar.astro:55-105` | Widget rendering switch-case duplicated 3× |
| 6 | Low | `Comments.astro:80,92` | Third-party CDN scripts without SRI integrity |
| 7 | Low | `Calendar.astro:16` | Build-time heatmap computation runs when widget disabled |
| 8 | Low | `TOC.astro:34` | Typo: `removeTailingHash` → `removeTrailingHash` |
| 9 | Low | `SiteInfo.astro:5` | Fragile import from `scripts/` directory |
| 10 | Low | `bangumi.astro`, `sponsor.astro` | Missing `[lang]/` i18n route variants |
