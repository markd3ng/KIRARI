---
name: kirari-project
description: KIRARI project agent workflow — quick-reference audit checklist for feature development. Full technical constraints in AGENTS.md.
---

# KIRARI Agent Workflow

## Mandatory Rules

1. **Doc sync is blocking** — feature is incomplete until config comments, README, and architecture docs reflect the change.
2. **Conventional Commits** — `feat(scope): what`, `fix(scope): what`. One change per commit.
3. **pnpm only** — `preinstall` hook enforces this. Node.js must match `engines`.

## Feature Audit Checklist

### Before Starting

- [ ] Scope boundary clear?
- [ ] Need new TOML config? → must flow through `kirari.config.toml` → `src/types/config.ts` → `config-loader.ts`
- [ ] Can this be static `.astro`? Prefer over Svelte island.
- [ ] Node.js builtins in client/edge code? → forbidden.

### During Development

- [ ] Svelte island hydration directive: `client:load` or `client:only` only.
- [ ] DOM init on `transitionManager.on("transition:after-swap", ...)`, not `DOMContentLoaded`.
- [ ] Markdown deep-DOM styles → `src/styles/markdown-extend.styl`.
- [ ] Component styles → Tailwind CSS v4.

### Before Merge

- [ ] `pnpm type-check` passes
- [ ] `pnpm astro check` passes
- [ ] `pnpm build` succeeds
- [ ] Config/docs synced (see sync table in AGENTS.md)
- [ ] Commit follows Conventional Commits
