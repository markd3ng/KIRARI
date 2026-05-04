# KIRARI 修复方案与落地记录

日期：2026-05-04

## 修复目标

本轮修复优先处理代码审查中能够确定落地且风险可控的问题：

1. 统一过渡系统入口，确保 View Transitions 和 Swup fallback 都通过 `transitionManager` 派发事件。
2. 修复主配置路径未应用环境变量覆盖的问题。
3. 移除纯静态内容的不必要 Svelte island，恢复 Astro SSG/SSR 优势。
4. 清理 Svelte 客户端 bundle 中的 Iconify JSON 静态导入风险。
5. 补齐 Markdown 增强脚本和图片输出的过渡/性能细节。

## 已实施修复

### 1. 过渡系统

- `transitionManager` 现在会在 `emit()` 时同步派发 DOM `CustomEvent`，便于 Markdown 内联脚本等非模块化代码接入统一过渡事件。
- `Layout.astro` 的主过渡流程改为订阅 `transitionManager.on(...)`。
- PhotoSwipe 初始化/销毁改为监听 `transition:before-swap` 和 `transition:after-swap`。
- 文章页 lazy image 与 Mermaid 初始化改为监听 `transitionManager`，不再直接依赖 `astro:*`。

### 2. 配置加载

- `loadConfig()` 现在对站点、banner credit、analytics、IndexNow 等主配置应用 ENV 覆盖。
- 保持现有 TOML 和默认值逻辑不变，实际优先级变为：ENV > TOML > 默认值。

### 3. Islands 与静态渲染

- `ArchivePanel.svelte` 已迁移为 `ArchivePanel.astro`，归档、标签、分类页面恢复静态 HTML 输出。
- Profile 社交图标从 Svelte `client:load` 改为 Astro `astro-icon` 静态 SVG。
- `astro.config.mjs` 补齐 Profile 默认品牌图标白名单。

### 4. Iconify 与客户端 bundle

- `LightDarkSwitch.svelte`、`Search.svelte`、`DisplaySettings.svelte` 改为使用 `src/utils/preload-icons.ts` 的小体积手写 icon 注册。
- 删除 Svelte 组件中的 `@iconify-json/*/icons.json` 静态导入。

### 5. Markdown 与图片性能

- GitHub Markdown 卡片添加统一过渡事件重初始化，并通过 `data-loaded` 避免重复请求。
- `ImageWrapper` 增加 `width` / `height` props。
- 友链图标补充 `width`、`height`、`loading="lazy"`、`decoding="async"`。

## 暂缓项

### Analytics + Partytown

`@astrojs/partytown` 已在依赖中，但当前 analytics 由 `astro-analytics` 组件统一输出。不同 analytics provider 对 Partytown 的兼容性和 forwarding 配置不同，盲目迁移可能造成生产统计丢数。

建议单独开一轮验证：

1. 为启用的 analytics provider 建立预览环境。
2. 添加 Partytown integration。
3. 为每个 provider 验证请求、事件上报、同意弹窗和 CSP。
4. 只迁移确认兼容的脚本，保留不兼容项在主线程并写明原因。

## 验证状态

当前工作区没有 `node_modules`，因此本轮无法直接执行 `astro check` 或 `astro build`。已完成静态代码检查和关键引用搜索。
