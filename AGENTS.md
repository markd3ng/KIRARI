<!-- skilld -->
Before modifying code, check .agents/skills/ for relevant skills.
Read the SKILL.md for any matching package before proceeding.
<!-- /skilld -->

# KIRARI 开发规范

## 架构不可变规则

### Astro Islands

| 组件类型 | 实现方式 | Hydration 指令 |
|----------|---------|---------------|
| 静态展示（文章卡片、导航、布局） | `.astro` | 无 |
| 搜索 | Svelte `Search.svelte` | `client:load` |
| 主题切换/色相选择器 | Svelte `ThemeToggle.svelte` / `DisplaySettings.svelte` | `client:load` / `client:only` |

`client:only` 仅限读取 `localStorage` 的纯客户端组件。不允许用于含有 SEO 内容的组件。

### 页面过渡系统

所有 DOM 初始化逻辑必须挂载到 `TransitionManager`，禁止裸用 `DOMContentLoaded`：

```ts
import { transitionManager } from "@utils/transition-manager";

// 正确
transitionManager.on("transition:after-swap", init);

// 错误 — 仅在硬加载时触发
document.addEventListener("DOMContentLoaded", init);
```

原因：KIRARI 在支持 View Transitions API 的浏览器中使用 Astro `ClientRouter`，在不支持的浏览器中动态加载 Swup。两种路径下页面切换都是 SPA 风格，`DOMContentLoaded` 不会再次触发。

`TransitionManager` 单例暴露四个统一事件：`transition:start`、`transition:before-swap`、`transition:after-swap`、`transition:end`。Swup 模式下事件映射：`visit:start` → `start`，`content:replace` → `before-swap`，`page:view` → `after-swap`，`visit:end` → `end`。

### 配置驱动

```
kirari.config.toml → smol-toml 解析 → config-loader.ts → Config 对象
                                                              ↓
环境变量（PUBLIC_*）─────────────┘         astro.config.mjs、各组件通过 @constants 导入
```

- **禁止**在组件中硬编码可配置值。
- 新增配置字段必须：`kirari.config.toml`（含注释）→ `src/types/config.ts`（类型）→ `src/utils/config-loader.ts`（解析 + 默认值）。
- 配置加载时对每个字段做运行时类型守卫（`getString`、`getBoolean`、`getNumber`、`getStringArray`）。

### 样式

| 层级 | 技术 | 用途 |
|------|------|------|
| 组件外观 | Tailwind CSS v4 | 布局、间距、颜色、响应式 |
| Markdown 编译产物 | Stylus (`markdown-extend.styl`) | 深层 DOM 结构（admonitions、GitHub cards、KaTeX 渲染输出） |
| 代码高亮 | Expressive Code + CSS 变量 | 通过 `styleOverrides` 注入主题变量 |

不要在组件中写 Stylus，不要在 `markdown-extend.styl` 中写组件样式。

## 开发工作流

### 提交前清单

```bash
pnpm type-check    # tsc --noEmit
pnpm astro check   # .astro 模板类型检查
pnpm build         # 完整构建（materialize → astro → postbuild）
```

### Conventional Commits

```
feat(scope): 描述
fix(scope): 描述
docs: 描述
chore: 描述
```

一事一交。以下类型可用：`feat`、`fix`、`docs`、`style`、`refactor`、`perf`、`chore`、`test`。

### CI/CD

- 必须使用 `pnpm install --frozen-lockfile`
- `@astrojs/check` 是 devDependency，CI 中通过 `pnpm astro check` 调用

### 边缘兼容

- 客户端或边缘 Functions 代码不得依赖 Node.js 原生模块（`fs`、`path`、`crypto` 等）
- 如果引入 Cloudflare D1/KV：查询必须参数化，KV 必须明确生命周期

## 性能基准

- Lighthouse Performance ≥ 95
- `@iconify-json` 包被 Vite 插件完全阻止 — 仅 `astro.config.mjs` 中注册的图标被打包
- 第三方脚本（analytics）仅在 `PROD && analytics.enable` 条件下加载
- `prefetchAll: false`；导航 hover 预取，移动端 tap 预取
