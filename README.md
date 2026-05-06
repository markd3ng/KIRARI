[中文文档](./README_CN.md)

<div align="center">

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/markd3ng/KIRARI)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/markd3ng/KIRARI)
[![Deploy to Cloudflare Pages](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/markd3ng/KIRARI)
[![Deploy with EdgeOne Pages](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?repository=https://github.com/markd3ng/KIRARI)

</div>

# KIRARI

A modern, high-performance static blog theme built with **Astro 6** + **Svelte 5** + **TailwindCSS 4**. Features configurable OG images, full-text search, smooth page transitions, and LLM-ready documentation support.

## Features

- **Configurable OG Images** - Per-post `frontmatter.og` override with global fallback via `og.defaultImage`

- **Full-text Search** - Powered by Pagefind, with debounce and concurrent request handling
- **Mermaid Diagrams** - Flowcharts, sequence diagrams, and more with client-side rendering
- **Math Equations** - KaTeX for LaTeX rendering
- **Hugo-like i18n** - Language-prefixed URLs, per-post `translationKey`, language switch, canonical and `hreflang` links
- **LLM-Ready** - Auto-generates `llms.txt` for AI indexing
- **Dark Mode** - System preference detection + manual toggle
- **Smooth Transitions** - View Transitions API with Swup fallback for older browsers
- **Security Hardened** - All external links include `rel="noopener noreferrer"`
- **Code Hygiene** - Removed unused props/files/dependencies and reduced debug log noise (no functional behavior change)

## Quick Start

```bash
# Clone the repository
git clone https://github.com/markd3ng/KIRARI.git
cd KIRARI

# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Configuration

All settings are configured via **`kirari.config.toml`** (Hugo-style, recommended).

Configuration priority: **Environment Variables** → **`kirari.config.toml`** → **Default values**

### Quick Start

Edit `kirari.config.toml` in the project root:

```toml
[site]
url = "https://your-domain.com"
title = "Your Site"
subtitle = "Your Tagline"
lang = "en"                    # en, zh_CN, zh_TW, ja, ko, es, th, vi, tr, id
base = "/"                     # Base path (e.g., "/blog" for subdirectory)

[i18n]
enable = true
defaultLang = "en"             # Root / redirects to /en/
languages = ["en", "zh_CN", "zh_TW", "ja", "ko", "es", "th", "vi", "tr", "id"]
fallbackToDefault = true       # Missing translations switch to the target language homepage

[search.docsearch]
enable = false                 # When true, Pagefind is disabled
appId = ""
apiKey = ""
indexName = ""
filterByLanguage = true        # Uses docsearch:language meta tags

[site.themeColor]
hue = 250                      # 0-360 (red: 0, teal: 200, cyan: 250, pink: 345)
fixed = false                  # Hide theme color picker

[site.banner]
enable = true
src = "assets/images/banner.png"
position = "center"            # 'top', 'center', 'bottom'

[site.banner.credit]
enable = false
text = ""
url = ""

[site.toc]
enable = true                  # Display table of contents
depth = 3                      # Maximum heading depth (1-3)

[[site.favicon]]
src = "/favicon/icon.png"
theme = "light"                # Optional: 'light' or 'dark'
sizes = "32x32"                # Optional: favicon size

[profile]
avatar = "assets/images/avatar.png"
name = "Your Name"
bio = "Your bio"

[[profile.links]]
name = "GitHub"
icon = "fa6-brands:github"     # Visit https://icones.js.org/ for icon codes
url = "https://github.com/you"

[license]
enable = true
name = "CC BY-NC-SA 4.0"
url = "https://creativecommons.org/licenses/by-nc-sa/4.0/"

[head.verification]
google = ""                    # Google Search Console verification code
bing = ""                      # Bing Webmaster Tools verification code

[og]
defaultImage = "/og/default.png"

[llms]
enable = true
sitemap = true
title = "Your Site"
description = "Your site description"
i18n = true

[seo]
indexNow = false               # Enable IndexNow for instant search engine indexing
indexNowKey = ""               # IndexNow API key
```

### Internationalization

KIRARI uses language-prefixed public routes: `/en/`, `/zh-cn/`, `/zh-tw/`, `/ja/`, `/ko/`, `/es/`, `/th/`, `/vi/`, `/tr/`, and `/id/`. The root path `/` is only an entry redirect to the configured default language.

Posts can be connected across languages with `translationKey`:

```yaml
---
title: Markdown Example
lang: en
translationKey: markdown
---
```

If the current page has a matching translation, the navbar language switch links to that translated page. Otherwise it falls back to the target language homepage.

Static spec pages can be localized by adding files under `src/content/spec/<lang-slug>/`, for example `src/content/spec/zh-cn/about.md`. Missing localized files fall back to the default `src/content/spec/about.md` or `friends.md` content.

### Search

Pagefind is the default local search engine. KIRARI adds a language filter to each generated page and searches only the active language, so `/zh-cn/` does not mix English results into Chinese queries.

Algolia DocSearch can be enabled with `[search.docsearch]` or `PUBLIC_DOCSEARCH_*` environment variables. When DocSearch is enabled and `appId`, `apiKey`, and `indexName` are present, Pagefind is disabled at build/runtime. Pages emit `docsearch:language` plus optional `[search.docsearch.metaTags]` entries as `<meta name="docsearch:*">` tags for crawler facets.

### Performance Strategy

- Roboto is self-hosted through `@fontsource/roboto`; only the Latin `400`, `500`, and `700` weights are loaded by default.
- Responsive image widths are generated for banner, avatar, and post covers to reduce mobile transfer size while preserving display quality.
- Astro prefetch is selective: navigation links use `hover`, mobile/menu links use `tap`, and `prefetchAll` stays disabled.
- `pnpm build` generates `dist/_headers` and `dist/_redirects` for Cloudflare Pages and Netlify, while `vercel.json` and `edgeone.json` define immutable caching for `/_astro/*` on Vercel and EdgeOne.
- `/_astro/*` is immutable because filenames are content-hashed; HTML, Pagefind assets, and non-hashed public files stay revalidation-friendly.

### Navigation Bar

Configure navigation links (supports presets and custom links):

```toml
[[navBar.links]]
preset = "Home"                # Presets: Home, Archive, About, Friends

[[navBar.links]]
preset = "Archive"

[[navBar.links]]
name = "GitHub"                # Custom link
url = "https://github.com/you"
external = true                # Open in new tab with external icon
```

### Analytics

Configure analytics services:

```toml
[analytics]
enable = true                  # Master switch (default: false)
googleAnalyticsId = "G-XXXXXXXXXX"
clarityProjectId = "your-project-id"
fathomSiteId = "your-site-id"
simpleAnalyticsDomain = "example.com"
amplitudeApiKey = "your-api-key"

[analytics.umami]
id = "your-website-id"
src = "https://analytics.umami.is/script.js"

[analytics.plausible]
domain = "example.com"
src = "https://plausible.io/js/script.js"

[analytics.matomo]
siteId = "1"
src = "https://matomo.example.com/piwik.js"
```

**Analytics services table:**

| Service | Configuration |
|---------|--------------|
| Google Analytics | `googleAnalyticsId` |
| Umami | `umami.id`, `umami.src` (optional) |
| Plausible | `plausible.domain`, `plausible.src` (optional) |
| Microsoft Clarity | `clarityProjectId` |
| Fathom | `fathomSiteId` |
| Simple Analytics | `simpleAnalyticsDomain` |
| Matomo | `matomo.siteId`, `matomo.src` |
| Amplitude | `amplitudeApiKey` |

Analytics load only when both conditions are met:
1. `analytics.enable = true`
2. Production build (`import.meta.env.PROD`)

### Environment Variables (Sensitive Data Only)

For sensitive data (API keys, analytics IDs), use environment variables instead of TOML:

**Create `.env.local` in project root:**

```bash
# Analytics (recommended for production)
PUBLIC_ANALYTICS_ENABLE=true
PUBLIC_GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
PUBLIC_UMAMI_ID=your-website-id
PUBLIC_UMAMI_SRC=https://analytics.umami.is/script.js
PUBLIC_PLAUSIBLE_DOMAIN=example.com
PUBLIC_CLARITY_PROJECT_ID=your-project-id
PUBLIC_FATHOM_SITE_ID=your-site-id
PUBLIC_SIMPLE_ANALYTICS_DOMAIN=example.com
PUBLIC_MATOMO_SITE_ID=1
PUBLIC_MATOMO_SRC=https://matomo.example.com/piwik.js
PUBLIC_AMPLITUDE_API_KEY=your-api-key

# SEO
PUBLIC_INDEXNOW_ENABLE=false
PUBLIC_INDEXNOW_KEY=your-indexnow-key

# Search Engine Verification (sensitive)
PUBLIC_GOOGLE_VERIFICATION=your-verification-code
PUBLIC_BING_VERIFICATION=your-verification-code
```

**Priority:** Environment variables override TOML values.

> **Note**: `.env.local` is already in `.gitignore`, so your sensitive data won't be committed.

### Deployment Configuration

| Environment | Configuration Method |
|-------------|---------------------|
| Local development | Edit `kirari.config.toml` directly |
| Production (non-sensitive) | Edit `kirari.config.toml` and commit |
| Production (sensitive) | Set environment variables in Vercel/Netlify dashboard |
| Default fallback | Values in `src/utils/config-loader.ts` |


## Key Features


### Writing Posts

Create Markdown files in `src/content/posts/`:

```markdown
---
title: Post Title
published: 2024-05-01
updated: 2024-05-02      # Optional
description: Short desc  # Optional
image: /cover.png        # Optional banner image
og: /og/custom.png       # Optional custom OG image for this post
tags: [tag1, tag2]       # Optional
category: Guides         # Optional
draft: false             # Hide in production
lang: en                 # Language code
mermaid: true            # Enable Mermaid diagrams
---

Your content here.
```

### Tag & Category Display Names

Tags and categories use their slug (lowercase, trimmed) as URL identifiers. You can optionally specify display names that differ from the slug:

```markdown
---
tags: [demo, tutorial]
tagLabels:
  demo: "演示 Demo"
  tutorial: "Tutorial Guide"
category: devops
categoryLabel: "DevOps 运维"
---
```

**How it works:**
- URL remains `/tags/demo/` (uses slug)
- Display shows "演示 Demo" (uses `tagLabels`)
- If no label is declared, the original slug value is displayed

**Conflict Detection:**
When multiple posts declare different display names for the same slug, a warning is logged during build:

```
[DisplayName Conflict] tag "demo": existing="演示" vs new="Demo示例" (source: posts/another-post.md)
```

The later value overwrites the earlier one. Use this log to identify and fix naming inconsistencies.

### OG Images

- **Posts**: Prefer `frontmatter.og`
- **Fallback**: If `frontmatter.og` is not set, use `og.defaultImage`
- **Other pages**: Use `og.defaultImage`


### Mermaid Diagrams

Add `mermaid: true` to frontmatter:

````markdown
---
mermaid: true
---

```mermaid
graph TD;
    A --> B;
```
````

### Friends Page

Edit `src/_data/friends.json`:

```json
[
  {
    "siteTitle": "Friend's Blog",
    "siteDesc": "Description",
    "siteUrl": "https://example.com",
    "siteIcon": "https://example.com/avatar.png"
  }
]
```

### Custom Head/Footer

```typescript
// src/constants.ts
head: {
  verification: {
    google: "your-verification-code",
    bing: "your-verification-code"
  },
  customHtml: "",
  customScript: ""
},
footer: {
  customHtml: "",
  customScript: ""
}
```

**`customScript`** - Third-party scripts (analytics, ads) are automatically offloaded to a Web Worker via Partytown for better performance. Just provide the script **content** (no `<script>` tags needed):

```typescript
footer: {
  customScript: `(function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
  })(window, document, "clarity", "script", "YOUR_PROJECT_ID");`
}
```

**`customHtml`** - For full control over HTML/script tags. Use this if you need custom attributes or don't want Partytown:

```typescript
head: {
  customHtml: `<script type="text/javascript" src="https://example.com/script.js"></script>`
}
```

### LLMs Documentation

Powered by `astro-llms-generate`. Build generates:
- `llms.txt` - Main index (Markdown summary for LLMs)
- `llms-full.txt` - Complete content in one file
- `llms-small.txt` - Condensed version
- `llms-en.txt`, `llms-zh.txt` - Language-specific files (when `i18n: true`)

**Configuration** in `src/constants.ts`:

```typescript
llms: {
  enable: true,        // Enable/disable generation
  sitemap: true,       // Add llms.txt files to sitemap
  title: "Your Site",  // Site title in llms.txt
  description: "Your site description for LLMs",
  i18n: true           // Generate language-specific files
}
```

**Usage for LLMs**: AI assistants can fetch `https://yoursite.com/llms.txt` to understand your site structure and content, enabling better contextual responses about your documentation or blog.

### Analytics

Integrated via `astro-analytics`, supporting multiple analytics services. Configure in `src/constants.ts` or via environment variables.

Analytics are loaded only when both conditions are met:
1. `analytics.enable` (or `PUBLIC_ANALYTICS_ENABLE`) is `true`
2. Build/runtime is production (`import.meta.env.PROD`)



```typescript
// src/constants.ts
analytics: {
  enable: true,                            // Master switch (default: false)
  googleAnalyticsId: "G-XXXXXXXXXX",       // Google Analytics
  umami: { id: "your-id", src: "https://..." },  // Umami
  plausible: { domain: "example.com" },     // Plausible
  clarityProjectId: "your-project-id",     // Microsoft Clarity
  fathomSiteId: "your-site-id",            // Fathom
  simpleAnalyticsDomain: "example.com",    // Simple Analytics
  matomo: { siteId: "1", src: "https://..." },  // Matomo
  amplitudeApiKey: "your-api-key"          // Amplitude
}
```

**Supported Services:**

| Service | Config Key | Env Variable |
|---------|-----------|--------------|
| **Master Switch** | `enable` | `PUBLIC_ANALYTICS_ENABLE` |
| Google Analytics | `googleAnalyticsId` | `PUBLIC_GOOGLE_ANALYTICS_ID` |
| Umami | `umami.id`, `umami.src` | `PUBLIC_UMAMI_ID`, `PUBLIC_UMAMI_SRC` |
| Plausible | `plausible.domain`, `plausible.src` | `PUBLIC_PLAUSIBLE_DOMAIN`, `PUBLIC_PLAUSIBLE_SRC` |
| Microsoft Clarity | `clarityProjectId` | `PUBLIC_CLARITY_PROJECT_ID` (preferred), `PUBLIC_CLARITY_ID` (alias) |

| Fathom | `fathomSiteId` | `PUBLIC_FATHOM_SITE_ID` |
| Simple Analytics | `simpleAnalyticsDomain` | `PUBLIC_SIMPLE_ANALYTICS_DOMAIN` |
| Matomo | `matomo.siteId`, `matomo.src` | `PUBLIC_MATOMO_SITE_ID`, `PUBLIC_MATOMO_SRC` |
| Amplitude | `amplitudeApiKey` | `PUBLIC_AMPLITUDE_API_KEY` |

> **Note**: Scripts are rendered directly in `<head>`. Microsoft Clarity uses a manual script (not via astro-analytics component).
>
> **Compatibility**: `PUBLIC_CLARITY_PROJECT_ID` has higher priority; `PUBLIC_CLARITY_ID` is kept as a backward-compatible alias.


### SEO & Indexing

### SEO & Indexing

The theme includes integrated SEO plugins:

**Robots.txt** - Auto-generated via `astro-robots-txt`. No manual configuration needed; uses your `site.url` from config.

**IndexNow** - Instant search engine indexing. **Disabled by default**. Enable in `src/constants.ts`:

```typescript
seo: {
  indexNow: true,              // Enable IndexNow integration (default: false)
  indexNowKey: "your-api-key" // Or set PUBLIC_INDEXNOW_KEY env var
}

```

The key file is served at `/{key}.txt` for search engine verification. To get a key, visit [indexnow.org](https://www.indexnow.org).
You can also use env overrides: `PUBLIC_INDEXNOW_ENABLE=true` and `PUBLIC_INDEXNOW_KEY=...`.


> **Note**: IndexNow sends requests to search engines on every build. Keep it disabled if you don't need instant indexing.

**Sitemap** - Auto-generated by `@astrojs/sitemap`. Includes LLMs files when `llms.sitemap: true`.

## Integrated Astro Plugins

| Plugin | Purpose |
|--------|---------|
| `astro-robots-txt` | Auto-generates `robots.txt` with sitemap reference |
| `astro-indexnow` | Submits URLs to search engines for instant indexing |
| `astro-pagefind` | Build-time full-text search indexing |
| `astro-llms-generate` | Generates `llms.txt` for AI/LLM consumption |
| `astro-analytics` | Multi-service analytics (GA, Umami, Plausible, Clarity, etc.) |
| `@astrojs/sitemap` | XML sitemap generation |
| `@astrojs/partytown` | Offloads third-party scripts to Web Worker |
| `astro-mail-obfuscation` | Obfuscates mailto links to prevent email harvesting |
| `astro-embed` | Rich embeds for YouTube, Twitter/X, etc. |

### Partytown

Relocates third-party scripts (analytics, ads) to a Web Worker, keeping the main thread responsive. No configuration needed—just add scripts to your `<head>` as usual.

### Mail Obfuscation

Automatically encodes `mailto:` links to prevent email harvesters. Usage:

```markdown
For inquiries, email [contact@example.com](mailto:contact@example.com).
```

The plugin encodes the address at build time, decoding it only when users click.

### Video Embeds

Use `astro-embed` for rich embeds or custom components for full-width responsive videos:

```mdx
import YouTube from "../../components/embed/YouTube.astro";
import Bilibili from "../../components/embed/Bilibili.astro";

<YouTube id="VIDEO_ID" />
<Bilibili bvid="BV1234567890" />
```

Both components use `w-full aspect-video` for responsive 16:9 display.

| Category | Technology |
|----------|------------|
| Framework | Astro 6.0 |
| UI | Svelte 5 |
| Styling | TailwindCSS 4 |
| Search | Pagefind by default, optional Algolia DocSearch |
| Code Highlight | Expressive Code |
| Math | KaTeX |
| Diagrams | Mermaid |
| OG Images | Per-post `frontmatter.og` + global `og.defaultImage` fallback |
| SEO | astro-robots-txt, astro-indexnow |

| Transitions | View Transitions API / Swup |
| Scrollbars | OverlayScrollbars |

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build + generate search index |
| `pnpm preview` | Preview build locally |
| `pnpm check` | Astro diagnostics |
| `pnpm type-check` | TypeScript check |
| `pnpm new-post` | Create new post from template |

## Directory Structure

```
KIRARI/
├── kirari.config.toml    # Optional readable TOML config
├── src/

│   ├── components/       # UI components
│   ├── content/posts/    # Blog posts (Markdown)
│   ├── content/spec/     # Static pages content
│   ├── i18n/             # Translations (10 languages)
│   ├── layouts/          # Page layouts
│   ├── pages/            # Routes
│   │   └── rss.xml.ts           # RSS feed
│   ├── plugins/          # Custom rehype/remark plugins
│   ├── styles/           # CSS/Stylus
│   ├── utils/            # Helper functions (including env utilities)
│   ├── constants.ts      # Main configuration
│   └── config.ts         # Exported config modules

├── public/               # Static assets
├── scripts/              # Build scripts
└── _data/                # Data files (friends.json)
```

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release history.

## Credits

This project pays tribute to:

- [saicaca/fuwari](https://github.com/saicaca/fuwari) - Original theme
- [JoeyC-Dev/saicaca-fuwari](https://github.com/JoeyC-Dev/saicaca-fuwari) - Enhanced fork
- [ColdranAI/astro-llms-generate](https://github.com/ColdranAI/astro-llms-generate) - LLM docs generator

## License

MIT
