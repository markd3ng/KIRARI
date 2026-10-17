# #109 Mermaid verification and changes

Baseline: main `1d8997d647c17d448be906108b510f75c24e0efa`; resolved Mermaid **11.17.2**, Astro **7.3.5**, Expressive Code **0.44.2**. The copied worktree has no current Codegraph index, so direct source and installed integration source were used instead of stale graph findings.

## Baseline working behavior and reproduced gap

- `content.config.ts` already defaults per-post `mermaid` to false. Both default and translated route templates require the global setting and post opt-in for their processed script.
- The actual installed Astro 7 conditional-script fixture verified **disabled initial navigation does not execute that conditional script**. Do not claim initial gating or current Production is broken.
- `rehypeMermaidPreProcess` already converts a fenced `language-mermaid` code block into `pre.mermaid`. Expressive Code appends its processor plugin after existing rehype plugins, so conversion order works. A `<code>` child must be removed before Expressive Code runs; otherwise EC consumes the diagram. No config/plugin order change was needed.
- **Reproduced actual defect:** in an isolated Astro/Expressive Code/real Chromium fixture, the Mermaid `<script>` copied directly from baseline default post source rendered the enabled initial article, then rendered a **disabled** destination after an actual ClientRouter link navigation. The persistent after-swap callback scans all `pre.mermaid` without consulting destination opt-in. The reproduction asserted `article[data-mermaid-enabled="false"] pre.mermaid svg` exists. Baseline experiment completed PASS in 5.33s; it was an isolated diagnostic, not a claim about deployed Production.
- Existing `mermaid.run()` uses Mermaid's processed marker to avoid duplicate unchanged diagrams; repeated callbacks alone are not proof of duplicate baseline SVG. Theme changes were not observed/re-rendered by the old handler. Renderer exceptions were not caught by its async invocation.

## Behavior matrix after fix

| Global `[mermaid].enable` | Post `mermaid` | Fenced diagram output |
| --- | --- | --- |
| false | false | Keyboard-focusable labelled source `pre`; no SVG/renderer fetch |
| false | true | Same source fallback; no SVG/renderer fetch |
| true | false or absent | Same source fallback; no SVG/renderer fetch |
| true | true | SVG on direct load and Astro navigation; malformed diagram retains labelled source |

Default is unchanged: a post must explicitly opt in. The route markup now carries the effective two-gate result. The shared runtime selects only enabled article markup, dynamically loads the installed Mermaid, serializes async rendering, retains source by DOM identity, and renders a block once per effective theme. Root HTML class changes trigger light/dark redraw; global renderer configuration does not race concurrent redraws. Detached outgoing blocks are ignored. Temporary measuring DOM is hidden/aria-hidden and always removed, including parser failures. Mermaid strict sanitization remains enabled; rendered output comes from Mermaid's sanitized SVG API. Invalid diagrams remain readable and do not throw uncaught page errors.

## Regression evidence

Command (pinned Node 22.12.0 in PATH):

```sh
REQUIRE_SITE_BROWSER=true node --test apps/site/scripts/tests/mermaid.test.mjs apps/site/scripts/tests/mermaid-browser.test.mjs
```

Result: **3/3 PASS**, no skips, 5.07s. Tests build isolated fixture source/cache/dist/public paths, then serve the actual emitted assets through Playwright routing in real Chromium. Checked all four gate combinations plus absent opt-in, disabled initial routes make no Mermaid-core request, enabled direct load, enabled navigation without full document reload, repeated after-swap events preserve the SVG ID, light → dark → light produces new SVG, malformed source fallback, normal JS still uses Expressive Code, enabled → disabled, translated-like route and browser Back, temporary container cleanup, zero uncaught page errors. Source-contract assertions bind both actual post route templates to the gate and shared runtime.

The browser fixture uses temporary `.mermaid-fixture-*` source folders beneath the existing Astro project root because Astro 7's virtual script metadata lookup fails when sources are outside root. Cache/dist/public remain isolated and all temporary files are removed. No whole-site build or shared generated output was run by this worker.

## Remaining integration / Owner needs

- Root registers the Mermaid browser test in the existing browser-fixtures CI job with `REQUIRE_SITE_BROWSER=true`; the normal site test glob also discovers it, but missing browser dependencies may skip locally.
- Root owns whole-site type/QA/build, integrated default and actual translated-site route verification, and complete-change review.
- User docs/spec sync: describe the two required settings, default-false frontmatter, readable source fallback when disabled/error, automatic light/dark redraw, and transition-manager after-swap reuse. The renderer inserts only Mermaid's strict-sanitized generated SVG from maintainer-authored diagram source.
- No Owner policy decision, dependency upgrade, new service, hosting operation, or credentials are needed for this source fix. Browser proof is local engineering evidence only. Swup fallback was reused through the existing transition manager; the real-browser fixture exercises Astro ClientRouter, not a forced unsupported-browser Swup branch.
