# Independent review — #105 adapter synchronization and #104 TOC

Reviewer authored #109, not the #105/#104 implementations. This review excludes #109 signoff. Reviewed the effective Issue contracts, source diffs and connected callers, regression tests, actual platform ownership, and CI registration. No remote changes or runtime source edits were made by this reviewer. At root's request, the reviewer added a small TOC caller source regression after identifying the finding below.

## Finding and resolution

**Resolved P2 — translated floating TOC landmark inherited the default language.** `MainGridLayout.astro` originally passed only `headings` and `layout="floating"` to TOC, while the newly added navigation landmark used `i18n(..., lang)`. With no `lang`, `translation.ts` falls back to `siteConfig.lang`, so translated article pages could announce their floating landmark in the site default language. The synthetic TOC browser fixture explicitly supplies `en-US`, which alone could not detect this caller gap.

Root corrected the actual floating caller to pass `lang={pageLang}`. Inspected `pageLang = normalizeLangCode(lang || siteConfig.lang)` and the existing sidebar caller's language propagation. Added source assertions to the existing localized-landmark test that bind the floating caller to `pageLang` and its route-language derivation. Reran all twelve focused tests successfully.

**No remaining actionable findings in #105/#104 reviewed scope.**

## #105 ownership and behavior

- Actual `.opencode/commands/trellis/{continue,finish-work}.md` exist; startup is implemented in `.opencode/plugins/session-start.js`. The three exact missing-path exceptions reflect these owned platform entry points.
- Reasonix lacks its own `trellis-start/SKILL.md` ownership in `.trellis/.template-hashes.json`; `.reasonix/skills/trellis-implement/SKILL.md` actually declares `runAs: subagent`. The single exact extra-path exception matches this platform implementation agent.
- `.claude` is absent in this checkout. The template ownership manifest explicitly tracks Claude continue/finish commands and its startup hook. Optional checking preserves absent-root behavior and, when a Claude skills tree is present and enabled, checks shared bytes, required nested inventory and extras. Its absence is not claimed as evidence that Claude runtime currently works.
- Missing canonical copies, nested references, newly introduced canonical files, stale extras and changed bytes all fail with canonical/adapter path diagnostics. Named exceptions do not exempt neighboring files or present divergent copies. Existing required inventories pass; required missing roots fail.
- CI explicitly runs `scripts/tests/trellis-adapter-sync.test.mjs` and `pnpm trellis:check`; no generated adapter copies were manually edited.

## #104 lifecycle and accessibility

- Capture removal now matches registration. Disconnect cancels initial/retry/correction timers and both RAF categories, disconnects intersection/resize observers, removes animation listeners, restores inline scroll behavior and content visibility, and clears article references and accessible current state.
- Epoch checks reject already-delivered callbacks from a previous connect cycle. Reattachment rebuilds current-page indexes and handlers. The tests exercise the capture-sensitive listener identity rather than relying on Node EventTarget's differing behavior.
- Both TOC variants expose a localized navigation landmark and a single current-location link. Native keyboard Enter focuses the heading with `preventScroll`; ordinary anchors remain in static markup. Desktop/mobile placement has not been redesigned.
- Reviewed actual `MainGridLayout` and sidebar callers; corrected translated floating language propagation as above.
- The site test glob runs the lifecycle tests; CI additionally runs the actual component Chromium fixture.

## Executed checks

Pinned Node **22.12.0** in PATH:

```sh
node --test scripts/tests/trellis-adapter-sync.test.mjs apps/site/scripts/tests/toc-lifecycle.test.mjs
node scripts/p5-browser/toc-browser.mjs
```

Results: **12/12 focused tests PASS**, no skips. Actual TOC + Astro ClientRouter Chromium fixture **PASS** for 1600px/390px × floating/sidebar. Each case verified four swaps without document reload, real Tab/Enter focus, named accessibility landmark, one current-location link, detached click-listener removal, exact-element reattach with one click callback, responsive indentation and zero page errors.

Limit: component browser fixtures use a synthetic article shell. Full-site hosting placement, integrated language routes and whole-site type/build verification remain root's integration work. No Production leak, deployed memory profile or hosting behavior is inferred from these local tests.

**Review disposition: #105 and #104 pass the independent review after the language-caller correction.**
