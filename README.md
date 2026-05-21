[中文文档](./README_CN.md)

<div align="center">

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/markd3ng/KIRARI)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/markd3ng/KIRARI)
[![Deploy to Cloudflare Pages](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/markd3ng/KIRARI)
[![Deploy with EdgeOne Pages](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?repository=https://github.com/markd3ng/KIRARI)

</div>

# KIRARI

Static blog theme. **Astro 6** + **Svelte 5** + **Tailwind CSS v4**. Configurable via `kirari.config.toml`. Targets Cloudflare Pages, Vercel, Netlify, and EdgeOne Pages.

## Tech Stack

| Category | Dependency | Version |
|----------|-----------|---------|
| Framework | astro | `^6.0.8` |
| UI Islands | svelte | `^5.55.5` |
| CSS | tailwindcss, stylus | `^4.2.4`, `^0.64.0` |
| Search (default) | pagefind | `^1.5.2` |
| Search (optional) | @docsearch/js (Algolia) | `^4.6.3` |
| Code Highlight | astro-expressive-code | `^0.41.7` |
| Math | rehype-katex, remark-math, katex | — |
| Diagrams | mermaid | `^11.14.0` |
| Icons | astro-icon, @iconify/svelte | — |
| Fonts | @fontsource/roboto, @fontsource-variable/jetbrains-mono | — |
| Transitions | View Transitions API (native) \| swup (fallback) | `^4.9.0` |
| Image | sharp, photoswipe | — |
| Content | @astrojs/mdx, remark/rehype plugin chain | — |
| Feeds | @astrojs/rss, @astrojs/sitemap | — |

## Quick Start

```bash
git clone https://github.com/markd3ng/KIRARI.git
cd KIRARI
pnpm install          # pnpm only; preinstall hook enforces this
pnpm dev              # astro dev
pnpm build            # astro build + postbuild pipeline
pnpm preview          # astro preview
```

> **pnpm ≥ 9.14.4 required.** `preinstall` hook blocks npm/yarn. `packageManager` field in `package.json` enforced.

## Fork Checklist

KIRARI repository is a working demo site. Fork, replace content/config, deploy.

| Path | Action | Required |
|------|--------|----------|
| `kirari.config.toml` | Set `site.url`, `site.title`, `profile.*`, `navBar.*`, `landingPage.*` | Yes |
| `src/content/posts/` | Delete demo posts, add your own `.md`/`.mdx` | Yes |
| `src/content/spec/about.md` | Replace About content | Recommended |
| `src/content/spec/friends.md` | Replace or remove Friends nav in config | Optional |
| `src/_data/friends.json` | Replace friend-link data | Optional |
| `src/assets/images/` | Replace avatar, banner, landing hero | Recommended |
| `public/favicon/` | Replace favicon files | Recommended |
| `public/og/default.png` | Replace default OG image | Recommended |

Post-fork validation:

```bash
pnpm type-check && pnpm astro check && pnpm build
```

Do not modify `src/components/`, `src/layouts/`, `src/styles/`, or `src/utils/` for standard use.

## Configuration

Single source: **`kirari.config.toml`** at project root. No `src/constants.ts` editing required.

**Priority chain:** Environment Variables → `kirari.config.toml` → `src/utils/config-loader.ts` defaults

```toml
[site]
url = "https://example.com"
title = "Site Title"
lang = "en-US"
base = "/"

[i18n]
enable = true
default-language = "en-US"

[i18n.languages.en-US]
label = "English"
locale = "en-US"
contentDir = "src/content/posts"

[i18n.languages.zh-CN]
label = "简体中文"
locale = "zh-CN"
contentDir = "src/content/posts/zh-CN"

[profile]
avatar = "assets/images/avatar.png"
name = "Author Name"
bio = "Short bio"

[[profile.links]]
name = "GitHub"
icon = "fa6-brands:github"
url = "https://github.com/you"

[[navBar.links]]
preset = "Home"

[[navBar.links]]
preset = "Archive"

[og]
defaultImage = "/og/default.png"
```

Full reference: read `kirari.config.toml` in the repository — every key is documented with bilingual comments.

### Environment Variables

For secrets (API keys, analytics IDs). `.env.local` is `.gitignore`d.

| Env Variable | Overrides TOML Key |
|-------------|-------------------|
| `PUBLIC_SITE_URL` | `site.url` |
| `PUBLIC_SITE_TITLE` | `site.title` |
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
updated: 2024-05-02           # Optional; displayed alongside published
description: Short summary    # Used in meta description and post cards
image: /cover.png             # Relative to /public; displayed as banner
og: /og/custom.png            # Per-post OG image override
slug: custom-post-url         # Overrides auto-generated slug
tags: [tag1, tag2]
tagLabels:                    # Optional: display names differing from slug
  tag1: "Tag One"
category: Guides
categoryLabel: "Guide Series" # Optional
draft: false                  # true hides from production
lang: en-US                   # BCP 47; required for i18n
mermaid: true                 # Enables client-side Mermaid rendering
---
```

### URL Generation

`slug` in frontmatter → `posts.slugStrategy` in config. Strategy options:

| Strategy | Behavior | Example |
|----------|----------|---------|
| `file` (default) | File-path-derived | `posts/hello/world.md` → `/posts/hello/world/` |
| `crc32` | 8-char hex from content entry ID | → `/posts/a1b2c3d4/` |

KIRARI enforces trailing slashes (`trailingSlash: "always"` in `astro.config.mjs`). `.html` pseudo-static URLs are not supported — they break canonical, RSS, sitemap, and i18n, with no SEO benefit.

### Tag & Category Display Names

Tags/categories use slug (lowercased, trimmed) as URL identifiers: `/tags/tag1/`. `tagLabels` and `categoryLabel` in frontmatter provide display names for the UI.

When multiple posts declare conflicting display names for the same slug, build emits a warning:

```
[DisplayName Conflict] tag "demo": existing="Demo" vs new="演示示例" (source: posts/another-post.md)
```

Last-write-wins. Use this log to identify inconsistencies.

### Mermaid Diagrams

```markdown
---
mermaid: true
---

\`\`\`mermaid
graph TD;
    A --> B;
\`\`\`
```

Mermaid rendering is client-side only. `mermaid: true` in frontmatter injects the Mermaid runtime for that page.

### Math (KaTeX)

`remark-math` + `rehype-katex` in the plugin chain. Write LaTeX inline or block — no frontmatter flag needed.

### GitHub Cards & Admonitions

Markdown directive syntax, processed by remark→rehype plugin chain:

```
::github{repo="owner/repo"}
::githubfile{repo="owner/repo" path="src/main.ts"}

:::note
Admonition content
:::
```

GitHub cards use `https://api.github.com` by default. For runtime proxying via Cloudflare Service Binding or Vercel Functions, set `githubCard.adapter.enabled = true` and `githubCard.apiBase = "/ghc"`. See `kirari.config.toml` `[githubCard]` section.

Available admonition types: `note`, `tip`, `important`, `caution`, `warning`. GitHub-style `[!NOTE]` syntax is also supported via `remark-github-admonitions-to-directives`.

### Video Embeds (MDX)

```mdx
import YouTube from "../../components/embed/YouTube.astro";
import Bilibili from "../../components/embed/Bilibili.astro";

<YouTube id="VIDEO_ID" />
<Bilibili bvid="BV1234567890" />
```

Both use `w-full aspect-video` for 16:9 responsive. `.mdx` extension required.

### Mail Obfuscation

`mailto:` links in Markdown are automatically encoded in build output by the postbuild pipeline:

```markdown
[contact@example.com](mailto:contact@example.com)
```

### Custom Head / Footer

Inject via `kirari.config.toml`:

```toml
[head]
customHtml = '<link rel="stylesheet" href="/custom.css">'
customScript = '(function(){ /* inline JS, no <script> tag */ })()'

[footer]
customHtml = '<a href="https://beian.miit.gov.cn/">ICP备xxxxxxxx号</a>'
customScript = ''
```

## i18n

BCP 47 public routes. `default-language` in config is served at `/`. Non-default languages use prefixed URLs:

| Language | URL Pattern |
|----------|-----------|
| `en-US` (default) | `/posts/hello/`, `/archive/`, `/about/` |
| `zh-CN` | `/zh-CN/posts/hello/`, `/zh-CN/archive/` |

Key behaviors:

- **`translationKey`** in frontmatter links posts across languages. Omitted → KIRARI infers translations from filename suffixes and content directory structure.
- **Missing translation**: language switcher falls back to target language homepage (`fallbackToDefault: true`).
- **Spec pages**: localized content goes in `src/content/spec/<lang>/`. Missing files fall back to default `src/content/spec/`.
- **`default-language-in-subdir: true`**: puts default language under `/en-US/` too (Hugo-compatible).

Language objects in config:

```toml
[i18n.languages.zh-CN]
label = "简体中文"
locale = "zh-CN"
direction = "ltr"
weight = 2
disabled = false
contentDir = "src/content/posts/zh-CN"
```

Legacy array form `languages = ["en-US", "zh-CN"]` still supported; language details fall back to built-in defaults for the 11 known BCP 47 tags.

## Search

**Default**: [Pagefind](https://pagefind.app/), generated during postbuild. Each page receives a language filter — `/zh-CN/` search queries never return English results.

**Optional**: [Algolia DocSearch](https://docsearch.algolia.com/). Enable in config:

```toml
[search.docsearch]
enable = true
appId = "..."
apiKey = "..."
indexName = "..."
filterByLanguage = true
```

When DocSearch is enabled with valid credentials, Pagefind is disabled at both build and runtime. Pages emit `docsearch:language` meta tags for crawler facets.

## Analytics

8 providers supported. Configure via `kirari.config.toml` or environment variables.

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

**Loading condition**: analytics scripts render only when `analytics.enable === true` **and** `import.meta.env.PROD === true`. Development builds never load analytics.

Umami, Plausible, and Matomo support optional `integrity` (SRI) for pinned/self-hosted scripts. Do not attach SRI to provider-managed scripts that update in place — stale hashes will break loading.

## LLM Documentation

Postbuild generates `llms.txt`, `llms-full.txt`, `llms-small.txt` at site root. When `llms.i18n = true`, language-specific files (`llms-en.txt`, `llms-zh.txt`) are also generated.

```toml
[llms]
enable = true
sitemap = true        # Add llms.txt files to sitemap.xml
title = "Site Name"
description = "Site description for AI indexing"
i18n = true
```

LLMs can fetch `https://yoursite.com/llms.txt` for site structure and content indexing.

## SEO

| Feature | Mechanism | Config |
|---------|-----------|--------|
| Sitemap | `@astrojs/sitemap` (auto) | — |
| Robots.txt | Postbuild pipeline (auto) | Uses `site.url` |
| IndexNow | Postbuild pipeline | `seo.indexNow = true`, `seo.indexNowKey = "..."` |
| Search verification | `<meta>` tags | `head.verification.google`, `.bing`, `.yandex`, `.naver` |
| Canonical URLs | Per-page | Auto-generated from `site.url` |
| hreflang | Per-page | Auto-generated for i18n pages |

> IndexNow submits URLs to search engines on every build. Disabled by default. Keep it off unless instant indexing is required.

## Architecture

### Astro Islands

Static content → `.astro` components. Interactive UI → `.svelte` components with explicit hydration:

| Component | Framework | Hydration |
|-----------|-----------|-----------|
| Search | Svelte | `client:load` (Pagefind) / conditional (DocSearch) |
| Theme toggle | Svelte | `client:load` |
| Theme color picker | Svelte | `client:only` (browser-localStorage) |
| Post cards, layouts, nav | Astro | Static (no hydration) |

`client:only` is reserved for the display settings panel — it reads `localStorage` and CSS custom properties and contains no SEO content.

### Page Transition System

Two-path strategy, unified via `TransitionManager` singleton (`src/utils/transition-manager.ts`):

| Browser | Mechanism | Load Strategy |
|---------|-----------|---------------|
| Has View Transitions API | Astro `ClientRouter` | Built-in, zero extra bytes |
| No View Transitions API | Swup + Preload plugin | Dynamic `import()` on first navigation |

**Unified event API** — components register against the same four events regardless of backend:

```ts
import { transitionManager } from "@utils/transition-manager";

transitionManager.on("transition:after-swap", () => {
  // Re-initialize DOM-dependent code after navigation
});
```

**Critical rule**: do not use `DOMContentLoaded` or `window.onload` for post-navigation init. Those fire only on hard page loads, not on SPA-style transitions.

On `transition:after-swap`, the system restores `<html>` appearance state (theme mode, hue, Expressive Code theme) from `localStorage` + config defaults — not by copying previous DOM.

### Performance

| Technique | Detail |
|-----------|--------|
| Font self-hosting | Roboto via `@fontsource/roboto`; only Latin `400/500/700` weights loaded |
| Responsive images | Banner, avatar, post covers → multi-width srcset via Astro Image / sharp |
| Icon tree-shaking | Vite plugin blocks all `@iconify-json` JSON imports; only manually registered icons in `astro.config.mjs` are bundled; runtime icons use CDN |
| Prefetch strategy | `prefetchAll: false`; hover on nav links, tap on mobile menu |
| Immutable caching | `/_astro/*` — content-hashed filenames → `Cache-Control: public, max-age=31536000, immutable` |
| HTML caching | Revalidation-friendly (no hash in filename) |
| Build minification | `esbuild` minifier, `cssCodeSplit: true`, `target: "esnext"` |
| Chunk size | Warning threshold 700 KB |
| View Transition state | Restored from `localStorage` + config defaults, not stale DOM copies |

### Caching Headers by Platform

| Platform | File | Rule |
|----------|------|------|
| Cloudflare Pages | `dist/_headers` (postbuild) | `/_astro/*` immutable |
| Netlify | `dist/_headers` (postbuild) | `/_astro/*` immutable |
| Vercel | `vercel.json` (static) | `/_astro/*` immutable |
| EdgeOne Pages | `edgeone.json` (static) | `/_astro/*` immutable |

## Build Pipeline

`pnpm build` executes sequentially:

```
materialize-ghc-adapter.mjs → astro build → postbuild.mjs
```

1. **`materialize-ghc-adapter.mjs`**: generates `functions/ghc/[[path]].ts` (Cloudflare) or `api/ghc/[...path].ts` (Vercel) only when `githubCard.adapter.enabled = true`
2. **`astro build`**: standard Astro SSG → `dist/`
3. **`postbuild.mjs`**: generates `_headers`, `_redirects`, `robots.txt`, Pagefind index, `llms.txt` files, and IndexNow submission

## Scripts

| Command | Purpose |
|---------|---------|
| `pnpm dev` | `astro dev` |
| `pnpm build` | materialize → astro build → postbuild |
| `pnpm preview` | `astro preview` |
| `pnpm check` | `astro check` (type-check `.astro` files) |
| `pnpm type-check` | `tsc --noEmit` |
| `pnpm new-post` | Interactive new-post wizard |

## Directory Structure

```
KIRARI/
├── kirari.config.toml          # Site configuration (TOML)
├── astro.config.mjs            # Astro + integrations + Vite
├── svelte.config.js            # Svelte compiler options
├── tsconfig.json
├── package.json
├── src/
│   ├── constants.ts            # Loads config via config-loader.ts
│   ├── config.ts               # Re-exports Config, deprecated getConfig
│   ├── types/config.ts         # TypeScript type definitions for Config
│   ├── components/             # .astro and .svelte components
│   ├── content/
│   │   ├── config.ts           # Zod schema for content collections
│   │   ├── posts/              # Blog posts (Markdown/MDX)
│   │   └── spec/               # Static pages (about, friends)
│   ├── _data/                  # JSON data (friends.json)
│   ├── i18n/                   # Translation dictionaries (11 languages)
│   ├── layouts/                # Page layouts
│   ├── pages/                  # File-based routes
│   ├── plugins/                # remark/rehype/Expressive Code plugins
│   ├── styles/                 # CSS, Stylus (markdown-extend.styl)
│   └── utils/                  # config-loader, transition-manager, env
├── scripts/                    # Build pipeline scripts
├── adapters/                   # Adapter templates (ghc-card)
├── public/                     # Static assets
└── dist/                       # Build output (gitignored)
```

## Release Validation

```bash
pnpm install --frozen-lockfile
pnpm type-check
pnpm astro check
pnpm build
```

CI/CD providers must use the committed `pnpm-lock.yaml`. Dependency refreshes stay within declared semver ranges for patch releases. `@astrojs/check` is dev-only.

## Changelog

[CHANGELOG.md](./CHANGELOG.md)

## Credits

- [saicaca/fuwari](https://github.com/saicaca/fuwari) — original theme
- [JoeyC-Dev/saicaca-fuwari](https://github.com/JoeyC-Dev/saicaca-fuwari) — enhanced fork

## License

MIT
