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
- **多语言** - 支持 10 种语言（en、zh_CN、zh_TW、ja、ko、es、th、vi、tr、id）
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

所有设置集中在 **`src/constants.ts`** 中：

```typescript
export const Config = {
  site: {
    url: "https://your-domain.com",
    title: "你的站点",
    subtitle: "你的标语",
    lang: "zh_CN",
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
    name: "你的名字",
    bio: "你的简介",
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
    title: "你的站点",
    description: "站点描述",
    i18n: true
  }
}
```

OG 说明：
- 文章 OG 图片不再通过动态路由生成，改为直接按元数据选择。
- 优先级：`frontmatter.og` > `og.defaultImage`。
- 当 `frontmatter.og` 为空时，回退到 `og.defaultImage`（例如 `/og/default.png`）。

### 环境变量

你可以通过环境变量覆盖配置值，而无需修改 `src/constants.ts`。这在以下场景很有用：
- 不同环境使用不同配置（开发/测试/生产）
- CI/CD 部署时无需修改代码
- 保持测试/本地配置与生产配置分离

**在项目根目录创建 `.env.local`：**

```bash
# 站点配置
PUBLIC_SITE_URL=https://your-domain.com
PUBLIC_SITE_TITLE=你的站点
PUBLIC_SITE_SUBTITLE=你的标语

# 横幅署名
PUBLIC_BANNER_CREDIT_ENABLE=false
PUBLIC_BANNER_CREDIT_TEXT=
PUBLIC_BANNER_CREDIT_URL=

# Microsoft Clarity 统计（可选）
PUBLIC_CLARITY_PROJECT_ID=
```

**不同环境的使用方式：**

| 环境 | 配置方式 |
|------|----------|
| 本地开发 | 创建 `.env.local`（已在 .gitignore 中） |
| Vercel/Netlify 等 | 在控制台设置环境变量 |
| 默认回退 | 使用 `src/constants.ts` 中的值 |

> **注意**：`.env.local` 已在 `.gitignore` 中，你的本地覆盖配置不会被提交。


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
lang: zh_CN              # 语言代码
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

### SEO 与索引

主题集成了 SEO 插件：

**Robots.txt** - 通过 `astro-robots-txt` 自动生成。无需手动配置；使用你配置中的 `site.url`。

**IndexNow** - 即时搜索引擎索引。在 `src/constants.ts` 中配置：

```typescript
seo: {
  indexNowKey: "your-api-key"  // 或设置 PUBLIC_INDEXNOW_KEY 环境变量
}
```

密钥文件会部署在 `/{key}.txt` 供搜索引擎验证。获取密钥请访问 [indexnow.org](https://www.indexnow.org)。

**Sitemap** - 由 `@astrojs/sitemap` 自动生成。当 `llms.sitemap: true` 时包含 LLMs 文件。

## 集成的 Astro 插件

| 插件 | 用途 |
|------|------|
| `astro-robots-txt` | 自动生成带 sitemap 引用的 `robots.txt` |
| `astro-indexnow` | 向搜索引擎提交 URL 实现即时索引 |
| `astro-pagefind` | 构建时全文搜索索引 |
| `astro-llms-generate` | 生成供 AI/LLM 使用的 `llms.txt` |
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
| 搜索 | Pagefind（通过 astro-pagefind） |
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
│   ├── utils/            # 工具函数
│   ├── constants.ts      # 主配置文件
│   └── config.ts         # 类型导出（请勿编辑）
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
