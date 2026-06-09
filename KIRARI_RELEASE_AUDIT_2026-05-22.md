# KIRARI 发版前工程治理审计报告

审计日期：2026-05-22  
审计分支：`dev`  
审计提交：`8b65916`  
审计范围：当前 `dev` 分支发版前状态，重点覆盖最近的 Astro 6.3.6、依赖安全、TOML-first 配置治理、Custom Head/Footer snippets、Google Search provider、Google Indexing API、IndexNow、Public Repo hygiene、AI 上下文与文档同步。

## 一、执行摘要

| 项目 | 结论 |
|---|---|
| 总体风险等级 | Low |
| 是否建议发版 | 可以发版 |
| 阻塞发版问题 | 0 |
| Critical / High | 0 |
| Medium | 1 |
| Low / Info | 3 |
| 最大安全风险 | Custom Head/Footer 与 snippets 使用 `set:html`，但信任边界已文档化，默认配置未启用 |
| 最大架构风险 | 少数页面级初始化仍同时使用 `DOMContentLoaded` + `transitionManager`，与 AGENTS 的强约束不完全一致 |
| 最大外部服务风险 | Google Programmable Search / Google Indexing API 依赖外部网络、政策和账号配置 |
| Public Repo 风险 | 未发现已追踪构建产物或明显 secret |

结论：当前状态满足发版前基本工程质量要求。验证链路全部通过，依赖 audit 无已知漏洞，仓库 hygiene 检查干净。建议可以发版；发版后短期处理 `DOMContentLoaded` 治理一致性问题。

## 二、验证证据

| 验证项 | 结果 |
|---|---|
| `pnpm install --frozen-lockfile` | 通过，lockfile up to date |
| `pnpm type-check` | 通过 |
| `pnpm astro check` | 通过，84 files，0 errors / 0 warnings / 0 hints |
| `pnpm build` | 通过，Astro static build 80 pages，Pagefind indexed 23 pages |
| `pnpm audit --audit-level moderate` | 通过，No known vulnerabilities found |
| `git diff --check` | 通过 |
| 过时文档关键字检查 | 通过，无 `client:load` / `ENV > TOML` / `Google JSON API` 等命中 |
| Public repo tracked artifact 检查 | 通过，无 `.DS_Store` / `dist` / `.astro` / `node_modules` / `.workbuddy` 等被追踪 |
| Secret pattern 扫描 | 无真实 secret 命中；仅 `scripts/postbuild.mjs` 中解析 service account private key 的代码正则误报 |

## 三、关键改动审计

### 1. 依赖与安全

- `astro` 固定为 `6.3.6`。
- `svelte` 为 `^5.55.9`。
- `mermaid` 为 `^11.15.0`。
- `sanitize-html` 为 `^2.17.4`。
- `pnpm.overrides` 固定 `devalue@5.8.1` 与 `yaml@2.9.0`。
- `pnpm audit --audit-level moderate` 无已知漏洞。

结论：依赖安全状态满足发版要求。

### 2. TOML-first 配置治理

- 文档已明确普通配置进入 `kirari.config.toml`。
- `.ts` 文件定位为内部类型、默认值、校验和加载实现。
- env 已收敛为密钥、部署差异和服务凭据用途。
- `.env.example` 已移除普通站点配置示例，仅保留 analytics、IndexNow、Google Indexing API 等更适合 env 的字段。

结论：治理方向正确，复杂度比三入口配置更低。当前仍保留旧 `PUBLIC_*` 覆盖兼容，这是合理的渐进迁移。

### 3. 搜索 Provider

- 新增 `search.provider = "pagefind" | "docsearch" | "google"`。
- 默认 `pagefind` 保持本地静态搜索。
- `docsearch` 和 `google` provider 会跳过 Pagefind 生成与加载。
- Google 无广告模式使用 Programmable Search Element callbacks，结果映射回 KIRARI 现有结果卡片风格。
- Google AdSense 模式保留 Google 官方结果区，避免隐藏或改写广告/Google 标识。
- 未引入 Google Custom Search JSON API，因此没有新增 API key 和配额/费用复杂度。

结论：搜索治理符合 SSG-first 和 Astro Islands 边界；Search 仍为 `client:idle`，未 SPA 化。

### 4. SEO / IndexNow / Google Indexing

- IndexNow 继续走 `https://api.indexnow.org/indexnow` 通用 endpoint。
- 文档已说明 IndexNow 覆盖 Bing、Yandex、Naver、Seznam.cz、Yep 等参与方，不覆盖 Google。
- 新增 `seo.google.indexingApi`，默认关闭。
- Google service account JSON 仅从 `seo.google.serviceAccountJsonEnv` 指定的私有 env 读取。
- Google Indexing API 缺 env、凭据无效、提交失败都只 warning，不阻断 build。
- 文档已说明 Google Indexing API 主要面向 JobPosting / BroadcastEvent，普通博客不保证收益。

结论：索引治理边界清楚，默认安全。

### 5. Public Repo Hygiene

