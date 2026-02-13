# KIRARI

[![Build Status](https://github.com/markd3ng/KIRARI/actions/workflows/ci-main.yml/badge.svg)](https://github.com/markd3ng/KIRARI/actions/workflows/ci-main.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A static blog theme built with [Astro](https://astro.build/), [TailwindCSS](https://tailwindcss.com/) and [Svelte](https://svelte.dev/).

## 📜 Changelog

### 2026-02-13
- Integrated [astro-llms-generate](https://github.com/ColdranAI/astro-llms-generate) plugin for LLM-friendly documentation.
- Enabled i18n support for LLM documentation generation.

## 🚀 Getting Started

1.  **Clone the repository**
    ```bash
    git clone https://github.com/markd3ng/KIRARI.git
    cd KIRARI
    ```

2.  **Install dependencies**
    ```bash
    pnpm install
    ```

3.  **Start development server**
    ```bash
    pnpm dev
    ```

4.  **Build for production**
    ```bash
    pnpm build
    ```

## 📝 Usage

### Writing Posts

Create a new Markdown file in `src/content/posts/`:

```markdown
---
title: Post Title        # [Required] The title of the post
published: 2024-05-01  # [Required] Published date (YYYY-MM-DD)
updated: 2024-05-02    # [Optional] Updated date (YYYY-MM-DD)
description: Post desc   # [Optional] Short description for SEO and list pages
image: /path/image.png # [Optional] Cover image and OG image
tags: [Tag1, Tag2]     # [Optional] List of tags
category: Category     # [Optional] Post category
draft: false           # [Optional] Whether it's a draft, set to true to hide in production
lang: en               # [Optional] Post language (e.g. en, zh_CN, ja)
---

Hello World!
```

> [!TIP]
> Setting the `updated` date will automatically display a **"Last Updated at"** field in the license section at the bottom of the post.


### Friends Page

You can manage your friends page in two parts:

1.  **Friend List**: Edit `src/_data/friends.json` to add or remove sites.
    ```json
    [
      {
        "siteTitle": "Site Name",
        "siteDesc": "Site Description",
        "siteUrl": "https://example.com",
        "siteIcon": "https://example.com/avatar.png"
      }
    ]
    ```
2.  **Introduction Text**: Edit `src/content/spec/friends.md` to change the description text displayed at the top of the friends page.

### Site Configuration

Site configuration is managed in **`src/constants.ts`**. This file is the **single source of truth** for all site settings, including URL, title, navigation, and plugin options.

```typescript
// src/constants.ts

export const Config = {
  site: {
    url: "https://markd3ng.github.io", // Your site's URL
    base: "/",                         // Base path (e.g. /blog/)
    title: "KIRARI",                   // Site title
    subtitle: "Demo Site",             // Site subtitle
    lang: "en",
    // ...
  },
  navBar: {
    // ...
  },
  // ...
}
```

## 🤖 LLMs Documentation Generator

This project integrates `astro-llms-generate` to automatically create documentation files optimized for LLMs (Large Language Models).

### Plugin Configuration

Configuration is managed in `src/constants.ts` under the `llms` object:

```typescript
// src/constants.ts
export const Config = {
  // ...
  llms: {
    enable: true,
    sitemap: true,      // Add generated files to sitemap
    title: "KIRARI",
    description: "Documentation for KIRARI",
    i18n: true,         // Enable multilingual support (creates llms-en.txt, llms-zh.txt etc.)
  },
  // ...
}
```

### Usage

Upon building the project (`pnpm build`), the following files will be generated in the `dist/` directory:

- `llms.txt`: The main documentation index.
- `llms-small.txt`: A concise version containing only structure.
- `llms-full.txt`: The complete documentation content.

**For i18n support:**
You can specify the language of a page or post in its frontmatter:

```yaml
---
title: My Post
lang: en
---
```

The plugin will detect this and generate language-specific files automatically:
- `llms-en.txt` / `llms-small-en.txt` / `llms-full-en.txt`
- `llms-zh.txt` / `llms-small-zh.txt` / `llms-full-zh.txt`

## 📂 Directory Structure

```
.
├── src/
│   ├── components/     # Astro components
│   ├── layouts/        # Page layouts
│   ├── pages/          # Routing logic
│   ├── content/        # Markdown posts
│   ├── constants.ts    # [NEW] Single source of truth for configuration
│   └── config.ts       # Type definitions and exports (do not edit)
├── public/             # Static assets (favicons, etc.)
└── astro.config.mjs    # Astro configuration (uses src/constants.ts)
```

## 📚 Credits 

This project pays tribute to the following projects:

- [saicaca/fuwari](https://github.com/saicaca/fuwari)
- [JoeyC-Dev/saicaca-fuwari](https://github.com/JoeyC-Dev/saicaca-fuwari)
- [ColdranAI/astro-llms-generate](https://github.com/ColdranAI/astro-llms-generate)

## 📄 License

MIT
