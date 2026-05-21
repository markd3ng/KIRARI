<!-- skilld -->
Before modifying code, check `.agents/skills/` for relevant skills.
Read the SKILL.md for any matching package before proceeding.
<!-- /skilld -->

# KIRARI Development Constraints

## Architecture Invariants

### 1. Astro Islands

| Component type | File | Hydration |
|---|---|---|
| Static (post cards, nav, layouts) | `.astro` | None |
| Search | `Search.svelte` | `client:load` |
| Theme toggle | `ThemeToggle.svelte` | `client:load` |
| Theme color picker | `DisplaySettings.svelte` | `client:only` |

`client:only` is reserved for `localStorage`-reading panels. Must not contain SEO-critical content.

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
                         ↑                            ↓
              ENV vars (PUBLIC_*)     re-exported by @config per section
```

- Hardcoding config values in components is **forbidden**.
- Every new config field must go through: `kirari.config.toml` (with bilingual comments) → `src/types/config.ts` (type) → `src/utils/config-loader.ts` (parse + type guard + default).
- Type guards used: `getString`, `getBoolean`, `getNumber`, `getStringArray`, `getStringRecord`.
- Priority: ENV > TOML > hardcoded default.
- `config-loader.ts` uses `import.meta.glob("../../kirari.config.toml", { eager: true, query: "?raw" })` — the TOML is loaded as raw string at build time.

### 4. Style Layers

| Layer | Tech | Scope |
|---|---|---|
| Component appearance | Tailwind CSS v4 | Layout, spacing, colors, responsive |
| Markdown deep DOM | Stylus (`markdown-extend.styl`) | Admonitions, GitHub cards, KaTeX output |
| Code highlight | Expressive Code + CSS variables | Injected via `styleOverrides` in astro config |

> Do not write Stylus in components. Do not write component styles in `markdown-extend.styl`.

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
materialize-ghc-adapter.mjs → astro build → postbuild.mjs
```

`postbuild.mjs` runs 6 sequential tasks on `dist/`:
1. Generate `_headers` + `_redirects` (platform caching, language redirects)
2. Generate `robots.txt`
3. Obfuscate `mailto:` links
4. Index with Pagefind (skipped if DocSearch enabled)
5. Generate `llms.txt` files
6. Submit to IndexNow (if enabled)

## Commit Workflow

### Pre-Commit Checklist

```bash
pnpm type-check    # tsc --noEmit
pnpm astro check   # .astro template type checking
pnpm build         # Full build (materialize → astro → postbuild)
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

### CI/CD

- Must use `pnpm install --frozen-lockfile`
- `@astrojs/check` is devDependency; invoked via `pnpm astro check`

## Documentation Sync

| Change | Update |
|---|---|
| New/modified config field | `kirari.config.toml` comments, `README.md`, `README_CN.md` |
| New Astro/Svelte dependency | `README.md` tech stack table |
| Modified `transition-manager.ts` | This file (Transition System section) |
| Modified build pipeline | `README.md` Build Pipeline section |
