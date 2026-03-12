---
name: pr-merge-priority-and-execution-plan
overview: 为当前两个 Dependabot PR 制定基于风险与可回滚性的合并优先级，并定义从 dev 验证到 main 落地的合并执行流程。
todos:
  - id: assess-pr-risk
    content: 使用[subagent:code-explorer]核对#17和#22改动并确定优先级
    status: completed
  - id: merge-pr-17
    content: 先合并#17到dev并执行lint、check、build与CI验收
    status: completed
    dependencies:
      - assess-pr-risk
  - id: refresh-pr-22
    content: 更新#22基线并解决锁文件差异后重新验证
    status: completed
    dependencies:
      - merge-pr-17
  - id: merge-pr-22
    content: 合并#22到dev并确认EdgeOne流水线全部通过
    status: completed
    dependencies:
      - refresh-pr-22
  - id: sync-dev-main
    content: 发起dev到main同步PR并在main CI全绿后合并
    status: completed
    dependencies:
      - merge-pr-22
---

## User Requirements

- 按变更风险自行决定当前两个依赖升级 PR 的合并优先级。
- 基于既有仓库流程输出可执行的“开始合并”计划，而不是一次性直接执行所有合并动作。
- 以 `main` 为最终基线，确保 `dev` 与 `main` 同步后再推进发布链路。

## Product Overview

- 本次工作是对两个 Dependabot PR 进行分级、排序、验证、合并与分支回流的流程化安排。
- 输出应覆盖：优先级依据、每步验证点、失败回退方式、最终同步到 `main` 的闭环步骤。
- 结果表现为清晰的阶段化执行清单，便于逐步核验与追踪。

## Core Features

- PR 风险分级与优先级排序（先小范围高影响依赖，再批量补丁依赖）。
- 分阶段验证（本地检查与 CI 结果双重确认）后再执行合并。
- 合并后分支同步闭环（`dev` 验证通过后回流 `main` 并再次验证）。

## Tech Stack Selection

- 代码仓库：Astro + TypeScript + TailwindCSS + Svelte（已存在项目栈）
- 包管理：pnpm（`pnpm install --frozen-lockfile`）
- 质量门禁：Biome、Astro Check、Astro Build（来自现有 GitHub Actions）
- PR 自动更新来源：Dependabot（目标分支配置为 `dev`）

## Implementation Approach

采用“单风险源优先、逐个合并、每步可回退”的策略：先处理 `#17`（单依赖 Tailwind 升级，便于隔离样式风险），再处理 `#22`（16 个 patch 批量更新）。每次合并都以 `dev` 分支 CI 全绿为准入条件，最后再执行 `dev -> main` 同步，确保主干稳定。
关键决策：不并行合并两个 PR，避免 `package.json`/`pnpm-lock.yaml` 叠加冲突导致问题定位困难。
性能与可靠性：流水线成本约为 O(PR 数量 × CI 时长)，通过串行合并降低返工与重复排查成本。

## Implementation Notes

- 严格复用现有校验命令：`pnpm lint`、`pnpm check`、`pnpm build`，与 CI 保持一致，避免“本地通过/远端失败”。
- 重点关注 `pnpm-lock.yaml` 漂移：后合并 PR 需先 rebase/更新基线再验证，避免锁文件冲突扩散。
- 控制影响面：仅处理当前两个依赖 PR，不夹带其他重构或配置改动。
- 回退策略：每个 PR 独立可回滚；若合并后 CI 失败，优先 revert 对应单个 PR。

## Architecture Design

当前合并链路沿用现有结构，不引入新架构：

1. Dependabot PR 进入 `dev`
2. `dev` 触发 `ci-edgeone.yml`（Biome -> Check -> Build -> Deploy）
3. `dev` 稳定后发起同步 PR 到 `main`
4. `main` 触发 `ci-main.yml`（Biome -> Check -> Build -> Deploy）

## Directory Structure

## Directory Structure Summary

本次为依赖升级合并计划，主要影响依赖清单与锁文件，并依赖现有 CI 工作流做准入验证。

e:/Projects/KIRARI/

- package.json  # [MODIFY] 两个依赖 PR 的版本变更入口文件；需确认版本提升符合预期、无额外依赖漂移。
- pnpm-lock.yaml  # [MODIFY] 两个 PR 的锁文件核心冲突点；需在每次 rebase 后重新校验一致性。
- .github/workflows/ci-edgeone.yml  # [AFFECT] `dev` 分支合并后的质量门禁与部署依据，需以其结果作为合并准入。
- .github/workflows/ci-main.yml  # [AFFECT] `main` 回流后的最终发布门禁，需确认主分支全绿。
- .github/dependabot.yml  # [AFFECT] 已配置依赖 PR 目标分支为 `dev`，用于约束后续自动更新流向。

## Agent Extensions

- **code-explorer**（SubAgent）
- Purpose: 跨文件复核依赖变更范围与 CI 关联配置，确认合并顺序依据。
- Expected outcome: 产出可执行的优先级与验证清单，降低遗漏与误判风险。