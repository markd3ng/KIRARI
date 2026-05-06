[English](./README.md)

<div align="center">

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/markd3ng/KIRARI)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/markd3ng/KIRARI)
[![Deploy to Cloudflare Pages](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/markd3ng/KIRARI)
[![Deploy with EdgeOne Pages](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?repository=https://github.com/markd3ng/KIRARI)

</div>

# KIRARI

一个基于 **Astro 6** + **Svelte 5** + **TailwindCSS 4** 构建的现代化、高性能静态博客主题。支持可配置 OG 图片、全文搜索、流畅的页面过渡以及 LLM 文档支持。

## 特性

- **可配置 OG 图片** - 支持单篇 `frontmatter.og` 自定义，未设置时回退到 `og.defaultImage`

- **全文搜索** - 基于 Pagefind，支持防抖和并发请求处理
- **Mermaid 图表** - 流程图、时序图等，客户端渲染
- **数学公式** - 使用 KaTeX 渲染 LaTeX
- **Hugo-like i18n** - 语言前缀 URL、文章 `translationKey`、语言切换、canonical 与 `hreflang`
- **LLM 就绪** - 自动生成 `llms.txt` 供 AI 索引
- **深色模式** - 支持系统偏好检测 + 手动切换
- **平滑过渡** - View Transitions API，旧浏览器自动降级到 Swup
- **安全加固** - 所有外链均包含 `rel="noopener noreferrer"`
- **代码整洁** - 清理未使用参数/文件/依赖，并减少调试日志噪音（不改变功能行为）

## 快速开始

```bash
# 克隆仓库
git clone https://github.com/markd3ng/KIRARI.git
cd KIRARI

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 生产构建
pnpm build

# 预览构建结果
pnpm preview
```

## 配置

所有设置通过 **`kirari.config.toml`** 配置（Hugo 风格，推荐）。

配置优先级：**环境变量** → **`kirari.config.toml`** → **默认值**

### 快速开始

编辑项目根目录的 `kirari.config.toml`：

```toml
[site]
url = "https://your-domain.com"
title = "你的站点"
subtitle = "你的标语"
lang = "zh-CN"                 # en-US, zh-CN, zh-TW, zh-HK, ja-JP, ko-KR, es-ES, th-TH, vi-VN, tr-TR, id-ID
base = "/"                     # 基础路径（例如子目录用 "/blog"）

[i18n]
enable = true
default-language = "en-US"     # 根路径 / 直接作为默认语言
default-language-in-subdir = false # false: /，true: /en-US/
languages = ["en-US", "zh-CN", "zh-TW", "zh-HK"]
fallbackToDefault = true       # 缺少翻译时切换到目标语言首页

[search.docsearch]
enable = false                 # 开启后禁用 Pagefind
appId = ""
apiKey = ""
indexName = ""
filterByLanguage = true        # 使用 docsearch:language meta tags

[site.themeColor]
hue = 250                      # 0-360（红色: 0, 青色: 200, 天蓝: 250, 粉色: 345）
fixed = false                  # 隐藏主题色选择器

[site.banner]
enable = true
src = "assets/images/banner.png"
position = "center"            # 'top', 'center', 'bottom'

[site.banner.credit]
enable = false
text = ""
url = ""

[site.toc]
enable = true                  # 显示目录
depth = 3                      # 最大标题深度 (1-3)

[[site.favicon]]
src = "/favicon/icon.png"
theme = "light"                # 可选: 'light' 或 'dark'
sizes = "32x32"                # 可选: favicon 尺寸

[profile]
avatar = "assets/images/avatar.png"
name = "你的名字"
bio = "你的简介"

[[profile.links]]
name = "GitHub"
icon = "fa6-brands:github"     # 访问 https://icones.js.org/ 查看图标代码
url = "https://github.com/you"

[license]
enable = true
name = "CC BY-NC-SA 4.0"
url = "https://creativecommons.org/licenses/by-nc-sa/4.0/"

[head.verification]
google = ""                    # Google 搜索控制台验证码
bing = ""                      # Bing 网站管理员工具验证码

[og]
defaultImage = "/og/default.png"

[llms]
enable = true
sitemap = true
title = "你的站点"
description = "站点描述"
i18n = true

[seo]
indexNow = false               # 启用 IndexNow 即时搜索引擎索引
indexNowKey = ""               # IndexNow API 密钥
```

### 国际化

KIRARI 使用 BCP 47 公开路由。默认情况下，配置项 `default-language` 对应语言不带前缀，例如 `en-US` 使用 `/`、`/archive/`、`/posts/.../`；非默认语言使用 `/zh-CN/` 等前缀。设置 `default-language-in-subdir = true` 后，默认语言也会放到 `/en-US/` 下。

文章可通过 `translationKey` 建立跨语言关联：

```yaml
---
title: Markdown Example
lang: en-US
translationKey: markdown
---
```

如果当前页面存在目标语言翻译，导航栏语言切换会跳转到对应文章；否则回退到目标语言首页。

静态说明页可以放在 `src/content/spec/<lang-slug>/` 下做本地化，例如 `src/content/spec/zh-CN/about.md`。如果目标语言文件不存在，会回退到默认的 `src/content/spec/about.md` 或 `friends.md`。

### 搜索

Pagefind 是默认本地搜索。KIRARI 会为每个生成页面写入语言过滤信息，并在当前语言范围内搜索，所以 `/zh-CN/` 不会混入英文结果。

可以通过 `[search.docsearch]` 或 `PUBLIC_DOCSEARCH_*` 环境变量启用 Algolia DocSearch。当 DocSearch 开启且 `appId`、`apiKey`、`indexName` 都存在时，Pagefind 会在构建和运行时禁用。页面会输出 `docsearch:language`，并把可选的 `[search.docsearch.metaTags]` 写成 `<meta name="docsearch:*">`，供爬虫生成 facet。

### 性能策略

- Roboto 通过 `@fontsource/roboto` 自托管，默认仅加载 Latin `400`、`500`、`700` 字重。
- Banner、头像、文章封面继续生成响应式图片宽度，降低移动端传输体积并保留显示效果。
- Astro prefetch 使用 selective 策略：主导航使用 `hover`，移动/菜单链接使用 `tap`，不启用 `prefetchAll`。
- `pnpm build` 会生成供 Cloudflare Pages 与 Netlify 使用的 `dist/_headers` 与 `dist/_redirects`，同时通过 `vercel.json` 与 `edgeone.json` 为 Vercel、EdgeOne 设置缓存头。
- `/_astro/*` 使用 immutable 强缓存，因为文件名带内容 hash；HTML、Pagefind 与非 hash public 文件保持可安全更新。

### 导航栏

配置导航链接（支持预设和自定义链接）：

```toml
[[navBar.links]]
preset = "Home"                # 预设: Home, Archive, About, Friends

[[navBar.links]]
preset = "Archive"

[[navBar.links]]
name = "GitHub"                # 自定义链接
url = "https://github.com/you"
external = true                # 新标签页打开，显示外链图标
```

### 统计分析

配置分析服务：

```toml
[analytics]
enable = true                  # 总开关（默认: false）
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

**分析服务表格：**

| 服务 | 配置 |
|------|------|
| Google Analytics | `googleAnalyticsId` |
| Umami | `umami.id`, `umami.src`（可选）|
| Plausible | `plausible.domain`, `plausible.src`（可选）|
| Microsoft Clarity | `clarityProjectId` |
| Fathom | `fathomSiteId` |
| Simple Analytics | `simpleAnalyticsDomain` |
| Matomo | `matomo.siteId`, `matomo.src` |
| Amplitude | `amplitudeApiKey` |

分析脚本仅在同时满足以下条件时加载：
1. `analytics.enable = true`
2. 生产环境构建（`import.meta.env.PROD`）

### 环境变量（仅敏感数据）

对于敏感数据（API 密钥、分析 ID），建议使用环境变量而非 TOML：

**在项目根目录创建 `.env.local`：**

```bash
# 统计分析（生产环境推荐）
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

# 搜索引擎验证（敏感）
PUBLIC_GOOGLE_VERIFICATION=your-verification-code
PUBLIC_BING_VERIFICATION=your-verification-code
```

**优先级：** 环境变量覆盖 TOML 配置。

> **注意**：`.env.local` 已在 `.gitignore` 中，你的敏感数据不会被提交。

### 部署配置

| 环境 | 配置方式 |
|------|----------|
| 本地开发 | 直接编辑 `kirari.config.toml` |
| 生产环境（非敏感）| 编辑 `kirari.config.toml` 并提交 |
| 生产环境（敏感）| 在 Vercel/Netlify 控制台设置环境变量 |
| 默认回退 | 使用 `src/utils/config-loader.ts` 中的值 |


## 主要功能


### 撰写文章

在 `src/content/posts/` 中创建 Markdown 文件：

```markdown
---
title: 文章标题
published: 2024-05-01
updated: 2024-05-02      # 可选
description: 简短描述    # 可选
image: /cover.png        # 可选，横幅图片
og: /og/custom.png       # 可选，当前文章专用 OG 图片
tags: [标签1, 标签2]     # 可选
category: Guides         # 可选
draft: false             # 在生产环境隐藏
lang: zh-CN              # BCP 47 语言标签
mermaid: true            # 启用 Mermaid 图表
---

你的内容在这里。
```

### 标签与分类显示名

标签和分类使用 slug（小写、去除首尾空格）作为 URL 标识符。你可以选择性指定与 slug 不同的显示名称：

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

**工作原理：**
- URL 保持 `/tags/demo/`（使用 slug）
- 页面显示 "演示 Demo"（使用 `tagLabels`）
- 若未声明标签名，则显示原始 slug 值

**冲突检测日志：**
当多篇文章为同一 slug 声明了不同的显示名时，构建时会输出警告：

```
[DisplayName Conflict] tag "demo": existing="演示" vs new="Demo示例" (source: posts/another-post.md)
```

后声明的值会覆盖先前的值。通过此日志可发现并修复命名不一致问题。

### OG 图片

- **文章页面**：优先使用 `frontmatter.og`
- **回退规则**：未设置 `frontmatter.og` 时使用 `og.defaultImage`
- **其他页面**：使用 `og.defaultImage` 配置的默认图片


### Mermaid 图表

在 frontmatter 中添加 `mermaid: true`：

````markdown
---
mermaid: true
---

```mermaid
graph TD;
    A --> B;
```
````

### 友链页面

编辑 `src/_data/friends.json`：

```json
[
  {
    "siteTitle": "朋友的博客",
    "siteDesc": "描述",
    "siteUrl": "https://example.com",
    "siteIcon": "https://example.com/avatar.png"
  }
]
```

### 自定义 Head/Footer

```typescript
// src/constants.ts
head: {
  verification: {
    google: "你的验证码",
    bing: "你的验证码"
  },
  customHtml: "",
  customScript: ""
},
footer: {
  customHtml: "",
  customScript: ""
}
```

**`customScript`** - 第三方脚本（分析、广告）会自动通过 Partytown 卸载到 Web Worker 中执行以获得更好的性能。只需提供脚本**内容**（无需 `<script>` 标签）：

```typescript
footer: {
  customScript: `(function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
  })(window, document, "clarity", "script", "YOUR_PROJECT_ID");`
}
```

**`customHtml`** - 用于完全控制 HTML/脚本标签。如果你需要自定义属性或不希望使用 Partytown，请使用此选项：

```typescript
head: {
  customHtml: `<script type="text/javascript" src="https://example.com/script.js"></script>`
}
```

### LLM 文档

Powered by `astro-llms-generate`。构建时生成：
- `llms.txt` - 主索引（Markdown 格式供 LLM 使用）
- `llms-full.txt` - 完整内容合并文件
- `llms-small.txt` - 精简版本
- `llms-en.txt`、`llms-zh.txt` - 按语言分类的文件（当 `i18n: true` 时）

**配置** 在 `src/constants.ts` 中：

```typescript
llms: {
  enable: true,        // 启用/禁用生成
  sitemap: true,       // 将 llms.txt 文件添加到 sitemap
  title: "你的站点",   // llms.txt 中的站点标题
  description: "供 LLM 使用的站点描述",
  i18n: true           // 生成按语言分类的文件
}
```

**LLM 使用方式**：AI 助手可以获取 `https://yoursite.com/llms.txt` 来了解你的站点结构和内容，从而更好地回答关于你文档或博客的问题。

### 统计分析

通过 `astro-analytics` 集成，支持多种分析服务。在 `src/constants.ts` 中配置或通过环境变量设置。

分析脚本仅在同时满足以下条件时加载：
1. `analytics.enable`（或 `PUBLIC_ANALYTICS_ENABLE`）为 `true`
2. 当前为生产环境（`import.meta.env.PROD`）



```typescript
// src/constants.ts
analytics: {
  enable: true,                            // 总开关（默认：false）
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

**支持的服务：**

| 服务 | 配置键 | 环境变量 |
|------|--------|----------|
| **总开关** | `enable` | `PUBLIC_ANALYTICS_ENABLE` |
| Google Analytics | `googleAnalyticsId` | `PUBLIC_GOOGLE_ANALYTICS_ID` |
| Umami | `umami.id`, `umami.src` | `PUBLIC_UMAMI_ID`, `PUBLIC_UMAMI_SRC` |
| Plausible | `plausible.domain`, `plausible.src` | `PUBLIC_PLAUSIBLE_DOMAIN`, `PUBLIC_PLAUSIBLE_SRC` |
| Microsoft Clarity | `clarityProjectId` | `PUBLIC_CLARITY_PROJECT_ID`（推荐）, `PUBLIC_CLARITY_ID`（别名） |

| Fathom | `fathomSiteId` | `PUBLIC_FATHOM_SITE_ID` |
| Simple Analytics | `simpleAnalyticsDomain` | `PUBLIC_SIMPLE_ANALYTICS_DOMAIN` |
| Matomo | `matomo.siteId`, `matomo.src` | `PUBLIC_MATOMO_SITE_ID`, `PUBLIC_MATOMO_SRC` |
| Amplitude | `amplitudeApiKey` | `PUBLIC_AMPLITUDE_API_KEY` |

> **注意**：脚本直接渲染在 `<head>` 中。Microsoft Clarity 使用手动脚本（非 astro-analytics 组件）。
>
> **兼容说明**：`PUBLIC_CLARITY_PROJECT_ID` 优先级更高；`PUBLIC_CLARITY_ID` 作为向后兼容别名保留。


### SEO 与索引

主题集成了 SEO 插件：

**Robots.txt** - 通过 `astro-robots-txt` 自动生成。无需手动配置；使用你配置中的 `site.url`。

**IndexNow** - 即时搜索引擎索引。**默认关闭**。在 `src/constants.ts` 中启用：

```typescript
seo: {
  indexNow: true,              // 启用 IndexNow 集成（默认：false）
  indexNowKey: "your-api-key"  // 或设置 PUBLIC_INDEXNOW_KEY 环境变量
}
```

密钥文件会部署在 `/{key}.txt` 供搜索引擎验证。获取密钥请访问 [indexnow.org](https://www.indexnow.org)。
也可以通过环境变量覆盖：`PUBLIC_INDEXNOW_ENABLE=true` 与 `PUBLIC_INDEXNOW_KEY=...`。


> **注意**：IndexNow 会在每次构建时向搜索引擎发送请求。如果不需要即时索引功能，建议保持关闭。

**Sitemap** - 由 `@astrojs/sitemap` 自动生成。当 `llms.sitemap: true` 时包含 LLMs 文件。

## 集成的 Astro 插件

| 插件 | 用途 |
|------|------|
| `astro-robots-txt` | 自动生成带 sitemap 引用的 `robots.txt` |
| `astro-indexnow` | 向搜索引擎提交 URL 实现即时索引 |
| `astro-pagefind` | 构建时全文搜索索引 |
| `astro-llms-generate` | 生成供 AI/LLM 使用的 `llms.txt` |
| `astro-analytics` | 多服务统计分析（GA、Umami、Plausible、Clarity 等） |
| `@astrojs/sitemap` | XML sitemap 生成 |
| `@astrojs/partytown` | 将第三方脚本卸载到 Web Worker |
| `astro-mail-obfuscation` | 混淆 mailto 链接防止邮箱被采集 |
| `astro-embed` | YouTube、Twitter/X 等富媒体嵌入 |

### Partytown

将第三方脚本（分析、广告）迁移到 Web Worker 中执行，保持主线程响应。无需配置——只需像往常一样在 `<head>` 中添加脚本即可。

### 邮箱混淆

自动编码 `mailto:` 链接防止邮箱采集器。使用方式：

```markdown
如有咨询，请发邮件至 [contact@example.com](mailto:contact@example.com)。
```

插件在构建时编码邮箱地址，仅在用户点击时解码。

### 视频嵌入

使用 `astro-embed` 实现富媒体嵌入，或使用自定义组件实现全宽响应式视频：

```mdx
import YouTube from "../../components/embed/YouTube.astro";
import Bilibili from "../../components/embed/Bilibili.astro";

<YouTube id="VIDEO_ID" />
<Bilibili bvid="BV1234567890" />
```

两个组件都使用 `w-full aspect-video` 实现 16:9 响应式显示。

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Astro 6.0 |
| UI | Svelte 5 |
| 样式 | TailwindCSS 4 |
| 搜索 | 默认 Pagefind，可选 Algolia DocSearch |
| 代码高亮 | Expressive Code |
| 数学 | KaTeX |
| 图表 | Mermaid |
| OG 图片 | 单篇 `frontmatter.og` + 全站 `og.defaultImage` 回退 |
| SEO | astro-robots-txt, astro-indexnow |
| 过渡动画 | View Transitions API / Swup |
| 滚动条 | OverlayScrollbars |

## 脚本命令

| 命令 | 描述 |
|------|------|
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 构建 + 生成搜索索引 |
| `pnpm preview` | 本地预览构建结果 |
| `pnpm check` | Astro 诊断检查 |
| `pnpm type-check` | TypeScript 类型检查 |
| `pnpm new-post` | 从模板创建新文章 |

## 目录结构

```
KIRARI/
├── kirari.config.toml    # 可选 TOML 可读配置
├── src/

│   ├── components/       # UI 组件
│   ├── content/posts/    # 博客文章（Markdown）
│   ├── content/spec/     # 静态页面内容
│   ├── i18n/             # 翻译文件（10 种语言）
│   ├── layouts/          # 页面布局
│   ├── pages/            # 路由
│   │   └── rss.xml.ts           # RSS 订阅
│   ├── plugins/          # 自定义 rehype/remark 插件
│   ├── styles/           # CSS/Stylus
│   ├── utils/            # 工具函数（含环境变量读取工具）
│   ├── constants.ts      # 主配置文件
│   └── config.ts         # 配置模块导出

├── public/               # 静态资源
├── scripts/              # 构建脚本
└── _data/                # 数据文件（friends.json）
```

## 更新日志

参见 [CHANGELOG.md](./CHANGELOG.md) 了解版本历史。

## 致谢

本项目致敬以下项目：

- [saicaca/fuwari](https://github.com/saicaca/fuwari) - 原始主题
- [JoeyC-Dev/saicaca-fuwari](https://github.com/JoeyC-Dev/saicaca-fuwari) - 增强分支
- [ColdranAI/astro-llms-generate](https://github.com/ColdranAI/astro-llms-generate) - LLM 文档生成器

## 许可证

MIT
