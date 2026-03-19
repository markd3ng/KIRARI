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
    defaultImage: "/og/default.png"
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

OG notes:
- Post OG image is selected directly by metadata, without dynamic generation routes.
- Priority: `frontmatter.og` > `og.defaultImage`.
- If `frontmatter.og` is empty, `og.defaultImage` (e.g. `/og/default.png`) is used as fallback.

### Environment Variables

You can override configuration values via environment variables instead of modifying `src/constants.ts`. This is useful for:
- Different configurations per environment (dev/staging/production)
- CI/CD deployments without code changes
- Keeping test/local configs separate from production

**Create `.env.local` in the project root:**

```bash
# Site Configuration
PUBLIC_SITE_URL=https://your-domain.com
PUBLIC_SITE_TITLE=Your Site
PUBLIC_SITE_SUBTITLE=Your Tagline

# Banner Credit
PUBLIC_BANNER_CREDIT_ENABLE=false
PUBLIC_BANNER_CREDIT_TEXT=
PUBLIC_BANNER_CREDIT_URL=

# Microsoft Clarity Analytics (optional)
PUBLIC_CLARITY_PROJECT_ID=
```

**Usage by environment:**

| Environment | How to configure |
|-------------|------------------|
| Local development | Create `.env.local` (gitignored) |
| Vercel/Netlify/etc. | Set env vars in dashboard |
| Default fallback | Values in `src/constants.ts` |

> **Note**: `.env.local` is already in `.gitignore`, so your local overrides won't be committed.


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

> **Note**: When adding HTML/JS snippets (e.g., analytics scripts like Google Analytics, Umami, Clarity), use **template literals (backticks)** instead of regular quotes. HTML attributes use double quotes internally, which would conflict with string delimiters.
>
> ```typescript
> // ✅ Correct - use backticks for multi-line HTML/JS
> customScript: `<script type="text/javascript">
>   (function(c,l,a,r,i,t,y){
>     c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
>     t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
>     y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
>   })(window, document, "clarity", "script", "YOUR_PROJECT_ID");
> </script>`
>
> // ❌ Wrong - double quotes conflict with HTML attributes
> customScript: "<script type="text/javascript">...</script>"
> ```

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
| OG Images | Per-post `frontmatter.og` + global `og.defaultImage` fallback |

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

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release history.

## Credits

This project pays tribute to:

- [saicaca/fuwari](https://github.com/saicaca/fuwari) - Original theme
- [JoeyC-Dev/saicaca-fuwari](https://github.com/JoeyC-Dev/saicaca-fuwari) - Enhanced fork
- [ColdranAI/astro-llms-generate](https://github.com/ColdranAI/astro-llms-generate) - LLM docs generator

## License

MIT
