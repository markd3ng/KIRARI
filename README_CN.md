[English](./README.md)

<div align="center">

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/markd3ng/KIRARI)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/markd3ng/KIRARI)
[![Deploy to Cloudflare Pages](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/markd3ng/KIRARI)
[![Deploy with EdgeOne Pages](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?repository=https://github.com/markd3ng/KIRARI)

</div>

# KIRARI

静态博客主题。**Astro 6** + **Svelte 5** + **Tailwind CSS v4**。通过 `kirari.config.toml` 配置。支持 Cloudflare Pages、Vercel、Netlify、EdgeOne Pages 部署。

## 技术栈

| 类别 | 依赖 | 版本 |
|------|------|------|
| 框架 | astro | `^6.0.8` |
| UI Islands | svelte | `^5.55.5` |
| CSS | tailwindcss, stylus | `^4.2.4`, `^0.64.0` |
| 搜索（默认） | pagefind | `^1.5.2` |
| 搜索（可选） | @docsearch/js (Algolia) | `^4.6.3` |
| 代码高亮 | astro-expressive-code | `^0.41.7` |
| 数学公式 | rehype-katex, remark-math, katex | — |
| 图表 | mermaid | `^11.14.0` |
| 图标 | astro-icon, @iconify/svelte | — |
| 字体 | @fontsource/roboto, @fontsource-variable/jetbrains-mono | — |
| 页面过渡 | View Transitions API（原生）\| swup（降级） | `^4.9.0` |
| 图片 | sharp, photoswipe | — |
| 内容 | @astrojs/mdx, remark/rehype 插件链 | — |
| 订阅 | @astrojs/rss, @astrojs/sitemap | — |

## 快速开始

```bash
git clone https://github.com/markd3ng/KIRARI.git
cd KIRARI
pnpm install          # 仅支持 pnpm；preinstall 钩子会阻止 npm/yarn
pnpm dev              # astro dev
pnpm build            # astro build + postbuild 管线
pnpm preview          # astro preview
```

> **pnpm ≥ 9.14.4 必装。** `preinstall` 钩子阻止 npm/yarn。`package.json` 中 `packageManager` 字段强制。

## Fork 后最小修改清单

KIRARI 仓库本身是可直接运行的示例站点。Fork 后只需替换配置和内容。

| 路径 | 操作 | 必改 |
|------|------|------|
| `kirari.config.toml` | 设置 `site.url`、`site.title`、`profile.*`、`navBar.*`、`landingPage.*` | 是 |
| `src/content/posts/` | 删除示例文章，添加自己的 `.md`/`.mdx` | 是 |
| `src/content/spec/about.md` | 替换关于页内容 | 推荐 |
| `src/content/spec/friends.md` | 替换友链说明，或在配置中移除 Friends 导航 | 可选 |
| `src/_data/friends.json` | 替换友链数据 | 可选 |
| `src/assets/images/` | 替换头像、横幅、Landing Hero 图 | 推荐 |
| `public/favicon/` | 替换 favicon 文件 | 推荐 |
| `public/og/default.png` | 替换默认 OG 图片 | 推荐 |

Fork 后验证：

```bash
pnpm type-check && pnpm astro check && pnpm build
```

普通博客 fork 不需要修改 `src/components/`、`src/layouts/`、`src/styles/` 或 `src/utils/`。

## 配置

统一入口：**项目根目录的 `kirari.config.toml`**。无需编辑 `src/constants.ts`。

**优先级链：** 环境变量 → `kirari.config.toml` → `src/utils/config-loader.ts` 默认值

```toml
[site]
url = "https://example.com"
title = "站点标题"
lang = "zh-CN"
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
name = "作者名"
bio = "个人简介"

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

完整配置参考：直接阅读仓库中的 `kirari.config.toml` — 每个键都带有中英双语注释。

### 环境变量

敏感信息（API 密钥、分析 ID）请使用环境变量。`.env.local` 已加入 `.gitignore`。

| 环境变量 | 覆盖 TOML 键 |
|---------|------------|
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

## 内容创作

### Frontmatter

```yaml
---
title: 文章标题
published: 2024-05-01
updated: 2024-05-02           # 可选；与发布时间并列显示
description: 简短摘要        # 用于 meta description 和文章卡片
image: /cover.png             # 相对于 /public；作为横幅显示
og: /og/custom.png            # 单篇文章 OG 图片覆盖
slug: custom-post-url         # 覆盖自动生成的 slug
tags: [标签1, 标签2]
tagLabels:                    # 可选：与 slug 不同的显示名
  标签1: "标签一"
category: Guides
categoryLabel: "教程系列"     # 可选
draft: false                  # true 在生产环境隐藏
lang: zh-CN                   # BCP 47；i18n 必须
mermaid: true                 # 启用客户端 Mermaid 渲染
---
```

### URL 生成

优先级：frontmatter `slug` → `posts.slugStrategy` 配置。

| 策略 | 行为 | 示例 |
|------|------|------|
| `file`（默认） | 基于文件路径 | `posts/hello/world.md` → `/posts/hello/world/` |
| `crc32` | content entry ID 的 8 位十六进制 | → `/posts/a1b2c3d4/` |

KIRARI 强制 trailing slash（`astro.config.mjs` 中 `trailingSlash: "always"`）。不支持 `.html` 伪静态 URL — 会导致 canonical、RSS、sitemap 和 i18n 路由不一致。

### 标签与分类显示名

标签/分类使用 slug（小写、去空格）作为 URL 标识符：`/tags/标签1/`。`tagLabels` 和 `categoryLabel` 提供 UI 显示名。

多篇文章为同一 slug 声明不同显示名时，构建会输出警告：

```
[DisplayName Conflict] tag "demo": existing="演示" vs new="Demo示例" (source: posts/another-post.md)
```

后写入覆盖先写入。通过此日志可发现命名不一致。

### Mermaid 图表

```markdown
---
mermaid: true
---

\`\`\`mermaid
graph TD;
    A --> B;
\`\`\`
```

Mermaid 渲染仅在客户端执行。`mermaid: true` 为该页面注入 Mermaid 运行时。

### 数学公式（KaTeX）

插件链中已配置 `remark-math` + `rehype-katex`。直接写 LaTeX 行内或块级公式，无需 frontmatter 标记。

### GitHub 卡片与 Admonitions

Markdown 指令语法，由 remark→rehype 插件链处理：

```
::github{repo="owner/repo"}
::githubfile{repo="owner/repo" path="src/main.ts"}

:::note
Admonition 内容
:::
```

GitHub 卡片默认使用 `https://api.github.com`。如需通过 Cloudflare Service Binding 或 Vercel Functions 进行运行时代理，设置 `githubCard.adapter.enabled = true` 和 `githubCard.apiBase = "/ghc"`。参见 `kirari.config.toml` 的 `[githubCard]` 节。

可用 admonition 类型：`note`、`tip`、`important`、`caution`、`warning`。同时支持 GitHub 风格 `[!NOTE]` 语法（`remark-github-admonitions-to-directives` 转换）。

### 视频嵌入（MDX）

```mdx
import YouTube from "../../components/embed/YouTube.astro";
import Bilibili from "../../components/embed/Bilibili.astro";

<YouTube id="VIDEO_ID" />
<Bilibili bvid="BV1234567890" />
```

两者均使用 `w-full aspect-video` 实现 16:9 响应式。需要使用 `.mdx` 扩展名。

### 邮箱混淆

Markdown 中的 `mailto:` 链接在构建输出中自动编码（postbuild 管线）：

```markdown
[contact@example.com](mailto:contact@example.com)
```

### 自定义 Head / Footer

通过 `kirari.config.toml` 注入：

```toml
[head]
customHtml = '<link rel="stylesheet" href="/custom.css">'
customScript = '(function(){ /* 内联 JS，无需 <script> 标签 */ })()'

[footer]
customHtml = '<a href="https://beian.miit.gov.cn/">京ICP备xxxxxxxx号</a>'
customScript = ''
```

## 国际化

BCP 47 公开路由。配置中的 `default-language` 直接在 `/` 提供服务。非默认语言使用前缀 URL：

| 语言 | URL 模式 |
|------|---------|
| `en-US`（默认） | `/posts/hello/`、`/archive/`、`/about/` |
| `zh-CN` | `/zh-CN/posts/hello/`、`/zh-CN/archive/` |

关键行为：

- **`translationKey`** 在 frontmatter 中建立跨语言文章关联。省略时，KIRARI 根据文件名后缀和内容目录结构自动推断。
- **缺失翻译**：语言切换回退到目标语言首页（`fallbackToDefault: true`）。
- **说明页**：本地化内容放在 `src/content/spec/<lang>/`。缺失文件回退到默认 `src/content/spec/`。
- **`default-language-in-subdir: true`**：默认语言也放到 `/en-US/` 下（兼容 Hugo）。

语言对象配置：

```toml
[i18n.languages.zh-CN]
label = "简体中文"
locale = "zh-CN"
direction = "ltr"
weight = 2
disabled = false
contentDir = "src/content/posts/zh-CN"
```

旧版数组写法 `languages = ["en-US", "zh-CN"]` 仍支持；语言细节回退到 11 个已知 BCP 47 标签的内置默认值。

## 搜索

**默认**：[Pagefind](https://pagefind.app/)，在 postbuild 阶段生成。每个页面写入语言过滤信息 — `/zh-CN/` 下搜索不会混入英文结果。

**可选**：[Algolia DocSearch](https://docsearch.algolia.com/)。在配置中启用：

```toml
[search.docsearch]
enable = true
appId = "..."
apiKey = "..."
indexName = "..."
filterByLanguage = true
```

当 DocSearch 启用且凭证有效时，Pagefind 在构建和运行时均被禁用。页面会输出 `docsearch:language` meta 标签供爬虫分面。

## 统计分析

支持 8 种统计服务。通过 `kirari.config.toml` 或环境变量配置。

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

**加载条件**：统计脚本仅在 `analytics.enable === true` **且** `import.meta.env.PROD === true` 时渲染。开发构建永不加载统计。

Umami、Plausible、Matomo 支持可选 `integrity`（SRI），适用于固定版本或自托管脚本。不要对供应商托管、会原地更新的脚本配置 SRI — 过期哈希会导致加载失败。

## LLM 文档

Postbuild 在站点根目录生成 `llms.txt`、`llms-full.txt`、`llms-small.txt`。当 `llms.i18n = true` 时，还会生成按语言分类的文件（`llms-en.txt`、`llms-zh.txt`）。

```toml
[llms]
enable = true
sitemap = true        # 将 llms.txt 文件加入 sitemap.xml
title = "站点名称"
description = "供 AI 索引的站点描述"
i18n = true
```

LLM 可通过 `https://yoursite.com/llms.txt` 获取站点结构和内容索引。

## SEO

| 功能 | 机制 | 配置 |
|------|------|------|
| Sitemap | `@astrojs/sitemap`（自动） | — |
| Robots.txt | Postbuild 管线（自动） | 使用 `site.url` |
| IndexNow | Postbuild 管线 | `seo.indexNow = true`，`seo.indexNowKey = "..."` |
| 搜索验证 | `<meta>` 标签 | `head.verification.google`、`.bing`、`.yandex`、`.naver` |
| Canonical URL | 每页 | 基于 `site.url` 自动生成 |
| hreflang | 每页 | i18n 页面自动生成 |

> IndexNow 在每次构建时向搜索引擎提交 URL。默认关闭。除非需要即时索引，否则保持关闭。

## 架构

### Astro Islands

静态内容 → `.astro` 组件。交互 UI → `.svelte` 组件，使用精确 hydration 指令：

| 组件 | 框架 | Hydration |
|------|------|-----------|
| 搜索 | Svelte | `client:load`（Pagefind）/ 条件加载（DocSearch） |
| 主题切换 | Svelte | `client:load` |
| 主题色选择器 | Svelte | `client:only`（浏览器 localStorage） |
| 文章卡片、布局、导航 | Astro | 静态（无 hydration） |

`client:only` 仅用于显示设置面板 — 该组件读取 `localStorage` 和 CSS 自定义属性，不包含 SEO 内容。

### 页面过渡系统

双路径策略，通过 `TransitionManager` 单例（`src/utils/transition-manager.ts`）统一调度：

| 浏览器 | 机制 | 加载策略 |
|--------|------|---------|
| 支持 View Transitions API | Astro `ClientRouter` | 内置，零额外体积 |
| 不支持 View Transitions API | Swup + Preload 插件 | 首次导航时动态 `import()` |

**统一事件 API** — 无论底层实现如何，组件都注册相同的四个事件：

```ts
import { transitionManager } from "@utils/transition-manager";

transitionManager.on("transition:after-swap", () => {
  // 导航后重新初始化 DOM 依赖代码
});
```

**关键规则**：不要使用 `DOMContentLoaded` 或 `window.onload` 处理导航后初始化。这些事件仅在硬页面加载时触发，不会在 SPA 风格过渡中触发。

`transition:after-swap` 时，系统从 `localStorage` + 配置默认值恢复 `<html>` 外观状态（主题模式、色相、Expressive Code 主题）— 而非复制旧 DOM。

### 性能

| 技术 | 细节 |
|------|------|
| 字体自托管 | Roboto 通过 `@fontsource/roboto` 加载，仅 Latin `400/500/700` 字重 |
| 响应式图片 | Banner、头像、文章封面 → 多宽度 srcset（Astro Image / sharp） |
| 图标 Tree-Shaking | Vite 插件拦截所有 `@iconify-json` JSON 导入；仅 `astro.config.mjs` 中手动注册的图标被打包；运行时图标使用 CDN |
| Prefetch 策略 | `prefetchAll: false`；导航链接 hover，移动菜单 tap |
| 不可变缓存 | `/_astro/*` — 文件名含内容哈希 → `Cache-Control: public, max-age=31536000, immutable` |
| HTML 缓存 | 支持 revalidation（文件名不含哈希） |
| 构建压缩 | `esbuild` 压缩器，`cssCodeSplit: true`，`target: "esnext"` |
| 分块大小 | 警告阈值 700 KB |
| View Transition 状态 | 从 `localStorage` + 配置默认值恢复，不复制过期 DOM |

### 各平台缓存规则

| 平台 | 文件 | 规则 |
|------|------|------|
| Cloudflare Pages | `dist/_headers`（postbuild 生成） | `/_astro/*` immutable |
| Netlify | `dist/_headers`（postbuild 生成） | `/_astro/*` immutable |
| Vercel | `vercel.json`（静态文件） | `/_astro/*` immutable |
| EdgeOne Pages | `edgeone.json`（静态文件） | `/_astro/*` immutable |

## 构建管线

`pnpm build` 顺序执行：

```
materialize-ghc-adapter.mjs → astro build → postbuild.mjs
```

1. **`materialize-ghc-adapter.mjs`**：仅当 `githubCard.adapter.enabled = true` 时，生成 `functions/ghc/[[path]].ts`（Cloudflare）或 `api/ghc/[...path].ts`（Vercel）
2. **`astro build`**：标准 Astro SSG → `dist/`
3. **`postbuild.mjs`**：生成 `_headers`、`_redirects`、`robots.txt`、Pagefind 索引、`llms.txt` 文件及 IndexNow 提交

## 脚本命令

| 命令 | 用途 |
|------|------|
| `pnpm dev` | `astro dev` |
| `pnpm build` | materialize → astro build → postbuild |
| `pnpm preview` | `astro preview` |
| `pnpm check` | `astro check`（检查 `.astro` 文件） |
| `pnpm type-check` | `tsc --noEmit` |
| `pnpm new-post` | 交互式创建新文章 |

## 目录结构

```
KIRARI/
├── kirari.config.toml          # 站点配置（TOML）
├── astro.config.mjs            # Astro + 集成 + Vite
├── svelte.config.js            # Svelte 编译器选项
├── tsconfig.json
├── package.json
├── src/
│   ├── constants.ts            # 通过 config-loader.ts 加载配置
│   ├── config.ts               # 再导出 Config、废弃的 getConfig
│   ├── types/config.ts         # Config 的 TypeScript 类型定义
│   ├── components/             # .astro 和 .svelte 组件
│   ├── content/
│   │   ├── config.ts           # 内容集合 Zod schema
│   │   ├── posts/              # 博客文章（Markdown/MDX）
│   │   └── spec/               # 静态页面（about、friends）
│   ├── _data/                  # JSON 数据（friends.json）
│   ├── i18n/                   # 翻译字典（11 种语言）
│   ├── layouts/                # 页面布局
│   ├── pages/                  # 基于文件的路由
│   ├── plugins/                # remark/rehype/Expressive Code 插件
│   ├── styles/                 # CSS、Stylus（markdown-extend.styl）
│   └── utils/                  # config-loader、transition-manager、env
├── scripts/                    # 构建管线脚本
├── adapters/                   # 适配器模板（ghc-card）
├── public/                     # 静态资源
└── dist/                       # 构建输出（gitignored）
```

## 发版验证

```bash
pnpm install --frozen-lockfile
pnpm type-check
pnpm astro check
pnpm build
```

CI/CD 必须使用仓库中的 `pnpm-lock.yaml`。Patch 发版的依赖刷新保持在声明的 semver 范围内。`@astrojs/check` 仅用于开发。

## 更新日志

[CHANGELOG.md](./CHANGELOG.md)

## 致谢

- [saicaca/fuwari](https://github.com/saicaca/fuwari) — 原始主题
- [JoeyC-Dev/saicaca-fuwari](https://github.com/JoeyC-Dev/saicaca-fuwari) — 增强分支

## 许可证

MIT
