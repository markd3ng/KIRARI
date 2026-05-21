[中文文档](./README_CN.md)

<div align="center">

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/markd3ng/KIRARI)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/markd3ng/KIRARI)
[![Deploy to Cloudflare Pages](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/markd3ng/KIRARI)
[![Deploy with EdgeOne Pages](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?repository=https://github.com/markd3ng/KIRARI)

</div>

# KIRARI

Static blog theme. Astro 6 + Svelte 5 + Tailwind CSS v4. Configurable via `kirari.config.toml`. Targets Cloudflare Pages, Vercel, Netlify, EdgeOne Pages.

## Tech Stack

| Category | Dependency | Version |
|----------|-----------|---------|
| Framework | astro | `6.0.8` |
| UI Islands | svelte | `^5.55.5` |
| CSS | tailwindcss, stylus | `^4.2.4`, `^0.64.0` |
| Search | pagefind (default), @docsearch/js (Algolia) | `^1.5.2`, `^4.6.3` |
| Code Highlight | astro-expressive-code | `^0.41.7` |
| Math | rehype-katex, remark-math, katex | `^0.16.45` |
| Diagrams | mermaid | `^11.14.0` |
| Icons | astro-icon, @iconify/svelte | — |
| Fonts | @fontsource/roboto, @fontsource-variable/jetbrains-mono | — |
| Transitions | View Transitions API \| swup fallback | `^4.9.0` |
| Image Viewer | photoswipe | `^5.4.4` |
| Image Processing | sharp | `^0.34.5` |
| Scrollbar | overlayscrollbars | `^2.15.1` |
| Content | @astrojs/mdx, remark/rehype plugin chain | `^5.0.4` |
| Feeds | @astrojs/rss, @astrojs/sitemap | — |

## Quick Start

```bash
git clone https://github.com/markd3ng/KIRARI.git
cd KIRARI
pnpm install          # pnpm only; preinstall hook blocks npm/yarn
pnpm dev
pnpm build
```

> pnpm ≥ 9.14.4. `packageManager` field in `package.json` enforced.

## Fork Checklist

Replace these files after forking. Do not touch `src/components/`, `src/layouts/`, `src/styles/`, or `src/utils/`.

| Path | Action | Required |
|------|--------|----------|
| `kirari.config.toml` | Set `site.url`, `site.title`, `profile.*`, `navBar.*`, `landingPage.*` | Yes |
| `src/content/posts/` | Delete demo posts, add your `.md`/`.mdx` | Yes |
| `src/content/spec/about.md` | Replace About content | Recommended |
| `src/assets/images/` | Replace avatar, banner, landing hero | Recommended |
| `public/favicon/` | Replace favicon | Recommended |
| `public/og/default.png` | Replace default OG image | Recommended |
| `src/content/spec/friends.md` | Replace or remove Friends nav in config | Optional |
| `src/_data/friends.json` | Replace friend-link data | Optional |

Post-fork validation:

```bash
pnpm type-check && pnpm astro check && pnpm build
```

## Configuration

Single source: **`kirari.config.toml`**. No `src/constants.ts` editing needed.

Priority: Environment Variables → `kirari.config.toml` → defaults in `config-loader.ts`.

```toml
[site]
url = "https://example.com"
title = "Site Title"
lang = "en-US"

[i18n]
enable = true
default-language = "en-US"

[profile]
avatar = "assets/images/avatar.png"
name = "Author"
bio = "Short bio"

[[profile.links]]
name = "GitHub"
icon = "fa6-brands:github"
url = "https://github.com/you"

[[navBar.links]]
preset = "Home"

[og]
defaultImage = "/og/default.png"
```

Every key in `kirari.config.toml` carries bilingual comments. Read it directly for the full reference.

### Environment Variables

For secrets (API keys). `.env.local` is gitignored. All `PUBLIC_*` vars override their TOML counterpart.

| Env Variable | Overrides |
|-------------|----------|
| `PUBLIC_SITE_URL` | `site.url` |
| `PUBLIC_ANALYTICS_ENABLE` | `analytics.enable` |
| `PUBLIC_GOOGLE_ANALYTICS_ID` | `analytics.googleAnalyticsId` |
| `PUBLIC_UMAMI_ID` | `analytics.umami.id` |
| `PUBLIC_DOCSEARCH_APP_ID` | `search.docsearch.appId` |
| `PUBLIC_DOCSEARCH_API_KEY` | `search.docsearch.apiKey` |
| `PUBLIC_DOCSEARCH_INDEX_NAME` | `search.docsearch.indexName` |
| `PUBLIC_INDEXNOW_ENABLE` | `seo.indexNow` |
| `PUBLIC_INDEXNOW_KEY` | `seo.indexNowKey` |
| `PUBLIC_GITHUB_CARD_API_BASE` | `githubCard.apiBase` |

## Content Authoring

### Frontmatter

```yaml
---
title: Post Title
published: 2024-05-01
updated: 2024-05-02            # Optional
description: Short summary
image: /cover.png              # Banner image, relative to /public
og: /og/custom.png             # Per-post OG override
slug: custom-url               # Overrides auto-generated slug
tags: [tag1, tag2]
tagLabels:                     # Display names (slug used for URL)
  tag1: "Tag One"
category: Guides
categoryLabel: "Guide Series"
draft: false                   # Hides from production
lang: en-US                    # BCP 47, required for i18n
mermaid: true                  # Injects Mermaid runtime
---
```

### URL Generation

`slug` → `posts.slugStrategy`:

| Strategy | Result |
|----------|--------|
| `file` (default) | Path-derived: `posts/hello/world.md` → `/posts/hello/world/` |
| `crc32` | 8-char hex from content entry ID → `/posts/a1b2c3d4/` |

Trailing slash enforced. `.html` pseudo-static URLs are not supported.

### Tags & Categories

Slug = URL identifier (`/tags/tag1/`). `tagLabels`/`categoryLabel` = display name. Build warns on conflicts:

```
[DisplayName Conflict] tag "demo": existing="Demo" vs new="演示示例" (source: posts/another-post.md)
```

Last-write-wins.

### Mermaid

```markdown
---
mermaid: true
---
```

Client-side only. Renders on pages with the `mermaid` flag set.

### KaTeX

Inline and block formulas. No frontmatter flag needed — `remark-math` + `rehype-katex` are always active.

### GitHub Cards & Admonitions

```
::github{repo="owner/repo"}
::githubfile{repo="owner/repo" path="src/main.ts"}

:::note
Content
:::
```

Admonition types: `note`, `tip`, `important`, `caution`, `warning`. GitHub `[!NOTE]` syntax supported via `remark-github-admonitions-to-directives`.

Default API: `https://api.github.com`. Proxy via `/ghc` when `githubCard.adapter.enabled = true`.

### Video Embeds

MDX only. Use `YouTube` and `Bilibili` components:

```mdx
import YouTube from "../../components/embed/YouTube.astro";
<YouTube id="VIDEO_ID" />
```

Both render `w-full aspect-video`.

### Image Lightbox

Photoswipe auto-attaches to `.post-cover` images. Click any content image to open full-screen viewer.

### Reading Time

Auto-calculated per post via `remark-reading-time`. Displayed in post metadata row.

### Mail Obfuscation

`mailto:` links encoded at build time by `postbuild.mjs`.

### Custom Head / Footer

```toml
[head]
customHtml = '<link rel="stylesheet" href="/custom.css">'
customScript = '(function(){ /* no <script> tag needed */ })()'

[footer]
customHtml = '<a href="https://beian.miit.gov.cn/">ICP备xxxxxxxx号</a>'
```

## i18n

BCP 47 routes. Default language at `/`, others prefixed:

| Language | URLs |
|----------|------|
| `en-US` (default) | `/posts/hello/`, `/archive/` |
| `zh-CN` | `/zh-CN/posts/hello/` |

- `translationKey`: links posts across languages. Omitted → inferred from filenames and content dirs.
- Missing translation: falls back to target language homepage.
- Spec pages: localized in `src/content/spec/<lang>/`, default fallback.
- `default-language-in-subdir: true` puts default under `/en-US/` (Hugo-compatible).
- `languages = ["en-US", "zh-CN"]` legacy array form still supported.

## Search

**Pagefind** (default): generated in postbuild. Language-filtered — no cross-language results.

**Algolia DocSearch**: enable in config:

```toml
[search.docsearch]
enable = true
appId = "..."
apiKey = "..."
indexName = "..."
```

When valid, Pagefind is disabled at build and runtime. `docsearch:language` meta tags emitted.

## Analytics

| Provider | TOML Key | Env Variable |
|----------|----------|-------------|
| Master switch | `analytics.enable` | `PUBLIC_ANALYTICS_ENABLE` |
| Google Analytics | `analytics.googleAnalyticsId` | `PUBLIC_GOOGLE_ANALYTICS_ID` |
| Umami | `analytics.umami.id` | `PUBLIC_UMAMI_ID` |
| Plausible | `analytics.plausible.domain` | `PUBLIC_PLAUSIBLE_DOMAIN` |
| Microsoft Clarity | `analytics.clarityProjectId` | `PUBLIC_CLARITY_PROJECT_ID` |
| Fathom | `analytics.fathomSiteId` | `PUBLIC_FATHOM_SITE_ID` |
| Simple Analytics | `analytics.simpleAnalyticsDomain` | `PUBLIC_SIMPLE_ANALYTICS_DOMAIN` |
| Matomo | `analytics.matomo.siteId` | `PUBLIC_MATOMO_SITE_ID` |
| Amplitude | `analytics.amplitudeApiKey` | `PUBLIC_AMPLITUDE_API_KEY` |

Loads only when `analytics.enable && import.meta.env.PROD`. Umami/Plausible/Matomo support optional `integrity` (SRI) for pinned scripts.

## LLM Documentation

Postbuild generates `llms.txt`, `llms-full.txt`, `llms-small.txt`. `llms.i18n = true` adds per-language files.

```toml
[llms]
enable = true
sitemap = true
title = "Site Name"
description = "Site description for AI indexing"
i18n = true
```

## SEO

| Feature | Mechanism |
|---------|-----------|
| Sitemap | `@astrojs/sitemap` (auto) |
| Robots.txt | Postbuild (auto, uses `site.url`) |
| IndexNow | Postbuild (`seo.indexNow = true`) |
| Search verification | `head.verification.google/.bing/.yandex/.naver` |
| Canonical + hreflang | Per-page (auto) |

IndexNow disabled by default. On → submits URLs every build.

## Architecture

### Islands

| Component | Framework | Hydration |
|-----------|-----------|-----------|
| Search | Svelte | `client:load` |
| Theme toggle | Svelte | `client:load` |
| Theme color picker | Svelte | `client:only` |
| Post cards, nav, layouts | Astro | none |

`client:only` reserved for `localStorage`-dependent panels with no SEO content.

### Transitions

Two-path, unified via `TransitionManager`:

| Browser | Mechanism | Cost |
|---------|-----------|------|
| View Transitions API | Astro `ClientRouter` | 0 extra bytes |
| No API | Swup + Preload plugin | Dynamic `import()` |

Single event API regardless of backend:

```ts
import { transitionManager } from "@utils/transition-manager";

transitionManager.on("transition:after-swap", () => {
  // re-init DOM-dependent code
});
```

Caveat: `DOMContentLoaded` only fires on hard loads. Always use `transition:after-swap` for post-navigation init.

On swap, restores `<html>` state (theme mode, hue, code theme) from `localStorage` + config defaults — not stale DOM.

### Performance

| Technique | Detail |
|-----------|--------|
| Font self-hosting | Roboto, Latin 400/500/700 only |
| Responsive images | Multi-width srcset via sharp |
| Icon tree-shaking | Vite plugin blocks `@iconify-json` JSON imports; only registered icons bundled |
| Prefetch | `prefetchAll: false`; hover on nav, tap on mobile |
| Immutable cache | `/_astro/*` → year-long immutable (content-hashed filenames) |
| HTML cache | Revalidation-friendly (no hash) |
| Minification | esbuild, `cssCodeSplit: true`, target `esnext` |
| Chunk warning | 700 KB |

### Caching by Platform

| Platform | Config | Rule |
|----------|--------|------|
| Cloudflare Pages | `dist/_headers` (postbuild) | `/_astro/*` immutable |
| Netlify | `dist/_headers` (postbuild) | `/_astro/*` immutable |
| Vercel | `vercel.json` | `/_astro/*` immutable |
| EdgeOne Pages | `edgeone.json` | `/_astro/*` immutable |

## Build Pipeline

```
materialize-ghc-adapter.mjs → astro build → postbuild.mjs
```

| Stage | Output |
|-------|--------|
| materialize | `functions/ghc/` or `api/ghc/` (only when adapter enabled) |
| astro build | `dist/` (SSG) |
| postbuild | `_headers`, `_redirects`, `robots.txt`, Pagefind, `llms.txt`, IndexNow |

## Scripts

| Command | Executes |
|---------|----------|
| `pnpm dev` | `astro dev` |
| `pnpm build` | materialize → build → postbuild |
| `pnpm preview` | `astro preview` |
| `pnpm check` | `astro check` |
| `pnpm type-check` | `tsc --noEmit` |
| `pnpm new-post` | Interactive post wizard |

## Directory Structure

```
KIRARI/
├── kirari.config.toml          # Site config (TOML)
├── astro.config.mjs            # Astro + integrations + Vite
├── src/
│   ├── constants.ts            # Wraps config-loader → Config
│   ├── config.ts               # Per-module re-exports (backward compat)
│   ├── types/config.ts         # TypeScript types
│   ├── components/             # .astro, .svelte
│   ├── content/
│   │   ├── posts/              # Markdown/MDX blog posts
│   │   └── spec/               # Static pages (about, friends)
│   ├── _data/                  # JSON (friends.json)
│   ├── i18n/                   # 11-language translation dicts
│   ├── layouts/                # Layout.astro, MainGridLayout.astro
│   ├── pages/                  # File-based routes
│   ├── plugins/                # remark, rehype, expressive-code
│   ├── styles/                 # Stylus (markdown-extend.styl)
│   └── utils/                  # config-loader, transition-manager, env
├── scripts/                    # Build pipeline
├── adapters/                   # ghc-card templates
├── public/                     # Static assets
└── dist/                       # Build output (gitignored)
```

## Release Validation

```bash
pnpm install --frozen-lockfile && pnpm type-check && pnpm astro check && pnpm build
```

`@astrojs/check` is dev-only. CI must use `--frozen-lockfile`.

## Changelog

[CHANGELOG.md](./CHANGELOG.md)

## License

MIT
