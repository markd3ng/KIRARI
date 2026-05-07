<!-- skilld -->
Before modifying code, check .agents/skills/ for relevant skills.
Read the SKILL.md for any matching package before proceeding.
<!-- /skilld -->

# KIRARI 项目开发规范与审计基准

## 1. 核心技术栈定位与基准

本项目是一个高度集成化、侧重内容展示与极速体验的现代化 Web 应用。基于 **Astro 6** 框架构建，前端交互由 **Svelte 5** 驱动，样式引擎采用 **Tailwind CSS v4** 配合 **Stylus**，并针对 **Cloudflare Pages / Workers (含 D1/KV)** 等边缘网络环境进行了深度优化。

本规范为最高基准，任何 AI Agent 和人工开发必须严格遵循。

### 1.1 审计基准视角

- **代码质量**：核心业务逻辑（如 `transition-manager.ts` 和 `config-loader.ts`）必须具备高度鲁棒性，严禁无意义的隐式 `any`。
- **性能与打包基准**：
  - Lighthouse 性能分数必须维持在 95+。
  - 必须遵守项目现有的 Vite 优化策略，例如 `astro.config.mjs` 中拦截 `@iconify-json` 以防止包体积膨胀。
  - 第三方分析脚本和非关键逻辑必须控制加载时机，减少主线程阻塞。
- **边缘网络兼容性**：
  - 客户端或边缘服务端点严禁执行依赖 Node.js 原生模块的代码。
  - 如果未来引入 Cloudflare D1/KV，查询必须参数化，KV 必须明确生命周期。

## 2. 目录架构与配置规范

```text
/
├── kirari.config.toml
├── src/
│   ├── components/
│   ├── content/
│   ├── layouts/
│   ├── styles/
│   │   └── markdown-extend.styl
│   ├── utils/
│   │   └── transition-manager.ts
│   └── pages/
```

强制约束：

- **配置驱动设计**：禁止在组件中硬编码可配置项。新增站点功能必须先进入 `kirari.config.toml`，并在 `src/utils/config-loader.ts` 中解析、默认化。
- **样式解耦**：组件级外观使用 Tailwind CSS v4；Markdown 编译生成的深层结构样式放在 `src/styles/markdown-extend.styl`。

## 3. 架构硬性约束

### 3.1 Astro Islands 架构原则

- 默认使用 `.astro` 编写静态展示组件。
- 只有搜索、主题切换等强交互组件才使用 Svelte。
- Svelte island 必须使用合适的 hydration 指令，避免不必要的 `client:load`。

### 3.2 统一路由与过渡系统

由于项目实现了 View Transitions 和 Swup 降级双系统，页面切换后的初始化逻辑必须注册到 `transitionManager`：

```ts
import { transitionManager } from "@utils/transition-manager";

transitionManager.on("transition:after-swap", yourInitFunction);
```

不要在新增代码中依赖裸 `DOMContentLoaded` 或 `window.onload` 来处理可跨页面切换的 DOM 初始化。

### 3.3 工作流入口

本仓库的项目级执行技能位于 `.agents/skills/kirari-project/SKILL.md`。后续开发、审计、提交前检查必须同时遵循本文件和该技能文件。
