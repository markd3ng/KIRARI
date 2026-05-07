---
name: kirari-project
description: KIRARI project workflow, documentation, git, performance, Astro Islands, and transition-system rules. Use for all work inside the KIRARI repository.
---

# 开发执行技能与工作流

## 1. 文档驱动开发

本条款为本项目最高优先级执行规矩。任何 Agent 和开发者必须遵守。

- **原子化同步更新**：每当新增、修改或重构任意 feature，必须在同一个操作环节中同步更新配套文档。
- **配置变动更新**：如果修改或新增全局配置项，必须同步更新 `kirari.config.toml` 注释、配置 loader/defaults，以及相关 README / `.env.example`。
- **架构与 README 更新**：如果引入新的 Astro/Svelte 依赖、修改 `transition-manager.ts` 等底层逻辑，必须同步修正 README 和架构说明文档。
- **审计拦截**：如果逻辑变更缺少必要文档同步，任务视为未完成。

## 2. Git 工作流

必须使用 Conventional Commits，保持 Git 历史清晰可追溯。

允许类型：

- `feat:` 新增特性
- `fix:` 修复 bug
- `docs:` 文档更新
- `style:` 格式或样式调整，不影响逻辑
- `refactor:` 重构
- `perf:` 性能优化
- `chore:` 构建过程或辅助工具变动

原则：

- **一事一交**：不要把样式调整、业务逻辑修复和新功能混在同一个 commit。
- **范围清晰**：优先使用清晰作用域，例如 `fix(transition): ignore initial page-load`。

## 3. macOS + Node.js 环境

- 项目强制使用 `pnpm`，不要使用 npm/yarn 安装依赖。
- 常用验证：
  - `pnpm type-check`
  - `pnpm astro check`
  - `pnpm build`
- 如果开发 Cloudflare Workers/Pages 扩展，使用 `pnpm wrangler dev` 模拟边缘环境，不要只依赖 Node.js runtime。

## 4. Feature 审计 Checklist

### 执行前

- 需求边界是否清晰？
- 是否需要新增或修改 `kirari.config.toml`？
- 是否真的需要 Svelte 客户端状态？优先 `.astro` 静态渲染。
- 是否混入了不适合 Cloudflare/V8 isolate 的 Node.js 运行时代码？

### 开发中

- Svelte 组件是否使用精确 hydration 指令？
- DOM 初始化是否挂到 `transitionManager.on("transition:after-swap", ...)`？
- Markdown/文章内定制样式是否放在 `src/styles/markdown-extend.styl`？
- 是否遵守 Tailwind CSS v4 和现有设计系统？

### 合并前

- 新 feature 或 API/config 变更是否同步到 `kirari.config.toml` 注释和 README？
- commit message 是否符合 Conventional Commits？
- 是否运行并通过 `pnpm type-check`、`pnpm astro check`、`pnpm build`？
