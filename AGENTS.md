# KIRARI Development Constraints

## Monorepo Workspace

KIRARI is a pnpm workspace with three packages:

| Directory | Package | Purpose |
|---|---|---|
| `apps/site/` | `@kirari/site` | Astro site program |
| `packages/site-profile/` | `@kirari/site-profile` | Default content, config, brand assets, snippets |
| `workers/kirari-edge/` | `@kirari/edge` | Optional edge runtime |

- **Repo root** is the workspace root. All `pnpm` commands run from here.
- **Config is TOML-first**: `kirari.config.toml` → types → config-loader.
- **Default profile TOML** is materialized into the site before every build via
  `apps/site/scripts/materialize-profile.mjs`.
- **Build pipeline**: `materialize-profile → materialize-ghc-adapter → astro build → postbuild`.

## Architecture Invariants

### 1. Astro Islands

| Component type | File | Hydration |
|---|---|---|
| Static (post cards, nav, layouts) | `.astro` | None |
| Search | `Search.svelte` | `client:idle` |
| Theme toggle | `ThemeToggle.svelte` | `client:idle` |
| Theme color picker | `DisplaySettings.svelte` | `client:only="svelte"` |

`client:only` is reserved for `localStorage`-reading panels. Must not contain SEO-critical content.
Do not change Search or Theme Toggle to eager hydration unless a measured first-paint interaction requirement explicitly needs it.

### 2. Transition System

All post-navigation DOM initialization **must** register on `transitionManager`, not `DOMContentLoaded`:

```ts
import { transitionManager } from "@utils/transition-manager";

// Correct
transitionManager.on("transition:after-swap", init);

// Wrong — fires only on hard loads
document.addEventListener("DOMContentLoaded", init);
```

`TransitionManager` is a singleton (module-level `new TransitionManager()`). It exposes four events that map to both Astro `ClientRouter` and Swup backends:

| Unified event | Astro event | Swup hook |
|---|---|---|
| `transition:start` | `astro:before-preparation` | `visit:start` |
| `transition:before-swap` | `astro:before-swap` | `content:replace` |
| `transition:after-swap` | `astro:after-swap` | `page:view` |
| `transition:end` | `astro:page-load` | `visit:end` |

`init()` is idempotent. Feature detection: `'startViewTransition' in document`. On unsupported browsers, Swup is loaded dynamically — zero cost on modern browsers.

During swap, `<html>` state (theme mode, hue, code theme) is restored from `localStorage` + config defaults — not stale DOM.

### 3. Configuration Pipeline

```
kirari.config.toml → smol-toml parse → config-loader.ts → Config singleton
                                                 ↓
                                  re-exported by @config per section
```

- Hardcoding config values in components is **forbidden**.
- KIRARI is TOML-first: normal user-facing configuration belongs in `kirari.config.toml`; env is reserved for secrets, deployment overrides, and provider credentials that should not be committed.
- Every new config field must go through: `kirari.config.toml` (with bilingual comments) → `src/types/config.ts` (type) → `src/utils/config-loader.ts` (parse + type guard + default).
- Type guards used: `getString`, `getBoolean`, `getNumber`, `getStringArray`, `getStringRecord`.
- `config-loader.ts` uses `import.meta.glob("../../kirari.config.toml", { eager: true, query: "?raw" })` — the TOML is loaded as raw string at build time.
- Custom Head/Footer snippet files use `import.meta.glob("../snippets/*.{html,js}", { eager: true, query: "?raw", import: "default" })`.
- `set:html` is allowed only for trusted maintainer-owned config, snippet files, and generated structured data. Never feed visitor, comment, or CMS user input into it.
- Search and SEO provider changes must preserve the TOML-first model, skip Pagefind when an external provider is active, and must not break SSG output.

### 4. Style Layers

| Layer | Tech | Scope |
|---|---|---|
| Component appearance | Tailwind CSS v4 | Layout, spacing, colors, responsive |
| Markdown deep DOM | Stylus (`markdown-extend.styl`) | Admonitions, GitHub cards, KaTeX output |
| Code highlight | Expressive Code + CSS variables | Injected via `styleOverrides` in astro config |

> Do not write Stylus in components. Do not write component styles in `markdown-extend.styl`.

Astro scoped CSS only applies to DOM that Astro renders and annotates at build time.
Elements created later with `document.createElement()`, `className = ...`, or
`classList.add(...)` do **not** receive Astro's scoped attributes. Style those
runtime nodes with Tailwind utility classes, `<style is:global>`, or
`:global(...)`; never rely on ordinary scoped selectors such as `.dynamic-item {}`
for script-created DOM.