- 当前只有 ignored 本地产物：`.DS_Store`、`.astro/`、`.workbuddy/`、`dist/`、`node_modules/`。
- 未发现上述本地/构建/AI 临时产物被 git 追踪。
- 未发现真实 token、私钥或 service account JSON 泄露。
- `.env.example` 不包含真实 secret。

结论：公开仓库 hygiene 满足发版要求。

### 6. 文档与 AI 上下文

- `AGENTS.md`、`AI_CONTEXT.md`、`SECURITY_MODEL.md`、`CONTRIBUTING.md` 已同步 TOML-first、搜索/SEO provider 和 `set:html` 信任边界。
- README / README_CN 已同步 Pagefind / DocSearch / Google provider、AdSense 模式、IndexNow 支持范围。
- 文档过时关键字检查无命中。

结论：AI 协作上下文已足够支撑后续维护。

## 四、风险清单

### R1. 页面级初始化仍存在 `DOMContentLoaded` 路径

| 字段 | 内容 |
|---|---|
| 风险等级 | Medium |
| 是否阻塞发版 | 否 |
| 涉及文件 | `src/pages/posts/[...slug].astro`、`src/pages/[lang]/posts/[...slug].astro`、`src/plugins/rehype-component-github-file-card.mjs` |
| 说明 | 这些路径同时注册了 `DOMContentLoaded` 和 `transition:after-swap`。实际功能有 transition fallback，因此不是立刻失效；但 AGENTS 约束写的是 post-navigation DOM init 必须注册在 `transitionManager`，不要依赖 `DOMContentLoaded`。 |
| 影响 | 长期看会让 AI/维护者误以为双路径模式是推荐实践，削弱 transition governance。 |
| 建议 | 发版后短期把这些初始化统一包装成 transition-manager 约定模式；若 hard load 需要立即执行，应由 transition manager 提供统一 ready/after-swap API，而不是散落在页面脚本里。 |

### R2. Google Programmable Search 无法在本地完全验证真实结果/广告

| 字段 | 内容 |
|---|---|
| 风险等级 | Low |
| 是否阻塞发版 | 否 |
| 说明 | 当前验证覆盖类型、构建、provider 跳过 Pagefind 行为；真实 Google 结果与 AdSense 展示依赖有效 `cx`、Google 网络、PSE/AdSense 配置和 Google 政策。 |
| 建议 | 发版前如果已有真实 `cx`，用 preview 环境手动验一次搜索浮层、结果渲染、AdSense 模式是否符合预期。 |

### R3. Google Indexing API 属于高级可选能力

| 字段 | 内容 |
|---|---|
| 风险等级 | Low |
| 是否阻塞发版 | 否 |
| 说明 | 默认关闭。启用后需要正确 service account、站点权限和 Google 支持的内容类型。普通博客页面可能没有实际收益。 |
| 建议 | 保持默认关闭；若后续启用，先在 staging 用少量 URL 验证 Google API 响应。 |

### R4. 旧 `PUBLIC_*` 覆盖仍保留兼容

| 字段 | 内容 |
|---|---|
| 风险等级 | Info |
| 是否阻塞发版 | 否 |
| 说明 | 文档已改为 TOML-first，但代码仍保留旧 env 覆盖，避免破坏性迁移。这是合理的兼容策略。 |
| 建议 | 后续可做一次 deprecation plan：标记普通配置类 `PUBLIC_SITE_*`、`PUBLIC_DOCSEARCH_*` 不再推荐，最终按 major/minor 版本决定是否移除。 |

## 五、发版建议

建议：**可以发版**。

发版前建议确认：

1. 如需启用 Google Programmable Search，先在 `kirari.config.toml` 配置真实 `search.google.cx`。
2. 如需 AdSense 搜索广告，确保 Google Programmable Search Engine / AdSense 后台已关联，并使用 `adsense = true`。
3. 不建议本次发版启用 `seo.google.indexingApi`，除非已有明确 Google service account、站点权限和适用内容类型。
4. 发版后第一个维护任务建议处理 `DOMContentLoaded` 与 transitionManager 的治理一致性。

## 六、后续路线图

### 立即处理

- 无阻塞项。

### 短期处理

- 统一页面级 DOM 初始化到 transition manager 约定。
- 用真实 Google PSE `cx` 在 preview 环境做一次人工验收。
- 如启用 AdSense 模式，检查结果区是否保留 Google 官方广告和标识。

### 中期优化

- 为 `search.provider` 增加最小集成测试或 fixture build 测试。
- 将 search provider 选择逻辑抽成共享 helper，减少 `Navbar`、`Layout`、`postbuild` 的重复判断。
- 对普通配置类 `PUBLIC_*` 制定 deprecation 文档。

### 长期治理

- 建立 release checklist 文档，固化验证命令、Public Repo hygiene、secret scan、preview 手测项。
- 增加 AI release audit checklist，防止后续误改 hydration、Pagefind/provider、IndexNow/Google indexing 边界。
