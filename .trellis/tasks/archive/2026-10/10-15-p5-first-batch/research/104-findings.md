# #104 — TOC lifecycle and accessible location

## Source-backed baseline

Current owner: `apps/site/src/components/widget/TOC.astro`; callers are
`MainGridLayout.astro` (floating) and `SidebarWidget.astro` (sidebar). The custom
element's browser callbacks already provide the route detach/reconnect boundary;
no transition-manager change or navigation framework is needed.

Baseline `1d8997d` adds the delegated click listener with `capture: true` and
removes it without capture. The startup animation listener/500ms timer, 700ms
observer-root retry, update RAF, animated scroll RAF, scroll correction timers
and ResizeObserver are not cleaned up on disconnect. `tocEl`/heading-map/range
state also persists across reattachment. Static variants have ordinary anchor
links, but no navigation role/name and no accessible current heading state.

This establishes source cleanup defects. It does not establish a measured
Production memory leak or frequency/impact in deployed browsers.

## Minimal implementation

- Match capture during removal; remove the startup animation listener and cancel
  both initialization timers, both RAF paths and correction timers.
- Disconnect intersection/resize observers, invalidate callbacks from previous
  connections, reset heading/range state, and undo temporary content-visibility
  and scroll-behavior overrides. Reuse the existing custom-element lifecycle.
- Keep floating/sidebar markup, class names and placement. Add a localized named
  navigation role and exactly one `aria-current="location"` per active TOC.
- Retain native anchors and focus the destination heading for keyboard activation;
  generated `tabindex=-1` does not add headings to the normal Tab sequence.
- Correct fallback active-count accounting and safely skip missing heading sections,
  so observer state and reconnect fallback remain internally consistent.

## Reproduction and focused evidence

`node --test apps/site/scripts/tests/toc-lifecycle.test.mjs`: 4/4 pass.
The tests execute the actual Astro script after TypeScript transpilation with
capture-aware listener bookkeeping and controlled timers, RAF and observer queues.
They check early detach before init; four repeated detach/reconnect cycles with
in-flight click corrections; stale old callbacks after reconnect; current-location
updates and keyboard click focus; and both static landmark templates.

Running the exact tests against `git show HEAD:apps/site/src/components/widget/TOC.astro`
produced 0/4 pass: retained initialization timer, retained capture listener, absent
current-location state, absent landmark attributes. Temporary baseline harness was
removed. This is deterministic component logic evidence, not a browser heap profile.

`git diff --check -- apps/site/src/components/widget/TOC.astro apps/site/scripts/tests/toc-lifecycle.test.mjs`
is clean. Integrated checks are owned by the root agent.

## Remaining acceptance, dependencies and readiness

| Contract | State / evidence | Dependency / Owner decision |
|---|---|---|
| Cleanup/reconnect | Implemented; focused deterministic regressions pass | Real Chromium 16 ClientRouter swaps pass; no document reload |
| Active accessible location | Implemented; observer/current-location and keyboard-focus regression pass | Real Tab/Enter focus and accessible navigation snapshot pass at both widths |
| Landmark | Named navigation role on both static templates | Playwright accessibility snapshot names navigation in both variants |
| Desktop/mobile placement | Existing CSS/classes/layout preserved | Component responsive indentation checked at 1600/390px; full-site host placement smoke remains with root. Near-top mobile redesign remains a separate Owner choice |
| Build/static output | No new runtime dependency/helper/framework | Root type/Astro/build/CI checks pending |
| Deployment impact | No provider/credential/Production operations | No dependency on P4 or later Gateway phases |

Engineering implementation is ready for integrated verification; Issue #104 must
remain unmerged/unaccepted until actual PR and acceptance evidence exist. No
required shared-file edits were identified. The existing site test glob discovers
the new dedicated test without a package-script change.

## Real Chromium fixture evidence

`PATH=/Users/ian/.local/share/fnm/node-versions/v22.12.0/installation/bin:$PATH node scripts/p5-browser/toc-browser.mjs`
passes with pinned Node 22.12.0 and the existing `scripts/p3-browser` Playwright
1.62.1 installation. Report: `evidence/104-browser.json`.

The harness compiles the unchanged production TOC component and actual
config/translation/widget dependencies into an isolated temporary Astro fixture,
using real `ClientRouter` and static output. It removes the fixture after running
and never builds shared `apps/site/dist`.

All four viewport/layout combinations (1600/390px, floating/sidebar) pass four
Astro swaps each while retaining the same browser global token. Real Tab movement
and Enter activation focus the destination heading. Accessibility snapshots expose
the named navigation landmark; each active TOC has one current-location link.
Detached old anchors are explicitly dispatched click events and cause zero TOC
callback invocations, proving captured listeners are removed in Chromium. Removing
and re-appending the exact element then clicking produces exactly one invocation.
The nested entry keeps production responsive indentation (24px desktop, 20px mobile).
There are no page errors.

The page shell and article fixtures are synthetic. This proves the actual
component's static compilation, browser lifecycle, semantics and responsive styles;
full-site layout host positioning is reserved for root's integrated browser smoke.
It does not measure deployed heap usage or establish a Production memory leak.
