[中文文档](./README_CN.md)

<div align="center">

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/markd3ng/KIRARI)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/markd3ng/KIRARI)
[![Deploy to Cloudflare Pages](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/markd3ng/KIRARI)
[![Deploy with EdgeOne Pages](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?repository=https://github.com/markd3ng/KIRARI)

</div>

# KIRARI

Static blog theme — Astro 6.4.8 + Svelte 5 + Tailwind CSS v4. Single TOML config file. Targets Cloudflare Pages, Vercel, Netlify, EdgeOne Pages.

## Architecture

```
kirari.config.toml  ──→  smol-toml parse  ──→  config-loader.ts (type guards + defaults)
                                                        ↓
                                              Config singleton (@constants)
                                              ↓ per-section re-exports (@config)
                                              ↓ consumed by astro.config.mjs + all components
```

Configuration is **TOML-first**: edit `packages/site-profile/kirari.config.toml`
for normal site settings; builds materialize it into `apps/site/kirari.config.toml`.
Environment variables are reserved for secrets, deployment overrides, and provider
credentials that should not be committed.

**Islands**: Only 3 Svelte components hydrate on the client — Search (`client:idle`), Theme Toggle (`client:idle`), Display Settings (`client:only="svelte"`). Everything else is static `.astro`.

**Transitions**: `TransitionManager` singleton (see `src/utils/transition-manager.ts`) wraps a dual-path strategy:

| Browser capability | Engine | Payload |
|---|---|---|
| View Transitions API | Astro `ClientRouter` | 0 extra bytes |
| No View Transitions | Swup 4.9 + Preload plugin | Dynamic `import()` |

Unified event API regardless of backend:

```ts
import { transitionManager } from "@utils/transition-manager";

// Replaces DOMContentLoaded — works across SPA navigations
transitionManager.on("transition:after-swap", init);
```

Event mapping: `transition:start` ← `astro:before-preparation` / `visit:start`, `transition:before-swap` ← `astro:before-swap` / `content:replace`, `transition:after-swap` ← `astro:after-swap` / `page:view`, `transition:end` ← `astro:page-load` / `visit:end`.

> **Caveat**: `DOMContentLoaded` fires only on hard loads. Always register post-navigation init via `transition:after-swap`.

**Markdown plugin chain**:

| Stage | Plugins | Function |
|---|---|---|
| Remark | `remark-math`, `remark-reading-time`, `remark-excerpt`, `remark-github-admonitions-to-directives`, `remark-directive`, `remark-sectionize`, `parseDirectiveNode` | Parse frontmatter, directives, math, sections |
| Rehype | `rehype-katex`, `rehype-mermaid-pre`, `rehype-slug`, `rehype-lazy-load-image`, `rehype-components` (admonitions + GitHub cards), `rehype-autolink-headings` | Render math, diagrams, custom components |

**Build pipeline**:

```
materialize-ghc-adapter.mjs → astro build → postbuild.mjs
```

| Stage | Output |
|---|---|
| materialize | `functions/ghc/` or `api/ghc/` (only when `githubCard.adapter.enabled`; Cloudflare output is written to the deployment root, including `apps/site` monorepos) |
| astro build | `dist/` (SSG) |
| postbuild | `_headers`, `_redirects`, `robots.txt`, Pagefind index, `llms.txt`, IndexNow submit |

**Performance invariants**:

| Technique | Implementation |
|---|---|
| Fonts | Self-hosted Roboto (Latin 400/500/700 only) |
| Images | Multi-width `srcset` via sharp, `loading="lazy"` via `rehype-lazy-load-image` |
| Icons | Vite plugin blocks all `@iconify-json` imports; only registered icons bundled via `addIcon()` |
| Prefetch | `prefetchAll: false`; hover prefetch on desktop, tap on mobile |
| Cache | `/_astro/*` → immutable (content-hashed), HTML → revalidation-friendly |
| CSS | `cssCodeSplit: true`, target `esnext`, chunk warning at 700 KB |

## Tech Stack

| Category | Package | Version |
|---|---|---|
| Framework | astro | 6.4.8 |
| Islands | svelte | ^5.56.3 |
| CSS | tailwindcss, @tailwindcss/vite, stylus | ^4.3.0, ^0.64.0 |
| Search | pagefind (default), @docsearch/js (Algolia) | ^1.5.2, ^4.6.3 |
| Code highlight | astro-expressive-code + 4 plugins | ^0.43.1 |
| Math | remark-math, rehype-katex, katex | ^0.16.47 |
| Diagrams | mermaid (client-side) | ^11.15.0 |
| Icons | astro-icon, @iconify/svelte | — |
| Transitions | Astro ClientRouter / swup fallback | ^4.9.0 |
| Image viewer | photoswipe | ^5.4.4 |
| Image processing | sharp | ^0.34.5 |
| Scrollbar | overlayscrollbars | ^2.16.0 |
| Content | @astrojs/mdx + remark/rehype chain | ^5.0.6 |
| Feeds | @astrojs/rss, @astrojs/sitemap | — |
| OG images | satori | ^0.26.0 |
| Config | smol-toml | ^1.6.1 |

## Deployment

> **New to KIRARI?** Read the [Deployment Guide (step-by-step)](./DEPLOY.md) — covers Cloudflare Pages, GitHub Pages, Vercel, Netlify, EdgeOne Pages, Cloudflare API Token setup, and GitHub Card cache proxy deployment.

## Quick Start

```bash
git clone https://github.com/markd3ng/KIRARI.git
cd KIRARI
pnpm install          # pnpm only — preinstall hook blocks npm/yarn
pnpm site:dev
pnpm build
```

> pnpm ≥ 9.14.4 enforced via `packageManager` field.

## Fork Checklist

Only edit files listed below. Do not modify program files under `apps/site/src/components/`,
`apps/site/src/layouts/`, `apps/site/src/styles/`, or `apps/site/src/utils/`.

| Path | Action | Required |
|---|---|---|
| `packages/site-profile/kirari.config.toml` | Set `site.url`, `site.title`, `profile.*`, `navBar.*`, `landingPage.*` | Yes |
| `packages/site-profile/content/posts/` | Delete demo posts, add your `.md`/`.mdx` | Yes |
| `packages/site-profile/content/spec/about.md` | Replace About content | Recommended |
| `packages/site-profile/assets/` | Replace favicon, OG images, and profile assets | Recommended |
| `packages/site-profile/content/spec/friends.md` | Replace or remove Friends nav in config | Optional |
| `packages/site-profile/content/spec/projects.md` | Replace GitHub project cards or remove Projects nav in config | Optional |
| `packages/site-profile/data/friends.json` | Replace friend-link data | Optional |

Validation:

```bash
pnpm install --frozen-lockfile
pnpm site:type-check
pnpm site:astro-check
pnpm edge:type-check
pnpm edge:test
pnpm build
pnpm audit --audit-level moderate
```

## Configuration

Single user-editable source: `packages/site-profile/kirari.config.toml`.
Priority: **ENV vars > TOML > defaults** in `config-loader.ts`.

Every key in `packages/site-profile/kirari.config.toml` carries bilingual comments.
The file is the canonical profile reference. Below is a structural overview.

### Site

```toml
[site]
url = "https://example.com"
title = "Site Title"
subtitle = "Demo Site"
lang = "en-US"    # en-US | zh-CN | zh-TW | zh-HK | ja-JP | ko-KR | es-ES | th-TH | vi-VN | tr-TR | id-ID
base = "/"        # For subdirectory hosting: "/blog"

[site.themeColor]
hue = 250         # 0–360
fixed = false     # true hides the color picker from visitors

[site.banner]
enable = true
src = "assets/images/demo-banner.png"   # Relative to src/ or /public
position = "center"                      # top | center | bottom

[site.toc]
enable = true
depth = 3          # 1 | 2 | 3
layout = "floating" # floating | sidebar
```

### Sidebar

```toml
[sidebar]
enabled = true
position = "left"

[[sidebar.leftWidgets]]
type = "profile"     # profile | toc | categories | tags
enabled = true
position = "top"     # top | sticky
showOnPostPage = true
showOnNonPostPage = true

[[sidebar.mobileWidgets]]
type = "profile"
enabled = false      # mobile bottom widgets are opt-in
position = "top"
```

The default widget order preserves the classic KIRARI sidebar. `type = "toc"` only renders on post pages when `site.toc.layout = "sidebar"`.

### Widgets

```toml
[widgets.announcement]
enabled = false
title = "Announcement"
content = ""

[widgets.advertisement]
enabled = false
imageSrc = ""
linkUrl = ""

[widgets.siteStats]
enabled = true
siteStartDate = "2025-01-01"

[widgets.siteInfo]
enabled = true

[widgets.calendar]
enabled = true
showHeatmap = true
```

Place optional widgets in `sidebar.leftWidgets` or `sidebar.mobileWidgets` with types `announcement`, `advertisement`, `siteStats`, `siteInfo`, or `calendar`.

### Posts

```toml
[posts]
slug-strategy = "file"   # file (path-derived) | crc32 (8-char hex from content entry ID)
```

When `frontmatter.slug` is set, it overrides the strategy. Trailing slash always enforced.

Post categories support slash-delimited nesting, for example `category: "frontend/react"`. Parent category pages include posts from their child categories.

### Profile

```toml
[profile]
avatar = "assets/images/demo-avatar.png"
avatarRounded = false   # true renders the profile avatar as a circle
name = "Lorem Ipsum"
bio = "Lorem ipsum dolor sit amet."
```

### i18n

BCP 47 routes with Hugo-compatible `default-language-in-subdir`:

| Language | URL (default-in-subdir=false) |
|---|---|
| `en-US` (default) | `/posts/hello/` |
| `zh-CN` | `/zh-CN/posts/hello/` |

```toml
[i18n]
enable = true
default-language = "en-US"
default-language-in-subdir = false   # true → /en-US/ as default
fallbackToDefault = true             # Missing translation → target homepage

[i18n.languages.en-US]
label = "English"
locale = "en-US"
direction = "ltr"
weight = 1
disabled = false
contentDir = "src/content/posts"

[i18n.languages.zh-CN]
label = "简体中文"
locale = "zh-CN"
direction = "ltr"
weight = 2
disabled = false
contentDir = "src/content/posts/zh-CN"
```

11 languages pre-configured (5 disabled by default: ja-JP, ko-KR, es-ES, th-TH, vi-VN, tr-TR, id-ID). Translation dicts in `src/i18n/languages/`.

`translationKey` frontmatter links posts across languages. Omitted → inferred from filename parity within matching content directories.

### Navigation

5 presets: `Home`, `Archive`, `About`, `Friends`, `Projects`. Custom links supported:

```toml
[[navBar.links]]
preset = "Home"

[[navBar.links]]
name = "GitHub"
url = "https://github.com/you"
external = true

[[navBar.links]]
name = "Docs"
url = "/docs/"

[[navBar.links.children]]
name = "Guide"
url = "/docs/guide/"
```

### Search

KIRARI supports three search providers. Pick one in TOML:

The dedicated `/search/` page accepts `?q=keyword` and uses the active provider without changing the navbar search shortcut.

```toml
[search]
provider = "pagefind" # pagefind | docsearch | google
```

**Pagefind** (default): local static index generated at postbuild. Language-filtered at query time, so cross-language results are avoided.

**Algolia DocSearch**: external hosted docs search. Pagefind is disabled at build and runtime when this provider is active.

```toml
[search]
provider = "docsearch"

[search.docsearch]
enable = true
appId = "..."
apiKey = "..."
indexName = "..."
filterByLanguage = true
[search.docsearch.metaTags]
version = "latest"
```

**Google Programmable Search**: external Google search for your site. Pagefind is disabled when this provider is active. `cx` is a public search engine ID, not a secret.

```toml
[search]
provider = "google"

[search.google]
cx = "YOUR_PROGRAMMABLE_SEARCH_ENGINE_ID"
adsense = false
resultSetSize = "filtered_cse"
safeSearch = "active"
```

When `adsense = false`, KIRARI renders Google results in the existing search panel style via the Programmable Search Element callbacks. When `adsense = true`, Google renders the result area so AdSense search ads and Google labels are not hidden or rewritten; ad display is controlled by Google/AdSense.

### Comments

```toml
[comments]
provider = "none" # none | giscus | waline | twikoo
```

Posts enable comments by default when a provider is configured. Set `comments: false` in frontmatter to disable a single post. `/guestbook/` reuses the same comments component with a fixed guestbook path.

### Sponsor And Bangumi

```toml
[sponsor]
enabled = false

[bangumi]
enabled = false
userId = ""
mode = "dynamic"
```

`/sponsor/` and `/bangumi/` are hidden by default. Bangumi v1 loads data in the browser so third-party API outages do not break static builds.

### Fonts, Covers, And Markdown

```toml
[fonts]
enabled = false
links = []
fontFamily = ""

[coverImage]
lqip = true
fadeIn = true

[markdown.plantuml]
enable = false
server = "https://www.plantuml.com/plantuml"

[markdown.admonitions]
theme = "kirari" # kirari | github | vitepress | obsidian
```

Mermaid fenced code blocks are auto-detected by the Markdown pipeline when Mermaid is enabled. PlantUML is optional and off by default.

### Analytics

Master switch: `analytics.enable`. Scripts load only when `true && PROD`.

| Provider | Config key | ENV override |
|---|---|---|
| Google Analytics | `analytics.googleAnalyticsId` | `PUBLIC_GOOGLE_ANALYTICS_ID` |
| Umami | `analytics.umami.id` | `PUBLIC_UMAMI_ID` |
| Plausible | `analytics.plausible.domain` | `PUBLIC_PLAUSIBLE_DOMAIN` |
| Microsoft Clarity | `analytics.clarityProjectId` | `PUBLIC_CLARITY_PROJECT_ID` |
| Fathom | `analytics.fathomSiteId` | `PUBLIC_FATHOM_SITE_ID` |
| Simple Analytics | `analytics.simpleAnalyticsDomain` | — |
| Matomo | `analytics.matomo.siteId` + `src` | `PUBLIC_MATOMO_SITE_ID`, `PUBLIC_MATOMO_SRC` |
| Amplitude | `analytics.amplitudeApiKey` | `PUBLIC_AMPLITUDE_API_KEY` |

Umami, Plausible, Matomo support optional `integrity` (SRI) for pinned scripts.

### Landing Page

PRD-style hero + feature cards + latest articles. When enabled, `/blog/` still serves the classic post list.

```toml
[landingPage]
enable = true
latestCount = 3              # Max 12
heroImage = "assets/images/demo-banner.png"

[[landingPage.features.items]]
icon = "material-symbols:code-rounded"
title = "Feature Name"
description = "Feature description"
```

### GitHub Cards

Inline `::github{repo="owner/repo"}` and `::githubfile{repo="owner/repo" path="src/main.ts"}` directives. Default API: `https://api.github.com`.

For platforms with rate limits, enable the runtime adapter:

```toml
[githubCard.adapter]
enabled = true
provider = "cloudflare"   # cloudflare | vercel | auto
route = "/ghc"
serviceBinding = "GHCARD_CACHE"
```

- **Cloudflare Pages**: Deploy a separate Worker with a GitHub token as Secret. Set `serviceBinding` to the binding name.
- **Vercel**: Set `GITHUB_TOKEN` in Project Environment Variables. Set `GHC_ALLOWED_ORIGINS` to a comma-separated list of exact origins allowed to call the adapter. When empty, browser Origin requests are not granted CORS; same-origin/no-Origin server requests still work without `Access-Control-Allow-Origin`.

### SEO

| Feature | Mechanism |
|---|---|
| Sitemap | `@astrojs/sitemap` (auto) |
| Robots.txt | Generated in postbuild from `site.url` |
| Canonical + hreflang | Per-page, auto-derived |
| Search verification | `head.verification.{google,bing,yandex,naver}` |
| IndexNow | `seo.indexNow = true` → submits to participating engines on every build |
| Google indexing | `seo.google.indexingApi = true` → optional advanced Google Indexing API submit |

IndexNow covers participating engines such as Bing, Yandex, Naver, Seznam.cz, and Yep. Google does not support IndexNow; use sitemap/Search Console, or the optional Google Indexing API for eligible content. The IndexNow key is a public verification key served at `/{key}.txt`; do not reuse passwords, tokens, or other private secrets as the key. Google Indexing API is mainly intended for JobPosting and BroadcastEvent URLs, so ordinary blog pages are not guaranteed to benefit.

### LLMs.txt

Postbuild generates `llms.txt`, `llms-small.txt`, `llms-full.txt`. With `llms.i18n = true`, per-language files (`llms-en.txt`, `llms-zh.txt`) are also emitted. `llms-full.txt` is a public aggregation of page text with a 20,000-character cap per page; postbuild adds `Disallow: /llms-full.txt` to `robots.txt` and `Cache-Control: no-store` to deployment headers as mitigation, not access control.

```toml
[llms]
enable = true
sitemap = true
title = "Site Name"
description = "Site description for AI indexing"
includePatterns = ["*"]
excludePatterns = ["*/categories/*", "*/tags/*", "*/archive/*", "*/page/*"]
i18n = true
```

### Custom Head / Footer

For pasted HTML or JavaScript, prefer trusted files under `src/snippets/`. This
avoids TOML escaping problems with quotes, backslashes, and template strings.
Inline TOML fields remain supported for short snippets.

```toml
[head]
customHtml = '<link rel="stylesheet" href="/custom.css">'
customScript = '(function(){ /* no <script> tag needed */ })()'
customHtmlFile = "head.html"      # src/snippets/head.html, raw <head> HTML
customScriptFile = "head.js"      # src/snippets/head.js, no <script> tag

[footer]
customHtml = '<a href="https://beian.miit.gov.cn/">ICP备xxxxxxxx号</a>'
customHtmlFile = "footer.html"    # src/snippets/footer.html
customScriptFile = "footer.js"    # src/snippets/footer.js, no <script> tag
```

Snippet file names must be basenames such as `head.html`; paths like
`../secret.html`, `/tmp/x.html`, and subdirectories are ignored. Snippets are
trusted maintainer input and are rendered with `set:html`; never feed visitor,
comment, or CMS user content into them. The default CSP remains compatible with
these owner-level inline snippets by allowing inline script/style; tightening CSP
requires moving snippets to nonce/hash-aware external assets first.

## Content Authoring

### Frontmatter

```yaml
---
title: Post Title
published: 2024-05-01
updated: 2024-05-02            # Optional
description: Short summary
image: /cover.png              # Banner, relative to /public
og: /og/custom.png             # Per-post OG override
slug: custom-url               # Overrides slugStrategy
tags: [tag1, tag2]
tagLabels:                     # UI display name (URL uses slug)
  tag1: "Tag One"
category: Guides
categoryLabel: "Guide Series"
draft: false                   # Hidden in production
lang: en-US                    # Required for i18n
mermaid: true                  # Injects Mermaid runtime (client-side only)
notbyai: true                  # Shows a localized Not By AI badge in the license area
translationKey: my-post        # Cross-language post linking
---
```

Set `notbyai: true` to show the localized Not By AI "Written By Human" badge in the post license area.

### Admonitions

```
:::note
Content
:::
```

Types: `note`, `tip`, `important`, `caution`, `warning`. GitHub `[!NOTE]` syntax forwarded via `remark-github-admonitions-to-directives`.

### Video Embeds (MDX only)

```mdx
import YouTube from "../../components/embed/YouTube.astro";
<YouTube id="VIDEO_ID" />
```

`YouTube` and `Bilibili` — both render `w-full aspect-video`.

### Image Lightbox

Photoswipe auto-attaches to `.post-cover` images. Click any content image for full-screen viewer.

## Platform Caching

| Platform | Config file | Rule |
|---|---|---|
| Cloudflare Pages | `apps/site/dist/_headers` (postbuild) | `/_astro/*` immutable |
| Netlify | `apps/site/dist/_headers` (postbuild) | `/_astro/*` immutable |
| Vercel | `vercel.json` | `/_astro/*` immutable |
| EdgeOne Pages | `edgeone.json` | `/_astro/*` immutable |
| GitHub Pages | GitHub Actions artifact | Use `site.base` for repository subpaths; front with a CDN for immutable headers |

## GitHub Pages

GitHub Pages works as static hosting when the build uploads `apps/site/dist/` from
`pnpm build`. For `https://user.github.io/repo/`, set `site.base = "/repo/"` in
`packages/site-profile/kirari.config.toml`; for a custom domain, keep `site.base = "/"` and add the
domain in the Pages settings. Pagefind, RSS, sitemap, and LLMs files are
generated during the normal build, so the Actions workflow should deploy the
final `apps/site/dist/` artifact rather than source files.

## Scripts

| Command | Executes |
|---|---|
| `pnpm site:dev` | `astro dev` for `@kirari/site` |
| `pnpm build` | materialize → astro build → postbuild |
| `pnpm check` | site type-check → Astro check → edge type-check → edge test |
| `pnpm site:type-check` | `tsc --noEmit` for `@kirari/site` |
| `pnpm site:astro-check` | `astro check` for `@kirari/site` |
| `pnpm edge:type-check` | `tsc --noEmit` for `@kirari/edge` |
| `pnpm edge:test` | edge runtime tests |
| `pnpm --filter @kirari/site preview` | `astro preview` |
| `pnpm --filter @kirari/site new-post` | Interactive post creation wizard |

## Directory Structure

```
KIRARI/
├── apps/
│   └── site/                   # Astro site program
│       ├── kirari.config.toml  # Materialized profile config
│       ├── astro.config.mjs    # Integrations, markdown plugins, Vite config
│       └── src/
│           ├── constants.ts    # Config loader → Config singleton
│           ├── config.ts       # Per-section re-exports (backward compat)
│           ├── types/config.ts # Full TypeScript type tree
│           ├── components/     # .astro (static), .svelte (islands)
│           ├── layouts/        # Layout.astro, MainGridLayout.astro
│           ├── pages/          # File-based routes + [lang]/ variants
│           ├── plugins/        # Remark/rehype adapters, expressive-code plugins
│           ├── i18n/           # Translation dicts
│           ├── styles/         # Markdown/component style layers
│           └── utils/          # config-loader, transition-manager, env, i18n-utils
├── packages/
│   └── site-profile/           # Default content, config, brand assets, snippets
├── workers/
│   └── kirari-edge/            # Optional edge runtime
└── apps/site/dist/             # Build output (gitignored)
```

## Release Validation

```bash
pnpm install --frozen-lockfile
pnpm site:type-check
pnpm site:astro-check
pnpm edge:type-check
pnpm edge:test
pnpm build
pnpm audit --audit-level moderate
```

CI must use `--frozen-lockfile`. `@astrojs/check` is devDependency only.

## Changelog

[CHANGELOG.md](./CHANGELOG.md)

## Credits

[CREDITS.md](./CREDITS.md)

## License

MIT
