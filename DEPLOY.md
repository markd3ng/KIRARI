# KIRARI 部署指南

> **读完本文你能做什么**：零基础将 KIRARI 博客部署到 Cloudflare Pages / Vercel / Netlify / EdgeOne Pages，绑定自定义域名，可选启用 GitHub Card 缓存代理。

**阅读耗时**：按步骤操作约 15 分钟（不含 DNS 生效等待）。

---

## 目录

1. [选择部署方式](#1-选择部署方式)
2. [Cloudflare Pages 部署（推荐）](#2-cloudflare-pages-部署推荐)
   - [2.1 一键部署](#21-一键部署30-秒)
   - [2.2 手动部署](#22-手动部署)
   - [2.3 部署后配置](#23-部署后配置)
   - [2.4 自定义域名](#24-自定义域名)
3. [附录 A：Cloudflare API Token 创建详解](#附录-acloudflare-api-token-创建详解)
4. [附录 B：GitHub Card 缓存代理部署（可选）](#附录-bgithub-card-缓存代理部署可选)
5. [其他平台部署](#5-其他平台部署)
6. [常见问题](#6-常见问题)

---

## 1. 选择部署方式

| 平台 | 免费额度 | 自定义域名 | 自动部署 | 构建限制 | 适用场景 |
|---|---|---|---|---|---|
| **Cloudflare Pages** | 无限带宽、500 次构建/月 | 支持 | Git Push 自动触发 | 每次构建 25 分钟 | 首选 |
| **Vercel** | 100GB 带宽/月 | 支持 | Git Push 自动触发 | 6000 分钟/月 | 备选 |
| **Netlify** | 100GB 带宽/月 | 支持 | Git Push 自动触发 | 300 分钟/月 | 备选 |
| **EdgeOne Pages** | 腾讯云免费额度 | 支持 | Git Push 自动触发 | - | 国内访问优选 |

> **建议**：没有特殊需求选 Cloudflare Pages。国内用户追求访问速度选 EdgeOne Pages。

---

## 2. Cloudflare Pages 部署（推荐）

### 前置条件

- [GitHub 账号](https://github.com/signup)（免费）
- [Cloudflare 账号](https://dash.cloudflare.com/sign-up)（免费，不需要绑信用卡）
- 你自己的域名（可选，也可以用 Cloudflare 提供的 `*.pages.dev` 域名）

---

### 2.1 一键部署（30 秒）

这是最快的方式。Cloudflare 会自动帮你 Fork 仓库、连接 Pages、配置构建设置。

#### 步骤

1. 点击下方按钮：

   [![Deploy to Cloudflare Pages](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/markd3ng/KIRARI)

2. 在弹出的页面中：
   - **GitHub 授权**：首次使用会要求授权 Cloudflare Pages 访问你的 GitHub 仓库，点击 "Authorize Cloudflare Pages"。
   - **选择 GitHub 账号**：选择你 Fork 仓库的目标账号（个人账号或组织）。
   - **仓库名**：保持默认的 `KIRARI`。

3. 点击 **"Begin Setup"**，Cloudflare 会自动完成以下操作：
   - 将 `KIRARI` Fork 到你的 GitHub 账号
   - 在 Cloudflare Pages 中创建新项目
   - 配置构建设置
   - 触发首次构建和部署

4. 等待 2-3 分钟，构建完成。你会看到部署成功的页面，URL 类似于：
   ```
   https://kirari-xxx.pages.dev
   ```

5. 点击链接访问你的博客（目前还是默认内容，接下来配置）。

> **注意**：一键部署使用的构建设置：
> - Framework preset: **None**（手动配置）
> - Build command: `pnpm build`
> - Build output directory: `dist`
> - Node.js 版本会自动从 `.nvmrc` 或 `package.json` 的 `engines` 字段检测。KIRARI 要求 Node.js ≥ 22。

---

### 2.2 手动部署

如果你想保留已经手动 Fork 的仓库，或者喜欢按步骤操作：

#### 步骤 1：Fork 仓库

1. 打开 https://github.com/markd3ng/KIRARI
2. 点击右上角 **Fork** → **Create fork**
3. 取消勾选 "Copy the `main` branch only"（保留所有分支）
4. 点击 **Create fork**

#### 步骤 2：连接 Cloudflare Pages

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 左侧菜单选择 **Workers & Pages** → 点击 **创建** → **Pages** → **连接到 Git**
3. 授权 Cloudflare 访问 GitHub，选择你刚 Fork 的 `KIRARI` 仓库
4. 点击 **Begin setup**

#### 步骤 3：配置构建设置

在 "Set up builds and deployments" 页面填写：

| 配置项 | 值 | 说明 |
|---|---|---|
| **Production branch** | `main` | 主分支，推送代码自动触发部署 |
| **Framework preset** | `None` | 不使用预设框架 |
| **Build command** | `pnpm build` | 完整构建：materialize → astro build → postbuild |
| **Build output directory** | `dist` | Astro 静态站点生成器的默认输出目录 |
| **Root directory** | （留空） | 项目根目录 |

> **为什么 Framework preset 选 "None"？** Cloudflare 预设的 Astro 框架配置可能使用旧版构建命令或输出目录。KIRARI 的构建流程包含 prebuild（GitHub Card 适配器生成）和 postbuild（缓存头、搜索索引、SEO 文件）自定义脚本，必须使用 `pnpm build`。

#### 步骤 4：设置 Node.js 版本

1. 点击页面下方的 **Environment variables (Advanced)**
2. 添加变量：

| 变量名 | 值 |
|---|---|
| `NODE_VERSION` | `22` |

> KIRARI 的 `engines` 字段和 `.npmrc` 已配置 pnpm，Cloudflare Pages 会自动检测并使用 pnpm 安装依赖。

#### 步骤 5：保存并部署

点击 **Save and Deploy**。首次构建耗时约 2-4 分钟。

构建过程你会看到的日志阶段：

```
1. Cloning repository...
2. pnpm install --frozen-lockfile    # 安装依赖
3. pnpm build                         # 完整构建
   ├── node scripts/materialize-ghc-adapter.mjs   # GitHub Card 适配器（默认跳过）
   ├── astro build                                  # Astro SSG 构建
   └── node scripts/postbuild.mjs                   # 后处理：headers, robots.txt, Pagefind, llms.txt
4. Deploying to Cloudflare's global network...
```

构建成功后访问 `https://你的项目名.pages.dev` 即可看到博客。

---

### 2.3 部署后配置

博客已上线，但需要把内容改成你自己的。

#### 核心文件修改清单

```bash
# 1. 克隆你的 Fork 仓库到本地
git clone https://github.com/你的用户名/KIRARI.git
cd KIRARI
pnpm install
```

按顺序修改以下文件：

| 序号 | 文件 | 修改内容 | 必须？ |
|---|---|---|---|
| 1 | `kirari.config.toml` | 设置 `site.url` 为你的域名、`site.title`、`profile.*`、`navBar.*` | **是** |
| 2 | `src/content/posts/` | 删除示例文章，添加你的 `.md` 文件 | **是** |
| 3 | `src/assets/images/` | 替换头像、Banner、Landing Hero 图 | 推荐 |
| 4 | `public/favicon/` | 替换网站图标 | 推荐 |
| 5 | `public/og/default.png` | 替换默认社交分享图 | 推荐 |
| 6 | `src/content/spec/about.md` | 修改"关于"页面 | 推荐 |

#### site.url 设置示例

```toml
# kirari.config.toml
[site]
# 如果你有自定义域名：
url = "https://blog.yourdomain.com"
# 如果使用 Cloudflare 默认域名：
url = "https://kirari-xxx.pages.dev"
title = "我的博客"
```

#### 推送更新

```bash
git add -A
git commit -m "chore: 个性化站点配置"
git push
```

每次 `git push` 到 `main` 分支，Cloudflare Pages 会自动重新构建和部署。

---

### 2.4 自定义域名

> 前提：域名已添加到 Cloudflare（在 Cloudflare Dashboard → **网站** → **添加站点**）。

#### 步骤

1. 进入你的 Pages 项目 → **自定义域** → **设置自定义域**
2. 输入你的域名（如 `blog.yourdomain.com`）
3. 点击 **继续**
4. Cloudflare 自动添加 DNS 记录。等待几分钟，SSL 证书自动签发
5. 更新 `kirari.config.toml` 中的 `site.url`：

   ```toml
   [site]
   url = "https://blog.yourdomain.com"
   ```

6. 提交并推送，触发重新部署

#### 如果你的域名不在 Cloudflare 托管

手动在你的 DNS 服务商添加一条 CNAME 记录：

| 类型 | 名称 | 目标 |
|---|---|---|
| CNAME | `blog`（你的子域名前缀） | `你的项目名.pages.dev` |

---

## 附录 A：Cloudflare API Token 创建详解

> **什么时候需要 API Token？**
>
> | 场景 | 需要 Token？ |
> |---|---|
> | 使用 Cloudflare Dashboard 一键部署 Pages | **不需要** |
> | 使用 Cloudflare Dashboard 连接 Git 仓库部署 Pages | **不需要** |
> | 使用 `wrangler` CLI 部署 Worker | **需要** |
> | 在 GitHub Actions CI/CD 中自动部署 Worker | **需要** |
> | 部署 GitHub Card 缓存代理（KIRARI-GHCard-Cache） | **需要** |

### A.1 创建 API Token（手把手）

#### 第 1 步：进入 API Token 页面

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 点击右上角头像图标 → **我的个人资料**（My Profile）
3. 左侧菜单选择 **API 令牌**（API Tokens）
4. 点击 **创建令牌**（Create Token）

#### 第 2 步：使用预设模板

你会看到几个预设模板。选择 **"编辑 Cloudflare Workers"**（Edit Cloudflare Workers）模板。

这个模板已经包含了部署 Worker 所需的大部分权限。如果你需要更精确的控制，选择 **"创建自定义令牌"**（Create Custom Token）。

#### 第 3 步：配置权限（自定义令牌方式）

如果你选择自定义令牌，以下是 KIRARI 相关场景需要的精确权限。

**场景 A：仅部署 GHCard-Cache Worker（通过 wrangler）**

| 权限类别 | 权限名称（Dashboard 中的显示名） | 级别 |
|---|---|---|
| **Account** | `Workers Scripts:Edit` | 编辑（Edit） |
| **Account** | `Workers KV Storage:Edit` | 编辑（Edit） |
| **Account** | `Workers Tail:Read` | 读取（Read） |
| **Account** | `Account Settings:Read` | 读取（Read） |

> `Account Settings:Read` 是 wrangler 验证登录状态需要的。没有这个权限，`wrangler whoami` 会失败。

**场景 B：完整权限（同时管理 Pages + Workers）**

| 权限类别 | 权限名称 | 级别 |
|---|---|---|
| **Account** | `Cloudflare Pages:Edit` | 编辑（Edit） |
| **Account** | `Workers Scripts:Edit` | 编辑（Edit） |
| **Account** | `Workers KV Storage:Edit` | 编辑（Edit） |
| **Account** | `Workers Tail:Read` | 读取（Read） |
| **Account** | `Account Settings:Read` | 读取（Read） |

**场景 C：最小化权限（最安全，仅部署 Worker）**

| 权限类别 | 权限名称 | 级别 |
|---|---|---|
| **Account** | `Workers Scripts:Edit` | 编辑（Edit） |
| **Account** | `Workers KV Storage:Edit` | 编辑（Edit） |
| **Account** | `Account Settings:Read` | 读取（Read） |

> 这是 wrangler deploy + KV namespace 的最小权限组合。不含 `Workers Tail:Read`（无法查看实时日志）。

#### 第 4 步：设置账户和区域范围

- **账户资源（Account Resources）**：选择 "所有账户" 或指定你的 Cloudflare 账户
- **区域资源（Zone Resources）**：选择 "所有区域" 或仅限特定域名

> 最小权限原则：如果你只有一个 Cloudflare 账户，选择"所有账户"没问题。如果管理多个客户/项目，选择具体的账户和区域。

#### 第 5 步：设置有效期

- TTL（生存时间）：从安全角度，建议设置到期日（如 6 个月或 1 年）
- 如果你在 CI/CD 中使用，可以设置更长的时间或选择"永不过期"（需要定期轮换）

#### 第 6 步：创建并保存

1. 点击 **继续以显示摘要** → **创建令牌**（Create Token）
2. **立即复制 Token 值！** 离开此页面后 Token 将不再显示
3. 保存到密码管理器或安全位置

#### 第 7 步：使用 Token

**本地开发**：
```bash
# 临时使用（仅当前终端窗口有效）
export CLOUDFLARE_API_TOKEN="你复制的那串字符"

# 验证
npx wrangler whoami
```

**GitHub Actions**：
1. 进入你的 GitHub 仓库 → **Settings** → **Secrets and variables** → **Actions**
2. 点击 **New repository secret**
3. Name 填 `CLOUDFLARE_API_TOKEN`，Value 填 Token 值
4. 同样添加 `CLOUDFLARE_ACCOUNT_ID`

> **如何获取 Account ID？**
> 登录 Cloudflare Dashboard，右侧菜单底部 → **Workers & Pages** → 右侧面板中的 **Account ID**。或者直接访问 `https://dash.cloudflare.com/你的账户ID`，URL 中的 32 位十六进制字符串就是。

### A.2 权限速查表

| Cloudflare Dashboard 权限名称 | 允许的操作 |
|---|---|
| `Workers Scripts:Edit` | 创建、修改、删除、部署 Worker 脚本 |
| `Workers KV Storage:Edit` | 创建、修改、删除 KV 命名空间和键值 |
| `Workers Tail:Read` | 查看 Worker 实时日志（`wrangler tail`） |
| `Cloudflare Pages:Edit` | 创建、编辑、删除 Pages 项目，触发部署 |
| `Account Settings:Read` | 读取账户信息（wrangler 登录验证需要） |

### A.3 常见 Token 问题

| 症状 | 原因 | 解决方案 |
|---|---|---|
| `wrangler whoami` 报错 `Authentication error` | Token 缺少 `Account Settings:Read` | 重新创建 Token，确权勾选该项 |
| `wrangler deploy` 报 `workers.api.error.insufficient_permissions` | Token 缺少 `Workers Scripts:Edit` | 补充该权限或使用 "Edit Cloudflare Workers" 模板 |
| `wrangler kv:namespace create` 报权限不足 | Token 缺少 `Workers KV Storage:Edit` | 补充该权限 |
| GitHub Actions 中 wrangler 报认证错误 | `CLOUDFLARE_API_TOKEN` 未设置或值错误 | 检查 Secrets 名称和值是否正确，注意不要有多余空格 |
| Token 泄露/丢失 | — | 立即在 Cloudflare Dashboard → API Tokens 中撤销该 Token，重新创建 |

---

## 附录 B：GitHub Card 缓存代理部署（可选）

> **什么时候需要这个？**
>
> 你的博客文章中使用了 `::github{repo="owner/repo"}` 或 `::githubfile{}` 指令。
> 不部署缓存代理也能用，但建议生产环境部署以：
> - 避免 GitHub API 匿名 60 次/小时的频率限制
> - 减少跨区域请求延迟
> - 保护你的 GitHub 用量配额

### B.1 架构说明

```
浏览器 → KIRARI Pages → Pages Function（/ghc/*）→ Service Binding → GHCard-Cache Worker → GitHub API
                                                                    ↑ 含 KV 缓存
```

- **KIRARI Pages Function**：由 KIRARI 项目 `materialize-ghc-adapter.mjs` 自动生成（`functions/ghc/[[path]].ts`）
- **GHCard-Cache Worker**：独立部署的缓存代理 Worker（项目地址：`KIRARI-GHCard-Cache`）
- **Service Binding**：Cloudflare Pages 到 Worker 的内部通道，请求不经过公网
- **KV 存储**：Worker 的二级缓存（L1 为 Cache API），提供 stale 兜底

### B.2 部署 GHCard-Cache Worker

#### 前置条件

- 已完成 [附录 A](#a2-权限速查表) 中的 Cloudflare API Token 创建（需要 `Workers Scripts:Edit` + `Workers KV Storage:Edit`）

#### 步骤 1：Clone 并安装

```bash
git clone https://github.com/markd3ng/KIRARI-GHCard-Cache.git
cd KIRARI-GHCard-Cache
pnpm install
```

#### 步骤 2：生成 TypeScript 类型

```bash
pnpm cf:types
```

> 这一步会调用 `wrangler types` 生成 Cloudflare 环境绑定（KV、环境变量等）的 TypeScript 类型定义。

#### 步骤 3：创建 KV 命名空间

```bash
# 创建 KV 命名空间
pnpm wrangler kv namespace create GITHUB_CACHE
```

输出示例：
```
Add the following to your configuration file in your kv_namespaces array:
{ binding = "GITHUB_CACHE", id = "abc123def456..." }
```

**复制输出的 `id` 值**（那一长串十六进制字符串）。

#### 步骤 4：写入 KV ID 到配置

打开 `wrangler.jsonc`，找到 `kv_namespaces` 部分：

```jsonc
"kv_namespaces": [
  {
    "binding": "GITHUB_CACHE",
    "id": "<production-kv-id>"   // ← 替换这里
  }
]
```

将 `<production-kv-id>` 替换为步骤 3 复制的那串 ID。

#### 步骤 5：（推荐）设置 GitHub Token

> **可选但强烈推荐**。不设置 Token 的话，Worker 以匿名模式访问 GitHub API（60 次/小时限制）。设置了 Token 后提升到 5,000 次/小时。

1. 创建 GitHub Personal Access Token（classic）：
   - 打开 https://github.com/settings/tokens
   - 点击 **Generate new token** → **Generate new token (classic)**
   - Note 填 `KIRARI-GHCard-Cache`
   - 过期时间选 "No expiration"（或按需设置）
   - **不需要勾选任何权限**（只需要公开仓库的读取权限，classic token 默认即可读取公开仓库）
   - 点击 **Generate token**，复制 Token 值

2. 将 Token 设置为 Worker Secret：

   ```bash
   pnpm wrangler secret put GITHUB_TOKEN
   ```

   粘贴 Token 后按 Enter。**Token 不会显示在屏幕或配置文件中。**

#### 步骤 6：（生产推荐）配置 CORS 白名单

编辑 `wrangler.jsonc` 中的 `vars`：

```jsonc
"vars": {
  "CACHE_NAMESPACE_VERSION": "v1",
  "PUBLIC_BASE_URL": "https://kirari-ghcard-cache.你的子域名.workers.dev/api/github",
  "ALLOWED_ORIGINS": "https://blog.yourdomain.com",
  "PREWARM_TARGETS": ""
}
```

| 变量 | 说明 | 是否必须 |
|---|---|---|
| `ALLOWED_ORIGINS` | 允许跨域调用 Worker 的域名，逗号分隔 | 生产环境建议设置。KIRARI Pages 通过 Service Binding 调用（不走 Origin），但浏览器直接请求会检查 Origin |
| `PUBLIC_BASE_URL` | Worker 的公网 URL，用于 cron 预热时改写头像 URL | 如果启用了 cron 预热，必须设置 |
| `PREWARM_TARGETS` | 定时预热目标，格式：`repo:owner/repo,avatar:owner` | 可选，格式参考 `.env.example` |

#### 步骤 7：验证

```bash
# 类型检查
pnpm type-check

# 运行测试
pnpm test

# 干运行（不实际部署，验证配置是否正确）
pnpm deploy:dry
```

#### 步骤 8：部署

```bash
pnpm deploy
```

部署成功后输出：
```
Current Deployment ID: xxx
Deployed kirari-ghcard-cache
  https://kirari-ghcard-cache.你的子域名.workers.dev
```

#### 步骤 9：验证 Worker 是否正常

```bash
# 替换为你的 Worker URL
curl https://kirari-ghcard-cache.你的子域名.workers.dev/healthz
```

预期输出：
```json
{"ok":true,"service":"kirari-ghcard-cache"}
```

### B.3 配置 Pages Service Binding

> 将 Pages 项目连接到刚部署的 Worker，使 KIRARI 的 GitHub Card 请求通过缓存代理。

#### 步骤

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages**
2. 选择你的 KIRARI Pages 项目
3. 点击 **Settings** → **Functions** → **Bindings** → **Add binding**
4. 选择 **Service binding**
5. 填写：

   | 字段 | 值 |
   |---|---|
   | **Variable name** | `GHCARD_CACHE` |
   | **Service** | `kirari-ghcard-cache`（你部署的 Worker 名称） |
   | **Environment** | `Production` |

6. 点击 **Add binding**
7. **重新部署 Pages 项目**（点击页面上的 "Retry deploy" 或推送一个新 commit）

### B.4 启用 KIRARI 的 GitHub Card 适配器

编辑 `kirari.config.toml`：

```toml
[githubCard]
# GitHub 卡片 API 基础路径 — 改为同源 /ghc 路由
apiBase = "/ghc"

[githubCard.adapter]
# 启用同源运行时适配器
enabled = true
# Cloudflare Pages 平台
provider = "cloudflare"
# 适配器路由
route = "/ghc"
# Service Binding 名称（与 B.3 中的 Variable name 一致）
serviceBinding = "GHCARD_CACHE"
```

提交并推送：

```bash
git add kirari.config.toml
git commit -m "feat: 启用 GitHub Card 缓存代理"
git push
```

### B.5 验收清单

部署完成后逐一验证：

```bash
# 1. 健康检查
curl -i https://你的域名/ghc/healthz
# 预期: {"ok":true,"service":"kirari-ghcard-cache"}

# 2. 仓库卡片
curl -i https://你的域名/ghc/repos/markd3ng/KIRARI
# 预期: 返回仓库 JSON，响应头包含 X-Cache

# 3. 头像缓存
curl -I https://你的域名/ghc/avatar/markd3ng?size=96
# 预期: 返回 200，Content-Type 为 image/png

# 4. 浏览器验证
# 打开一篇包含 ::github{} 卡片的文章
# 在 DevTools Network 面板确认请求走同源 /ghc/* 而非 api.github.com
```

### B.6 回滚到直连 GitHub

如果缓存代理出现问题，可以快速回退：

```toml
# kirari.config.toml
[githubCard]
apiBase = "https://api.github.com"

[githubCard.adapter]
enabled = false
provider = "none"
```

提交推送后立即生效，无需删除 Worker。

---

## 5. 其他平台部署

### GitHub Pages

GitHub Pages 适合纯静态部署。推荐使用 GitHub Actions 构建并上传 `dist/`
产物，不要直接发布源码目录。

关键配置：
- Build Command: `pnpm build`
- Artifact Directory: `dist`
- Node.js 版本: `22`
- Package manager: `pnpm install --frozen-lockfile`

如果站点部署在仓库子路径，例如 `https://user.github.io/repo/`，需要在
`kirari.config.toml` 中设置：

```toml
[site]
base = "/repo/"
```

如果使用自定义域名，例如 `https://example.com/`，保持 `site.base = "/"`，并在
GitHub Pages 设置中绑定域名。Pagefind、RSS、sitemap、LLMs 文件和 GitHub Card
缓存 materialize 都由 `pnpm build` 生成，因此 Actions 应部署完整 `dist/`。

最小 Actions 示例：

```yaml
name: Deploy GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

GitHub Pages 不读取 `dist/_headers`，所以无法直接应用 `/_astro/*` immutable
缓存规则；如果强依赖精细缓存控制，建议前置 Cloudflare 或其他 CDN。

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/markd3ng/KIRARI)

一键部署配置：
- Framework: **Other**（或手动选择 Astro）
- Build Command: `pnpm build`
- Output Directory: `dist`
- Install Command: `pnpm install --frozen-lockfile`

Vercel 会自动检测 `.npmrc` 中的包管理器设置。部署后的域名格式为 `项目名.vercel.app`。

### Netlify

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/markd3ng/KIRARI)

一键部署配置：
- Build Command: `pnpm build`
- Publish Directory: `dist`

> **Netlify 注意**：需要在 Netlify 项目设置中将 Node.js 版本设为 22+。

### EdgeOne Pages（腾讯云）

[![Deploy with EdgeOne Pages](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?repository=https://github.com/markd3ng/KIRARI)

适合面向中国大陆读者的博客，国内访问速度最优。

一键部署配置：
- 框架预设: **None**
- 构建命令: `pnpm build`
- 输出目录: `dist`
- Node.js 版本: `22`

---

## 6. 常见问题

### 构建失败

| 错误 | 原因 | 解决 |
|---|---|---|
| `pnpm: command not found` | Cloudflare Pages 未识别 pnpm | 确认项目根目录有 `.npmrc` 文件且包含 `package-manager=pnpm` |
| `preinstall hook blocks npm/yarn` | 使用了 npm 而非 pnpm 安装 | 这是预期行为，KIRARI 强制使用 pnpm。在 Cloudflare Pages 构建设置中确保使用 pnpm |
| `ENOENT: no such file or directory ... kirari.config.toml` | 配置文件缺失 | 从 `kirari.config.toml` 的备份恢复，不要删除此文件 |
| `error during build: RollupError` | 依赖版本冲突 | 运行 `pnpm install --frozen-lockfile` 而非 `pnpm install` |
| 构建超时（超过 25 分钟） | 首次构建安装依赖耗时较长 | Cloudflare Pages 免费版限制 25 分钟，通常够用。如果超时，参考下方"构建速度优化" |

### 构建速度优化

Cloudflare Pages 首次构建通常 2-4 分钟。如果遇到超时：

1. **不要勾选 "使用系统安装的 Node"**——Cloudflare 构建环境的默认版本可能不兼容
2. 在环境变量中添加 `NODE_VERSION=22`
3. 如果仓库很大（含许多图片），考虑将图片放到 CDN 而非仓库

### 部署成功但页面空白或不正常

| 症状 | 排查步骤 |
|---|---|
| 首页正常，子页面 404 | 检查是否有自定义域名的 CNAME 配置正确；Cloudflare Pages 默认支持 SPA 路由 |
| 全部页面 404 | 检查 `site.base` 配置。默认应为 `"/"`，不要改成别的值除非你部署在子目录 |
| 搜索不工作 | 确认构建日志中有 Pagefind 索引步骤。检查 `search.provider` 是否设为 `"pagefind"`（默认值） |
| 多语言切换不生效 | 检查 `i18n.enable = true`；确认文章 frontmatter 中有 `lang` 字段 |

### 如何更新 KIRARI 版本

```bash
# 在本地 KIRARI 目录
git remote add upstream https://github.com/markd3ng/KIRARI.git
git fetch upstream
git merge upstream/main

# 解决可能的冲突后
pnpm install --frozen-lockfile
pnpm build   # 验证构建成功
git push
```

### 如何在不提交到 Git 的情况下设置敏感配置

所有 `kirari.config.toml` 中的配置项都有对应的环境变量覆盖。在 Cloudflare Pages Dashboard 中设置：

**Pages 项目 → Settings → Environment variables → Production**

| 变量名 | 对应 TOML 配置 | 示例值 |
|---|---|---|
| `PUBLIC_SITE_URL` | `site.url` | `https://blog.yourdomain.com` |
| `PUBLIC_SITE_TITLE` | `site.title` | `我的博客` |
| `PUBLIC_SITE_BASE` | `site.base` | `/` |
| `PUBLIC_GOOGLE_ANALYTICS_ID` | `analytics.googleAnalyticsId` | `G-XXXXXXXXXX` |
| `PUBLIC_UMAMI_ID` | `analytics.umami.id` | `xxxx-xxxx-xxxx` |

> **优先级规则**：环境变量 > `kirari.config.toml` > `src/constants.ts` 默认值。

### Vercel 部署遇到 "Root Directory" 相关错误

Vercel 的 Root Directory 默认是 `/`。如果你遇到找不到 `package.json` 的错误：
- Vercel 项目设置 → General → Root Directory → 保持为 `./`

---

## 文档导航

| 文档 | 内容 |
|---|---|
| [README.md](./README.md) | 架构、技术栈、配置参考（英文） |
| [README_CN.md](./README_CN.md) | 架构、技术栈、配置参考（中文） |
| [SECURITY_MODEL.md](./SECURITY_MODEL.md) | 安全模型 |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | 贡献指南 |
| [CHANGELOG.md](./CHANGELOG.md) | 变更日志 |
