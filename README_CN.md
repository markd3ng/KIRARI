[English](./README.md)

<div align="center">

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/markd3ng/KIRARI)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/markd3ng/KIRARI)
[![Deploy to Cloudflare Pages](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/markd3ng/KIRARI)
[![Deploy with EdgeOne Pages](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?repository=https://github.com/markd3ng/KIRARI)

</div>

# KIRARI

静态博客主题。Astro 6 + Svelte 5 + Tailwind CSS v4。通过 `kirari.config.toml` 配置。支持 Cloudflare Pages、Vercel、Netlify、EdgeOne Pages 部署。

## 技术栈

| 类别 | 依赖 | 版本 |
|------|------|------|
| 框架 | astro | `6.0.8` |
| UI Islands | svelte | `^5.55.5` |
| CSS | tailwindcss, stylus | `^4.2.4`, `^0.64.0` |
| 搜索 | pagefind（默认）, @docsearch/js（Algolia） | `^1.5.2`, `^4.6.3` |
| 代码高亮 | astro-expressive-code | `^0.41.7` |
| 数学公式 | rehype-katex, remark-math, katex | `^0.16.45` |
| 图表 | mermaid | `^11.14.0` |
| 图标 | astro-icon, @iconify/svelte | — |
| 字体 | @fontsource/roboto, @fontsource-variable/jetbrains-mono | — |
| 页面过渡 | View Transitions API \| swup 降级 | `^4.9.0` |
| 图片灯箱 | photoswipe | `^5.4.4` |
| 图片处理 | sharp | `^0.34.5` |
| 滚动条 | overlayscrollbars | `^2.15.1` |
| 内容 | @astrojs/mdx, remark/rehype 插件链 | `^5.0.4` |
| 订阅 | @astrojs/rss, @astrojs/sitemap | — |

## 快速开始

```bash
git clone https://github.com/markd3ng/KIRARI.git
cd KIRARI
pnpm install          # 仅 pnpm；preinstall 钩子阻止 npm/yarn
pnpm dev
pnpm build
```

> pnpm ≥ 9.14.4。`package.json` 中 `packageManager` 字段强制。

## Fork 后最小修改清单

Fork 后替换以下文件。不要修改 `src/components/`、`src/layouts/`、`src/styles/`、`src/utils/`。

| 路径 | 操作 | 必改 |
|------|------|------|
| `kirari.config.toml` | 设置 `site.url`、`site.title`、`profile.*`、`navBar.*`、`landingPage.*` | 是 |
| `src/content/posts/` | 删除示例文章，添加自己的 `.md`/`.mdx` | 是 |
| `src/content/spec/about.md` | 替换关于页内容 | 推荐 |
| `src/assets/images/` | 替换头像、横幅、Landing Hero 图 | 推荐 |
| `public/favicon/` | 替换 favicon | 推荐 |
| `public/og/default.png` | 替换默认 OG 图片 | 推荐 |
| `src/content/spec/friends.md` | 替换或移除 Friends 导航 | 可选 |
| `src/_data/friends.json` | 替换友链数据 | 可选 |

Fork 后验证：

```bash
pnpm type-check && pnpm astro check && pnpm build
```

## 配置

统一入口：**`kirari.config.toml`**。无需编辑 `src/constants.ts`。

优先级：环境变量 → `kirari.config.toml` → `config-loader.ts` 默认值。

```toml
[site]
url = "https://example.com"
title = "站点标题"
lang = "zh-CN"

[i18n]
enable = true
default-language = "en-US"

[profile]
avatar = "assets/images/avatar.png"
name = "作者名"
bio = "个人简介"

[[profile.links]]
name = "GitHub"
icon = "fa6-brands:github"
url = "https://github.com/you"

[[navBar.links]]
preset = "Home"

[og]
defaultImage = "/og/default.png"
```

`kirari.config.toml` 中每个键都带有中英双语注释，直接阅读即可获得完整参考。

### 环境变量

敏感信息（API 密钥）请用环境变量。`.env.local` 已 gitignore。所有 `PUBLIC_*` 变量覆盖对应 TOML 键。

| 环境变量 | 覆盖 |
|---------|------|
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

## 内容创作

### Frontmatter

```yaml
---
title: 文章标题
published: 2024-05-01
updated: 2024-05-02            # 可选
description: 简短摘要
image: /cover.png              # 横幅图，相对于 /public
og: /og/custom.png             # 单篇 OG 覆盖
slug: custom-url               # 覆盖自动生成的 slug
tags: [标签1, 标签2]
tagLabels:                     # UI 显示名（URL 用 slug）
  标签1: "标签一"
category: 教程
categoryLabel: "教程系列"
draft: false                   # 生产环境隐藏
lang: zh-CN                    # BCP 47，i18n 必须
mermaid: true                  # 注入 Mermaid 运行时
---
```

### URL 生成

`slug` → `posts.slugStrategy`：

| 策略 | 结果 |
|------|------|
| `file`（默认） | 路径派生：`posts/hello/world.md` → `/posts/hello/world/` |
| `crc32` | content entry ID 的 8 位十六进制 → `/posts/a1b2c3d4/` |

强制 trailing slash。不支持 `.html` 伪静态 URL。

### 标签与分类

Slug = URL 标识符（`/tags/标签1/`）。`tagLabels`/`categoryLabel` = 显示名。构建时警告冲突：

```
[DisplayName Conflict] tag "demo": existing="演示" vs new="Demo示例" (source: posts/another-post.md)
```

后写入覆盖先写入。

### Mermaid

```markdown
---
mermaid: true
---
```

仅客户端渲染。只在设置了 `mermaid` 标记的页面加载。

### KaTeX

行内和块级公式。无需 frontmatter 标记 — `remark-math` + `rehype-katex` 始终启用。

### GitHub 卡片与 Admonitions

```
::github{repo="owner/repo"}
::githubfile{repo="owner/repo" path="src/main.ts"}

:::note
内容
:::
```

Admonition 类型：`note`、`tip`、`important`、`caution`、`warning`。支持 GitHub `[!NOTE]` 语法（`remark-github-admonitions-to-directives` 转换）。

默认 API：`https://api.github.com`。通过 `/ghc` 代理需设置 `githubCard.adapter.enabled = true`。

### 视频嵌入

仅 MDX。使用 `YouTube` 和 `Bilibili` 组件：

```mdx
import YouTube from "../../components/embed/YouTube.astro";
<YouTube id="VIDEO_ID" />
```

均渲染为 `w-full aspect-video`。

### 图片灯箱

Photoswipe 自动绑定 `.post-cover` 图片。点击任意内容图片打开全屏查看器。

### 阅读时间

通过 `remark-reading-time` 自动计算每篇文章的阅读时间，显示在文章元数据行。

### 邮箱混淆

`mailto:` 链接在构建时由 `postbuild.mjs` 自动编码。

### 自定义 Head / Footer

```toml
[head]
customHtml = '<link rel="stylesheet" href="/custom.css">'
customScript = '(function(){ /* 无需 <script> 标签 */ })()'

[footer]
customHtml = '<a href="https://beian.miit.gov.cn/">京ICP备xxxxxxxx号</a>'
```

## 国际化

BCP 47 路由。默认语言在 `/`，其他语言使用前缀：

| 语言 | URL |
|------|-----|
| `en-US`（默认） | `/posts/hello/`、`/archive/` |
| `zh-CN` | `/zh-CN/posts/hello/` |

- `translationKey`：跨语言关联文章。省略时从文件名和内容目录结构推断。
- 缺失翻译：回退到目标语言首页。
- 说明页：本地化内容在 `src/content/spec/<lang>/`，默认回退。
- `default-language-in-subdir: true` 将默认语言放到 `/en-US/` 下（兼容 Hugo）。
- `languages = ["en-US", "zh-CN"]` 旧版数组写法仍然支持。

## 搜索

**Pagefind**（默认）：postbuild 阶段生成。语言过滤 — 不会出现跨语言结果。

**Algolia DocSearch**：在配置中启用：

```toml
[search.docsearch]
enable = true
appId = "..."
apiKey = "..."
indexName = "..."
```

凭证有效时，Pagefind 在构建和运行时均被禁用。页面输出 `docsearch:language` meta 标签。

## 统计分析

| 服务 | TOML 键 | 环境变量 |
|------|---------|---------|
| 总开关 | `analytics.enable` | `PUBLIC_ANALYTICS_ENABLE` |
| Google Analytics | `analytics.googleAnalyticsId` | `PUBLIC_GOOGLE_ANALYTICS_ID` |
| Umami | `analytics.umami.id` | `PUBLIC_UMAMI_ID` |
| Plausible | `analytics.plausible.domain` | `PUBLIC_PLAUSIBLE_DOMAIN` |
| Microsoft Clarity | `analytics.clarityProjectId` | `PUBLIC_CLARITY_PROJECT_ID` |
| Fathom | `analytics.fathomSiteId` | `PUBLIC_FATHOM_SITE_ID` |
| Simple Analytics | `analytics.simpleAnalyticsDomain` | `PUBLIC_SIMPLE_ANALYTICS_DOMAIN` |
| Matomo | `analytics.matomo.siteId` | `PUBLIC_MATOMO_SITE_ID` |
| Amplitude | `analytics.amplitudeApiKey` | `PUBLIC_AMPLITUDE_API_KEY` |

仅在 `analytics.enable && import.meta.env.PROD` 时加载。Umami/Plausible/Matomo 支持可选 `integrity`（SRI），适用于固定版本脚本。

## LLM 文档

Postbuild 生成 `llms.txt`、`llms-full.txt`、`llms-small.txt`。`llms.i18n = true` 增加按语言分类的文件。

```toml
[llms]
enable = true
sitemap = true
title = "站点名称"
description = "供 AI 索引的站点描述"
i18n = true
```

## SEO

| 功能 | 机制 |
|------|------|
| Sitemap | `@astrojs/sitemap`（自动） |
| Robots.txt | Postbuild（自动，使用 `site.url`） |
| IndexNow | Postbuild（`seo.indexNow = true`） |
| 搜索验证 | `head.verification.google/.bing/.yandex/.naver` |
| Canonical + hreflang | 每页自动生成 |

IndexNow 默认关闭。开启后每次构建提交 URL。

## 架构

### Islands

| 组件 | 框架 | Hydration |
|------|------|-----------|
| 搜索 | Svelte | `client:load` |
| 主题切换 | Svelte | `client:load` |
| 主题色选择器 | Svelte | `client:only` |
| 文章卡片、导航、布局 | Astro | 无 |

`client:only` 仅用于依赖 `localStorage` 的面板，不包含 SEO 内容。

### 页面过渡

双路径，通过 `TransitionManager` 统一调度：

| 浏览器 | 机制 | 成本 |
|--------|------|------|
| 支持 View Transitions API | Astro `ClientRouter` | 零额外体积 |
| 不支持 | Swup + Preload 插件 | 动态 `import()` |

无论底层实现如何，使用统一事件 API：

```ts
import { transitionManager } from "@utils/transition-manager";

transitionManager.on("transition:after-swap", () => {
  // 重新初始化 DOM 依赖代码
});
```

注意：`DOMContentLoaded` 仅在硬加载时触发。导航后初始化必须使用 `transition:after-swap`。

页面切换时，从 `localStorage` + 配置默认值恢复 `<html>` 状态（主题模式、色相、代码主题）— 而非复用旧 DOM。

### 性能

| 技术 | 细节 |
|------|------|
| 字体自托管 | Roboto，仅 Latin 400/500/700 字重 |
| 响应式图片 | sharp 生成多宽度 srcset |
| 图标 Tree-Shaking | Vite 插件拦截 @iconify-json JSON 导入；仅注册的图标被打包 |
| 预取 | `prefetchAll: false`；导航 hover，移动 tap |
| 不可变缓存 | `/_astro/*` → 一年不可变（文件名含内容哈希） |
| HTML 缓存 | 可 revalidation（文件名无哈希） |
| 压缩 | esbuild，`cssCodeSplit: true`，target `esnext` |
| 分块阈值 | 700 KB |

### 各平台缓存

| 平台 | 配置 | 规则 |
|------|------|------|
| Cloudflare Pages | `dist/_headers`（postbuild） | `/_astro/*` immutable |
| Netlify | `dist/_headers`（postbuild） | `/_astro/*` immutable |
| Vercel | `vercel.json` | `/_astro/*` immutable |
| EdgeOne Pages | `edgeone.json` | `/_astro/*` immutable |

## 构建管线

```
materialize-ghc-adapter.mjs → astro build → postbuild.mjs
```

| 阶段 | 输出 |
|------|------|
| materialize | `functions/ghc/` 或 `api/ghc/`（仅适配器启用时） |
| astro build | `dist/`（SSG） |
| postbuild | `_headers`、`_redirects`、`robots.txt`、Pagefind、`llms.txt`、IndexNow |

## 脚本命令

| 命令 | 执行 |
|------|------|
| `pnpm dev` | `astro dev` |
| `pnpm build` | materialize → build → postbuild |
| `pnpm preview` | `astro preview` |
| `pnpm check` | `astro check` |
| `pnpm type-check` | `tsc --noEmit` |
| `pnpm new-post` | 交互式创建文章 |

## 目录结构

```
KIRARI/
├── kirari.config.toml          # 站点配置（TOML）
├── astro.config.mjs            # Astro + 集成 + Vite
├── src/
│   ├── constants.ts            # 封装 config-loader → Config
│   ├── config.ts               # 按模块拆分导出（向后兼容）
│   ├── types/config.ts         # TypeScript 类型定义
│   ├── components/             # .astro、.svelte
│   ├── content/
│   │   ├── posts/              # Markdown/MDX 博客文章
│   │   └── spec/               # 静态页面（about、friends）
│   ├── _data/                  # JSON（friends.json）
│   ├── i18n/                   # 11 种语言翻译字典
│   ├── layouts/                # Layout.astro、MainGridLayout.astro
│   ├── pages/                  # 基于文件的路由
│   ├── plugins/                # remark、rehype、expressive-code
│   ├── styles/                 # Stylus（markdown-extend.styl）
│   └── utils/                  # config-loader、transition-manager、env
├── scripts/                    # 构建管线
├── adapters/                   # ghc-card 模板
├── public/                     # 静态资源
└── dist/                       # 构建输出（gitignored）
```

## 发版验证

```bash
pnpm install --frozen-lockfile && pnpm type-check && pnpm astro check && pnpm build
```

`@astrojs/check` 仅开发依赖。CI 必须使用 `--frozen-lockfile`。

## 更新日志

[CHANGELOG.md](./CHANGELOG.md)

## 许可证

MIT
