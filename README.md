[中文文档](./README_CN.md)

<div align="center">

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/markd3ng/KIRARI)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/markd3ng/KIRARI)
[![Deploy to Cloudflare Pages](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/markd3ng/KIRARI)
[![Deploy to EdgeOne Pages](https://cdnstatic.tencentcs.com/edgeone/pages/deploy/zh-CN.svg)](https://edgeone.ai/pages/new?repository=https://github.com/markd3ng/KIRARI)

</div>

# KIRARI

A modern, high-performance static blog theme built with **Astro 6** + **Svelte 5** + **TailwindCSS 4**. Features dynamic OG image generation, full-text search, smooth page transitions, and LLM-ready documentation support.

## Features

- **Dynamic OG Images** - Optional external OG API generation for each post, with automatic local Satori + Sharp fallback

- **Full-text Search** - Powered by Pagefind, with debounce and concurrent request handling
- **Mermaid Diagrams** - Flowcharts, sequence diagrams, and more with client-side rendering
- **Math Equations** - KaTeX for LaTeX rendering
- **Multi-language** - 10 languages supported (en, zh_CN, zh_TW, ja, ko, es, th, vi, tr, id)
- **LLM-Ready** - Auto-generates `llms.txt` for AI indexing
- **Dark Mode** - System preference detection + manual toggle
- **Smooth Transitions** - View Transitions API with Swup fallback for older browsers
- **Security Hardened** - All external links include `rel="noopener noreferrer"`

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

All settings are centralized in **`src/constants.ts`**:

```typescript
export const Config = {
  site: {
    url: "https://your-domain.com",
    title: "Your Site",
    subtitle: "Your Tagline",
    lang: "en",
    themeColor: { hue: 250, fixed: false },
    banner: {
      enable: true,
      src: "assets/images/banner.png",
      position: "center", // 'top' | 'center' | 'bottom'
      credit: { enable: false, text: "", url: "" }
    },
    toc: { enable: true, depth: 3 },
  },
  profile: {
    avatar: "assets/images/avatar.png",
    name: "Your Name",
    bio: "Your bio",
    links: [
      { name: "GitHub", icon: "fa6-brands:github", url: "https://github.com/you" }
    ]
  },
  license: {
    enable: true,
    name: "CC BY-NC-SA 4.0",
    url: "https://creativecommons.org/licenses/by-nc-sa/4.0/"
  },
  head: {
    verification: { google: "", bing: "", yandex: "", naver: "" },
    customHtml: "",
    customScript: ""
  },
  footer: {
    customHtml: "",
    customScript: ""
  },
  og: {
    defaultImage: "/og/default.png",
    width: 1200,
    height: 630,
    brand: "KIRARI",
    backgroundColor: "#1a1a2e",
    textColor: "#ffffff",
    api: {
      enabled: false,
      endpoint: "https://og.saru.im/api/v1/images",
      templateName: "blog:magazine",
      timeoutMs: 30000,
      retry: 3,
      fallbackToLocal: true,
      brand: "KIRARI",
      defaultFeaturedImage: ""
    }
  },

  llms: {
    enable: true,
    sitemap: true,
    title: "Your Site",
    description: "Your site description",
    i18n: true
  }
}
```

OG API notes:
- Keep `enabled: false` to preserve local-only generation.
- When `enabled: true`, set `endpoint` and `templateName` to your external OG service/template.
- `timeoutMs` + `retry` control request resilience; `fallbackToLocal` controls build safety on API failure.

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

- **Posts**: Served via `/og/[slug].png` (URL remains unchanged)
- **Generation mode**:
  - `og.api.enabled = false` (default): generate locally with Satori + Sharp
  - `og.api.enabled = true`: call external OG API first (`og.api.endpoint` + `og.api.templateName`)
- **Failure strategy**:
  - `og.api.fallbackToLocal = true` (default): API failure falls back to local generation
  - `og.api.fallbackToLocal = false`: API failure returns `502`
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
  customHtml: "<!-- external CSS/JS -->",
  customScript: "// inline JS"
},
footer: {
  customHtml: "<a href='https://beian.miit.gov.cn'>ICP备案</a>"
}
```

### LLMs Documentation

Build generates:
- `llms.txt` - Main index
- `llms-full.txt` - Complete content
- `llms-en.txt`, `llms-zh.txt` - Language-specific files

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Astro 6.0 |
| UI | Svelte 5 |
| Styling | TailwindCSS 4 |
| Search | Pagefind |
| Code Highlight | Expressive Code |
| Math | KaTeX |
| Diagrams | Mermaid |
| OG Images | External OG API (optional) + Satori + Sharp (local fallback) |

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
├── src/
│   ├── components/       # UI components
│   ├── content/posts/    # Blog posts (Markdown)
│   ├── content/spec/     # Static pages content
│   ├── i18n/             # Translations (10 languages)
│   ├── layouts/          # Page layouts
│   ├── pages/            # Routes
│   │   ├── og/[...slug].png.ts  # Dynamic OG images
│   │   ├── rss.xml.ts           # RSS feed
│   │   └── robots.txt.ts        # Robots.txt
│   ├── plugins/          # Custom rehype/remark plugins
│   ├── styles/           # CSS/Stylus
│   ├── utils/            # Helper functions
│   ├── constants.ts      # Main configuration
│   └── config.ts         # Type exports (do not edit)
├── public/               # Static assets
├── scripts/              # Build scripts
└── _data/                # Data files (friends.json)
```

## Credits

This project pays tribute to:

- [saicaca/fuwari](https://github.com/saicaca/fuwari) - Original theme
- [JoeyC-Dev/saicaca-fuwari](https://github.com/JoeyC-Dev/saicaca-fuwari) - Enhanced fork
- [ColdranAI/astro-llms-generate](https://github.com/ColdranAI/astro-llms-generate) - LLM docs generator

## License

MIT