### 5. Edge Compatibility

Client-side and Edge Function code must not import Node.js builtins (`fs`, `path`, `crypto`, etc.). If adding Cloudflare D1/KV: queries must be parameterized, KV must declare explicit lifecycles.

### 6. Plugin Chain (Markdown)

Order matters — each plugin feeds the next:

**Remark (parse → AST)**:
1. `remark-math` — `$...$` / `$$...$$`
2. `remark-reading-time` — `words`, `minutes` fields
3. `remark-excerpt` — first paragraph → `excerpt`
4. `remark-github-admonitions-to-directives` — `[!NOTE]` → `:::note`
5. `remark-directive` — `:::name{key=value}`
6. `remark-sectionize` — headings → `<section>`
7. `parseDirectiveNode` — convert directive nodes to hast

**Rehype (hast → HTML)**:
1. `rehype-katex` — math → HTML/CSS
2. `rehype-mermaid-pre` — `<pre><code class="language-mermaid">` → `<pre class="mermaid">`
3. `rehype-slug` — heading IDs
4. `rehype-lazy-load-image` — `loading="lazy"`
5. `rehype-components` — dispatch `:::name` to custom components
6. `rehype-autolink-headings` — `#` anchor links

### 7. Build Pipeline

```
materialize-profile.mjs → materialize-ghc-adapter.mjs → astro build → postbuild.mjs
```

`postbuild.mjs` runs 6 sequential tasks on `dist/`:
1. Generate `_headers` + `_redirects` (platform caching, language redirects)
2. Generate `robots.txt`
3. Obfuscate `mailto:` links
4. Index with Pagefind (skipped if DocSearch enabled)
5. Generate `llms.txt` files
6. Submit to IndexNow (if enabled)

## Agent Workflow Checklist

### Before Starting

- Scope boundary must be clear before editing.
- Prefer static `.astro` components when interactivity is not required.
- If a feature needs user-facing configuration, follow the TOML-first configuration pipeline.
- Client-side and Edge code must not import Node.js builtins.
- Use pnpm only; Node.js must satisfy `package.json` `engines`.

### During Development

- Preserve the Astro Islands hydration table above.
- Register post-navigation DOM initialization on `transitionManager`, not `DOMContentLoaded`.
- Keep Markdown deep-DOM styles in the Markdown style layer.
- Keep component appearance in Tailwind/component files.

### Before Merge

- Config and documentation sync is blocking.
- Run the pre-commit checklist below.
- Use one Conventional Commit per logical change.

## Commit Workflow

### Pre-Commit Checklist

```bash
pnpm install --frozen-lockfile
pnpm site:type-check   # site tsc --noEmit
pnpm site:astro-check  # site .astro template type checking
pnpm edge:type-check   # edge tsc --noEmit
pnpm edge:test         # edge runtime tests
pnpm build             # Full build (materialize → astro → postbuild)
pnpm audit --audit-level moderate
```

### Conventional Commits 1.0.0

```
feat(scope): what
fix(scope): what
docs: what
chore: what
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `chore`, `test`.

One change per commit. Do not mix style tweaks, logic fixes, and new features.

### Changelog Policy

- Do not update `CHANGELOG.md` for every commit by default; Conventional Commit messages are the per-commit change record.
- Update `CHANGELOG.md` only for releases, tags, explicit release-note requests, breaking changes, migrations, or cohesive user-facing feature batches.
- When a change requires `CHANGELOG.md`, keep the entry user-facing and group related commits by release or unreleased section instead of duplicating individual commit messages verbatim.

### CI/CD

- Must use `pnpm install --frozen-lockfile`
- `@astrojs/check` is devDependency in `@kirari/site`; invoked via `pnpm site:astro-check`

## Documentation Sync

| Change | Update |
|---|---|
| New/modified config field | `kirari.config.toml` comments, `README.md`, `README_CN.md` |
| New Astro/Svelte dependency | `README.md` tech stack table |
| Modified `transition-manager.ts` | This file (Transition System section) |
| Modified build pipeline | `README.md` Build Pipeline section |
| Modified Custom Head/Footer snippets | `SECURITY_MODEL.md` when hydration or trust boundaries change |
| Modified search/SEO provider | `kirari.config.toml`, `README.md`, `README_CN.md`, `SECURITY_MODEL.md` |
