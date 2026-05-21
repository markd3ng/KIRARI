# Contributing

## Commit Convention

[Conventional Commits](https://www.conventionalcommits.org/) 1.0.0.

```
feat(scope): 描述
fix(scope): 描述
docs: 描述
chore: 描述
```

允许类型：`feat`、`fix`、`docs`、`style`、`refactor`、`perf`、`chore`、`test`。

## PR 原则

- 一 PR 一事。不要混合不相关的样式、重构和新功能。
- 涉及架构变更（新增依赖、修改 `transition-manager.ts`、新增配置字段）的 PR 必须同步更新对应文档。

## 开发环境

- **包管理器**：仅 `pnpm ≥ 9.14.4`。`preinstall` 钩子会阻止其他管理器。
- **Node.js**：与 `package.json` 中 `engines` 字段一致。

## 发版前验证

```bash
pnpm install --frozen-lockfile
pnpm type-check
pnpm astro check
pnpm build
```

CI/CD 必须使用 `--frozen-lockfile`。

## 代码规范

### Astro 组件

- 默认使用 `.astro` 静态渲染。
- 仅在需要客户端交互时使用 Svelte island，并标注精确 hydration 指令。
- 导航后 DOM 初始化必须注册到 `transitionManager.on("transition:after-swap", ...)`，不得依赖 `DOMContentLoaded`。

### 配置

- 新增可配置项必须经过：`kirari.config.toml` → `src/types/config.ts` → `src/utils/config-loader.ts`（含类型守卫和默认值）。
- 配置优先级：环境变量 > TOML > 默认值。

### 样式

- 组件外观：Tailwind CSS v4。
- Markdown 编译产物（admonitions、代码块等）的深层样式：`src/styles/markdown-extend.styl`。

### 边缘兼容

- 客户端和边缘 Functions 代码不得依赖 Node.js 原生模块。

## 架构文档同步

修改以下内容时，对应文档同步更新：

| 变更 | 同步文档 |
|------|---------|
| 新增/修改配置字段 | `kirari.config.toml` 注释、`README.md`、`README_CN.md` |
| 新增 Astro/Svelte 依赖 | `README.md` 技术栈表格 |
| 修改 `transition-manager.ts` | `AGENTS.md` 过渡系统部分 |
| 修改构建管线 | `README.md` 构建管线部分 |
