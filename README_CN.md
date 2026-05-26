[English](./README.md)

<div align="center">

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/markd3ng/KIRARI)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/markd3ng/KIRARI)
[![Deploy to Cloudflare Pages](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/markd3ng/KIRARI)
[![Deploy with EdgeOne Pages](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?repository=https://github.com/markd3ng/KIRARI)

</div>

# KIRARI

静态博客主题 — Astro 6.3.7 + Svelte 5 + Tailwind CSS v4。单一 TOML 配置驱动。支持 Cloudflare Pages、Vercel、Netlify、EdgeOne Pages 部署。

## 架构

```
kirari.config.toml  ──→  smol-toml 解析  ──→  config-loader.ts（类型守卫 + 默认值）
                                                        ↓
                                              Config 单例 (@constants)
                                              ↓ 按模块拆分导出 (@config)
                                              ↓ 供 astro.config.mjs + 各组件消费
```

配置采用 **TOML-first**：普通站点配置写在 `kirari.config.toml`。环境变量只用于密钥、部署差异，以及不适合提交到仓库的服务凭据。

**Islands**：仅 3 个 Svelte 组件在客户端水合 — 搜索（`client:idle`）、主题切换（`client:idle`）、显示设置（`client:only="svelte"`）。其余全部为静态 `.astro`。

**页面过渡**：`TransitionManager` 单例（`src/utils/transition-manager.ts`）封装双路径策略：

| 浏览器能力 | 引擎 | 额外体积 |
|---|---|---|
| 支持 View Transitions API | Astro `ClientRouter` | 0 |
| 不支持 | Swup 4.9 + Preload 插件 | 动态 `import()` |

无论底层实现如何，统一事件 API：

```ts
import { transitionManager } from "@utils/transition-manager";

// 替代 DOMContentLoaded — 在 SPA 导航中持续生效
transitionManager.on("transition:after-swap", init);
```

事件映射：`transition:start` ← `astro:before-preparation` / `visit:start`，`transition:before-swap` ← `astro:before-swap` / `content:replace`，`transition:after-swap` ← `astro:after-swap` / `page:view`，`transition:end` ← `astro:page-load` / `visit:end`。

> **注意**：`DOMContentLoaded` 仅在硬加载时触发。导航后初始化必须使用 `transition:after-swap`。

**Markdown 插件链**：

| 阶段 | 插件 | 功能 |
|---|---|---|
| Remark | `remark-math`、`remark-reading-time`、`remark-excerpt`、`remark-github-admonitions-to-directives`、`remark-directive`、`remark-sectionize`、`parseDirectiveNode` | 解析 frontmatter、指令、公式、section |
| Rehype | `rehype-katex`、`rehype-mermaid-pre`、`rehype-slug`、`rehype-lazy-load-image`、`rehype-components`（admonitions + GitHub 卡片）、`rehype-autolink-headings` | 渲染公式、图表、自定义组件 |

**构建管线**：

```
materialize-ghc-adapter.mjs → astro build → postbuild.mjs
```

| 阶段 | 产物 |
|---|---|
| materialize | `functions/ghc/` 或 `api/ghc/`（仅 `githubCard.adapter.enabled` 时） |
| astro build | `dist/`（SSG） |
| postbuild | `_headers`、`_redirects`、`robots.txt`、Pagefind 索引、`llms.txt`、IndexNow 提交 |

**性能保证**：

| 技术 | 实现 |
|---|---|
| 字体 | 自托管 Roboto（仅 Latin 400/500/700 字重） |
| 图片 | sharp 生成多宽度 `srcset`，`rehype-lazy-load-image` 添加 `loading="lazy"` |
| 图标 | Vite 插件拦截所有 `@iconify-json` 导入；仅通过 `addIcon()` 注册的图标被打包 |
| 预取 | `prefetchAll: false`；桌面 hover 预取，移动端 tap 预取 |
| 缓存 | `/_astro/*` → immutable（内容哈希文件名），HTML → 可 revalidation |
| CSS | `cssCodeSplit: true`，target `esnext`，chunk 警告阈值 700 KB |

## 技术栈

| 类别 | 包 | 版本 |
|---|---|---|
| 框架 | astro | 6.3.7 |
| Islands | svelte | ^5.55.9 |
| CSS | tailwindcss、@tailwindcss/vite、stylus | ^4.3.0、^0.64.0 |
| 搜索 | pagefind（默认）、@docsearch/js（Algolia） | ^1.5.2、^4.6.3 |
| 代码高亮 | astro-expressive-code + 4 插件 | ^0.42.0 |
| 公式 | remark-math、rehype-katex、katex | ^0.16.47 |
| 图表 | mermaid（仅客户端） | ^11.15.0 |
| 图标 | astro-icon、@iconify/svelte | — |
| 过渡 | Astro ClientRouter / swup 降级 | ^4.9.0 |
| 图片灯箱 | photoswipe | ^5.4.4 |
| 图片处理 | sharp | ^0.34.5 |
| 滚动条 | overlayscrollbars | ^2.16.0 |
| 内容 | @astrojs/mdx + remark/rehype 链 | ^5.0.4 |
| 订阅 | @astrojs/rss、@astrojs/sitemap | — |
| OG 图片 | satori | ^0.26.0 |
| 配置 | smol-toml | ^1.6.1 |

## 快速开始

```bash
git clone https://github.com/markd3ng/KIRARI.git
cd KIRARI
pnpm install          # 仅 pnpm — preinstall 钩子阻止 npm/yarn
pnpm dev
pnpm build
```

> pnpm ≥ 9.14.4，通过 `packageManager` 字段强制。

## Fork 后最小修改清单

仅修改以下文件。不要修改 `src/components/`、`src/layouts/`、`src/styles/`、`src/utils/`。

| 路径 | 操作 | 必改 |
|---|---|---|
| `kirari.config.toml` | 设置 `site.url`、`site.title`、`profile.*`、`navBar.*`、`landingPage.*` | 是 |
| `src/content/posts/` | 删除示例文章，添加自己的 `.md`/`.mdx` | 是 |
| `src/content/spec/about.md` | 替换关于页内容 | 推荐 |
| `src/assets/images/` | 替换头像、横幅、Landing Hero 图 | 推荐 |
| `public/favicon/` | 替换 favicon | 推荐 |
| `public/og/default.png` | 替换默认 OG 图片 | 推荐 |
| `src/content/spec/friends.md` | 替换或移除 Friends 导航 | 可选 |
| `src/_data/friends.json` | 替换友链数据 | 可选 |

验证：

```bash
pnpm install --frozen-lockfile
pnpm type-check
pnpm astro check
pnpm build
pnpm audit --audit-level moderate
```

## 配置

统一入口：`kirari.config.toml`。优先级：**环境变量 > TOML > config-loader.ts 默认值**。

`kirari.config.toml` 中每个键都带有中英双语注释。文件本身即为完整参考。以下为结构概览。

### 站点

```toml
[site]
url = "https://example.com"
title = "站点标题"
subtitle = "Demo Site"
lang = "zh-CN"      # en-US | zh-CN | zh-TW | zh-HK | ja-JP | ko-KR | es-ES | th-TH | vi-VN | tr-TR | id-ID
base = "/"          # 子目录部署："/blog"

[site.themeColor]
hue = 250           # 0–360
fixed = false       # true 则对访客隐藏色相选择器

[site.banner]
enable = true
src = "assets/images/demo-banner.png"   # 相对于 src/ 或以 / 开头则相对于 /public
position = "center"                      # top | center | bottom

[site.toc]
enable = true
depth = 3            # 1 | 2 | 3
```

### 文章

```toml
[posts]
slug-strategy = "file"   # file（路径派生）| crc32（content entry ID → 8 位十六进制）
```

`frontmatter.slug` 优先于策略。始终强制 trailing slash。

### 国际化

BCP 47 路由，兼容 Hugo 的 `default-language-in-subdir`：

| 语言 | URL（default-in-subdir=false） |
|---|---|
| `zh-CN`（默认） | `/posts/hello/` |
| `en-US` | `/en-US/posts/hello/` |

```toml
[i18n]
enable = true
default-language = "zh-CN"
default-language-in-subdir = false   # true → /zh-CN/ 为默认
fallbackToDefault = true             # 缺失翻译 → 回退目标语言首页

[i18n.languages.zh-CN]
label = "简体中文"
locale = "zh-CN"
direction = "ltr"
weight = 1
disabled = false
contentDir = "src/content/posts"

[i18n.languages.en-US]
label = "English"
locale = "en-US"
direction = "ltr"
weight = 2
disabled = false
contentDir = "src/content/posts/en-US"
```

预配置 11 种语言（默认关闭 5 种：ja-JP、ko-KR、es-ES、th-TH、vi-VN、tr-TR、id-ID）。翻译字典在 `src/i18n/languages/`。

`translationKey` frontmatter 跨语言关联文章。省略时从匹配内容目录中的文件名自动推断。

### 导航

4 个预设项：`Home`、`Archive`、`About`、`Friends`。支持自定义链接：

```toml
[[navBar.links]]
preset = "Home"

[[navBar.links]]
name = "GitHub"
url = "https://github.com/you"
external = true
```

### 搜索

KIRARI 支持三种搜索提供方，在 TOML 中选择：

```toml
[search]
provider = "pagefind" # pagefind | docsearch | google
```

**Pagefind**（默认）：postbuild 阶段生成本地静态索引。查询时按语言过滤，避免跨语言结果。

**Algolia DocSearch**：外部托管文档搜索。启用该 provider 时，构建和运行时均禁用 Pagefind。

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

**Google Programmable Search**：使用 Google 搜索当前站点。启用该 provider 时会禁用 Pagefind。`cx` 是公开搜索引擎 ID，不是密钥。

```toml
[search]
provider = "google"

[search.google]
cx = "YOUR_PROGRAMMABLE_SEARCH_ENGINE_ID"
adsense = false
resultSetSize = "filtered_cse"
safeSearch = "active"
```

`adsense = false` 时，KIRARI 通过 Programmable Search Element callbacks 把 Google 结果渲染成现有搜索面板风格。`adsense = true` 时，结果区域交给 Google 官方元素渲染，避免隐藏或改写 AdSense 搜索广告和 Google 标识；广告是否展示由 Google/AdSense 控制。

### 统计分析

总开关：`analytics.enable`。脚本仅在 `true && PROD` 时加载。

| 服务 | 配置键 | 环境变量覆盖 |
|---|---|---|
| Google Analytics | `analytics.googleAnalyticsId` | `PUBLIC_GOOGLE_ANALYTICS_ID` |
| Umami | `analytics.umami.id` | `PUBLIC_UMAMI_ID` |
| Plausible | `analytics.plausible.domain` | `PUBLIC_PLAUSIBLE_DOMAIN` |
| Microsoft Clarity | `analytics.clarityProjectId` | `PUBLIC_CLARITY_PROJECT_ID` |
| Fathom | `analytics.fathomSiteId` | `PUBLIC_FATHOM_SITE_ID` |
| Simple Analytics | `analytics.simpleAnalyticsDomain` | — |
| Matomo | `analytics.matomo.siteId` + `src` | `PUBLIC_MATOMO_SITE_ID`、`PUBLIC_MATOMO_SRC` |
| Amplitude | `analytics.amplitudeApiKey` | `PUBLIC_AMPLITUDE_API_KEY` |

Umami、Plausible、Matomo 支持可选 `integrity`（SRI），用于固定版本脚本。

### Landing Page

PRD 风格 Hero + 特性卡片 + 最新文章。启用后，`/blog/` 仍可访问经典文章列表。

```toml
[landingPage]
enable = true
latestCount = 3              # 最大 12
heroImage = "assets/images/demo-banner.png"

[[landingPage.features.items]]
icon = "material-symbols:code-rounded"
title = "特性名称"
description = "特性描述"
```

### GitHub 卡片

内联 `::github{repo="owner/repo"}` 和 `::githubfile{repo="owner/repo" path="src/main.ts"}` 指令。默认 API：`https://api.github.com`。

对有限速的平台，启用运行时适配器：

```toml
[githubCard.adapter]
enabled = true
provider = "cloudflare"   # cloudflare | vercel | auto
route = "/ghc"
serviceBinding = "GHCARD_CACHE"
```

- **Cloudflare Pages**：部署独立 Worker，GitHub token 设为 Secret。`serviceBinding` 设为 binding 名称。
- **Vercel**：在 Project Environment Variables 中设置 `GITHUB_TOKEN`。将 `GHC_ALLOWED_ORIGINS` 设为允许调用适配器的精确 origin 列表（逗号分隔）。留空时不会给浏览器 Origin 请求授予 CORS；同源/no-Origin 服务端请求仍可工作，但不返回 `Access-Control-Allow-Origin`。

### SEO

| 功能 | 机制 |
|---|---|
| Sitemap | `@astrojs/sitemap`（自动） |
| Robots.txt | postbuild 阶段从 `site.url` 生成 |
| Canonical + hreflang | 每页自动推导 |
| 搜索验证 | `head.verification.{google,bing,yandex,naver}` |
| IndexNow | `seo.indexNow = true` → 每次构建提交到参与协议的搜索引擎 |
| Google 索引 | `seo.google.indexingApi = true` → 可选高级 Google Indexing API 提交 |

IndexNow 覆盖 Bing、Yandex、Naver、Seznam.cz、Yep 等参与方。Google 不支持 IndexNow；Google 仍依赖 sitemap/Search Console，或针对适用内容使用可选 Google Indexing API。IndexNow key 是部署到 `/{key}.txt` 的公开验证 key；不要复用密码、token 或其他私密 secret。Google Indexing API 主要面向 JobPosting 和 BroadcastEvent URL，普通博客页面不保证受益。

### LLMs.txt

postbuild 生成 `llms.txt`、`llms-small.txt`、`llms-full.txt`。`llms.i18n = true` 时额外生成按语言分类文件（`llms-en.txt`、`llms-zh.txt`）。`llms-full.txt` 是公开的页面文本聚合文件，每页上限 20,000 字符；postbuild 会在 `robots.txt` 加入 `Disallow: /llms-full.txt`，并在部署 headers 中为它设置 `Cache-Control: no-store`。这些是缓解措施，不是访问控制。

```toml
[llms]
enable = true
sitemap = true
title = "站点名称"
description = "供 AI 索引的站点描述"
i18n = true
```

### 自定义 Head / Footer

粘贴 HTML 或 JavaScript 时，推荐把可信片段放到 `src/snippets/` 文件中，
避免 TOML 中的引号、反斜杠、模板字符串产生转义问题。原有 inline TOML
字段继续保留，适合短片段。

```toml
[head]
customHtml = '<link rel="stylesheet" href="/custom.css">'
customScript = '(function(){ /* 无需 <script> 标签 */ })()'
customHtmlFile = "head.html"      # src/snippets/head.html，原样注入 <head>
customScriptFile = "head.js"      # src/snippets/head.js，不要写 <script> 标签

[footer]
customHtml = '<a href="https://beian.miit.gov.cn/">京ICP备xxxxxxxx号</a>'
customHtmlFile = "footer.html"    # src/snippets/footer.html
customScriptFile = "footer.js"    # src/snippets/footer.js，不要写 <script> 标签
```

片段文件名只能是 `head.html` 这类 basename；`../secret.html`、`/tmp/x.html`
和子目录路径会被忽略。片段属于可信站点维护者输入，会通过 `set:html` 渲染；
不要把访客、评论或 CMS 用户输入接入这些字段。默认 CSP 为兼容这些 owner-level
inline 片段，仍允许 inline script/style；若要收紧 CSP，需要先把片段迁移为支持
nonce/hash 的外部资源。

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
slug: custom-url               # 覆盖 slugStrategy
tags: [标签1, 标签2]
tagLabels:                     # UI 显示名（URL 使用 slug）
  标签1: "标签一"
category: 教程
categoryLabel: "教程系列"
draft: false                   # 生产环境隐藏
lang: zh-CN                    # i18n 必须
mermaid: true                  # 注入 Mermaid 运行时（仅客户端）
notbyai: true                  # 在 license 区域显示本地化 Not By AI badge
translationKey: my-post        # 跨语言文章关联
---
```

设置 `notbyai: true` 后，文章页 license 区域会显示对应语言的 Not By AI “Written By Human” badge。

### Admonitions

```
:::note
内容
:::
```

类型：`note`、`tip`、`important`、`caution`、`warning`。GitHub `[!NOTE]` 语法通过 `remark-github-admonitions-to-directives` 转换。

### 视频嵌入（仅 MDX）

```mdx
import YouTube from "../../components/embed/YouTube.astro";
<YouTube id="VIDEO_ID" />
```

`YouTube` 和 `Bilibili` — 均渲染为 `w-full aspect-video`。

### 图片灯箱

Photoswipe 自动绑定 `.post-cover` 图片。点击任意内容图片打开全屏查看器。

## 各平台缓存

| 平台 | 配置文件 | 规则 |
|---|---|---|
| Cloudflare Pages | `dist/_headers`（postbuild） | `/_astro/*` immutable |
| Netlify | `dist/_headers`（postbuild） | `/_astro/*` immutable |
| Vercel | `vercel.json` | `/_astro/*` immutable |
| EdgeOne Pages | `edgeone.json` | `/_astro/*` immutable |

## 脚本命令

| 命令 | 执行 |
|---|---|
| `pnpm dev` | `astro dev` |
| `pnpm build` | materialize → astro build → postbuild |
| `pnpm preview` | `astro preview` |
| `pnpm check` | `astro check` |
| `pnpm type-check` | `tsc --noEmit` |
| `pnpm new-post` | 交互式创建文章 |

## 目录结构

```
KIRARI/
├── kirari.config.toml          # 规范配置（TOML，中英双语注释）
├── astro.config.mjs            # 集成、markdown 插件、Vite 配置
├── src/
│   ├── constants.ts            # Config 加载器 → Config 单例
│   ├── config.ts               # 按模块拆分导出（向后兼容）
│   ├── types/config.ts         # 完整 TypeScript 类型树
│   ├── components/             # .astro（静态）、.svelte（islands）
│   │   ├── embed/              # YouTube、Bilibili
│   │   ├── landing/            # LandingPage.astro
│   │   ├── misc/               # ImageWrapper、License、Markdown
│   │   └── widget/             # SideBar、TOC、Profile、Categories、Tags
│   ├── content/
│   │   ├── posts/              # .md / .mdx 博客文章
│   │   └── spec/               # 静态页面（about、friends）
│   ├── layouts/                # Layout.astro（~1310 行）、MainGridLayout.astro
│   ├── pages/                  # 基于文件的路由 + [lang]/ 变体
│   ├── plugins/                # Remark/rehype 适配器、expressive-code 插件
│   ├── i18n/                   # 翻译字典（10 种语言）
│   ├── styles/                 # markdown-extend.styl（admonitions、GitHub 卡片、KaTeX）
│   └── utils/                  # config-loader、transition-manager、env、i18n-utils
├── scripts/                    # materialize-ghc-adapter、postbuild、new-post
├── adapters/                   # ghc-card 路由模板（cloudflare、vercel）
├── public/                     # 静态资源（favicon、OG 图片）
└── dist/                       # 构建输出（gitignored）
```

## 发版验证

```bash
pnpm install --frozen-lockfile
pnpm type-check
pnpm astro check
pnpm build
pnpm audit --audit-level moderate
```

CI 必须使用 `--frozen-lockfile`。`@astrojs/check` 仅 devDependency。

## 更新日志

[CHANGELOG.md](./CHANGELOG.md)

## 许可证

MIT
