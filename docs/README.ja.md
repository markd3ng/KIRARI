# Fuwari

[![Build Status](https://github.com/k3nxu/fuwari-kai/actions/workflows/build.yml/badge.svg)](https://github.com/k3nxu/fuwari-kai/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A static blog theme built with [Astro](https://astro.build/), [TailwindCSS](https://tailwindcss.com/) and [Svelte](https://svelte.dev/).

## 🚀 Getting Started

1.  **Clone the repository**
    ```bash
    git clone https://github.com/k3nxu/fuwari-kai.git
    cd fuwari-kai
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
title: My New Post
published: 2024-05-01
tags: [Demo]
category: Guide
---

Hello World!
```

### Configuration

Site configuration is managed in `src/config.ts`.

```typescript
// src/config.ts

const Config = {
  site: {
    title: "My Blog",
    lang: "en",
    banner: { enable: true, src: "assets/images/demo-banner.png" },
  },
  // ...
  mappings: {
    tags: { 'demo': '演示' },
    categories: { 'guide': '指南' }
  }
}
```

## 📂 Directory Structure

```
.
├── src/
│   ├── components/     # Astro components
│   ├── layouts/        # Page layouts
│   ├── pages/          # Routing logic
│   ├── content/        # Markdown posts
│   └── config.ts       # Site configuration
├── public/             # Static assets (favicons, etc.)
└── astro.config.mjs    # Astro configuration
```

## 📄 License

MIT

