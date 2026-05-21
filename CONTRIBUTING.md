# Contributing

## Environment

- **Package manager**: pnpm ≥ 9.14.4 only. `preinstall` hook blocks npm/yarn.
- **Node.js**: Match `engines` field in `package.json`.

## Commit Convention

[Conventional Commits](https://www.conventionalcommits.org/) 1.0.0.

```
feat(scope): description
fix(scope): description
docs: description
chore: description
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `chore`, `test`.

One change per commit. Separate style, logic, and feature work.

## PR Guidelines

- One PR, one concern. Do not bundle unrelated refactors, style changes, and features.
- PRs that touch architecture (new dependencies, `transition-manager.ts`, new config schema) must sync the corresponding docs (see sync table in [AGENTS.md](./AGENTS.md)).
- Use the PR template (`.github/pull_request_template.md`).

## Pre-Release Validation

```bash
pnpm install --frozen-lockfile
pnpm type-check
pnpm astro check
pnpm build
```

CI must use `--frozen-lockfile`.

## Code Standards

### Astro Components

- Default to `.astro` static rendering. Use Svelte islands only when client state is required.
- Hydration directives must be precise — `client:load` for always-hydrate, `client:only` for `localStorage`-only panels.
- Post-navigation DOM init → `transitionManager.on("transition:after-swap", ...)`. Never `DOMContentLoaded`.

### Configuration

- New config fields must flow through: `kirari.config.toml` → `src/types/config.ts` → `src/utils/config-loader.ts` (type guard + default).
- Priority: ENV vars > TOML > defaults.

### Styles

- Component look-and-feel: Tailwind CSS v4.
- Markdown deep-DOM (admonitions, GitHub cards, KaTeX): `src/styles/markdown-extend.styl`.

### Edge Compatibility

- Client and Edge Function code: no Node.js builtins (`fs`, `path`, `crypto`).
- Cloudflare D1/KV additions: parameterized queries, explicit KV lifecycles.

## Architecture Sync Table

| Change | Sync target |
|---|---|
| New/modified config field | `kirari.config.toml` comments, `README.md`, `README_CN.md` |
| New Astro/Svelte dependency | `README.md` tech stack table |
| Modified `transition-manager.ts` | `AGENTS.md` Transition System section |
| Modified build pipeline scripts | `README.md` Build Pipeline section |
