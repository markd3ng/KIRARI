# Fuwari

[![Deploy with GitHub Actions](https://github.com/saicaca/fuwari/actions/workflows/deploy.yml/badge.svg)](https://github.com/saicaca/fuwari/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

基于 [Astro](https://astro.build/)、[TailwindCSS](https://tailwindcss.com/) 和 [Svelte](https://svelte.dev/) 构建的静态博客主题。

## 🚀 快速开始

1.  **克隆仓库**
    ```bash
    git clone https://github.com/k3nxu/fuwari-kai.git
    cd fuwari-kai
    ```

2.  **安装依赖**
    ```bash
    pnpm install
    ```

3.  **启动开发服务器**
    ```bash
    pnpm dev
    ```

4.  **构建生产版本**
    ```bash
    pnpm build
    ```

## 📝 使用方法

### 撰写文章

在 `src/content/posts/` 目录下创建 Markdown 文件：

```markdown
---
title: 我的新文章
published: 2024-05-01
tags: [Demo]
category: Guide
---

你好，世界！
```

### 站点配置

站点配置位于 `src/config.ts`。

```typescript
// src/config.ts

const Config = {
  site: {
    title: "我的博客",
    lang: "zh_CN",
    banner: { enable: true, src: "assets/images/demo-banner.png" },
  },
  // ...
  mappings: {
    tags: { 'demo': '演示' },
    categories: { 'guide': '指南' }
  }
}
```

## 📂 目录结构

```
.
├── src/
│   ├── components/     # Astro 组件
│   ├── layouts/        # 页面布局
│   ├── pages/          # 路由逻辑
│   ├── content/        # Markdown 文章内容
│   └── config.ts       # 站点配置
├── public/             # 静态资源 (favicon 等)
└── astro.config.mjs    # Astro 配置
```

## 📄 许可协议

MIT
