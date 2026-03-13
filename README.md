# KIRARI

[![Build Status](https://github.com/markd3ng/KIRARI/actions/workflows/ci-main.yml/badge.svg)](https://github.com/markd3ng/KIRARI/actions/workflows/ci-main.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A modern static blog built with **Astro 6** + **Svelte 5** + **TailwindCSS 4**.

## Features

- **Dynamic OG Images** - Auto-generated OG images for each post with title, date, and tags
- **Full-text Search** - Powered by Pagefind
- **Mermaid Diagrams** - Flowcharts, sequence diagrams, and more
- **Math Equations** - KaTeX for LaTeX rendering
- **Multi-language** - 10 languages supported (en, zh_CN, zh_TW, ja, ko, es, th, vi, tr, id)
- **LLM-Ready** - Auto-generates `llms.txt` for AI indexing
- **Dark Mode** - System preference + manual toggle
- **Smooth Transitions** - View Transitions API with Swup fallback

## Quick Start

```bash
# Clone
git clone https://github.com/markd3ng/KIRARI.git
cd KIRARI

# Install
pnpm install

# Develop
pnpm dev

# Build
pnpm build
```

## Writing Posts

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

## Configuration

All settings in **`src/constants.ts`** (single source of truth):

```typescript
export const Config = {
  site: {
    url: "https://your-domain.com",
    title: "Your Site",
    subtitle: "Your Tagline",
    lang: "en",
    themeColor: { hue: 250, fixed: false },
    og: {
      defaultImage: "/og/default.png",
      width: 1200,
      height: 630,
      brand: "KIRARI",
      backgroundColor: "#1a1a2e",
      textColor: "#ffffff",
    },
  },
  profile: {
    avatar: "/avatar.png",
    name: "Your Name",
    bio: "Your bio",
  },
  // ... more options
}
```

## Key Features

### OG Images

- Posts: Auto-generated via `/og/[slug].png` using Satori
- Other pages: Uses `/og/default.png`

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
    google: "your-code",
    bing: "your-code",
  },
  customHtml: "<!-- external CSS/JS -->",
  customScript: "// inline JS",
},
footer: {
  customHtml: "<a href='https://beian.miit.gov.cn'>ICP备案</a>",
},
```

### LLMs Documentation

Build generates:
- `llms.txt` - Main index
- `llms-full.txt` - Complete content
- `llms-en.txt`, `llms-zh.txt` - Language-specific

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
| OG Images | Satori + Sharp |
| Transitions | View Transitions / Swup |

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server |
| `pnpm build` | Build + generate search index |
| `pnpm preview` | Preview build locally |
| `pnpm check` | Astro diagnostics |
| `pnpm type-check` | TypeScript check |
| `pnpm new-post` | Create new post from template |

## Directory Structure

```
src/
├── components/       # UI components
├── content/posts/    # Blog posts (Markdown)
├── content/spec/     # Static pages content
├── i18n/            # Translations (10 languages)
├── layouts/         # Page layouts
├── pages/           # Routes
│   ├── og/[...slug].png.ts  # Dynamic OG images
│   ├── rss.xml.ts           # RSS feed
│   └── robots.txt.ts        # Robots.txt
├── plugins/         # Custom rehype/remark plugins
├── styles/          # CSS/Stylus
├── utils/           # Helper functions
├── constants.ts     # Main configuration
└── config.ts        # Type exports (do not edit)
```

## Changelog

### [2026-03-12]

**Added**
- Dynamic OG image generation via `/og/[slug].png` endpoint
- `site.og` configuration for OG image customization

**Changed**
- Refactored Layout to separate banner and OG image responsibilities

**Removed**
- Biome (linter/formatter) - not needed in CI/CD workflow

### [2026-02-18]

**Added**
- Mermaid diagram support with client-side rendering
- `head` config for site verification and custom injections
- `footer` config for custom HTML/JS
- Tag/category mapping configuration

**Fixed**
- Tag/category display localization
- GitHub Actions workflow pnpm version conflicts

### [2026-02-13]

**Added**
- `astro-llms-generate` plugin for LLM-friendly documentation

## Credits

This project pays tribute to:

- [saicaca/fuwari](https://github.com/saicaca/fuwari) - Original theme
- [JoeyC-Dev/saicaca-fuwari](https://github.com/JoeyC-Dev/saicaca-fuwari) - Enhanced fork
- [ColdranAI/astro-llms-generate](https://github.com/ColdranAI/astro-llms-generate) - LLM docs generator

## License

MIT
