# Independent first-batch review

Reviewer authored #105, so **#105 has no independent signoff from this review**. Reviewed actual current runtime/diff and new harnesses for #103/#104/#109, task contracts, Trellis check skill, Site component/lifecycle/quality guides and shared repository rules. No runtime source changes; added only the specifically authorized dotenv regression test after root fixed the finding. Working-tree snapshot 2026-10-15; other workers remain active.

**Follow-up status:** both actionable findings below were fixed by root during review. New `apps/site/scripts/build-analytics-settings.mjs` loads Astro's own Vite production dotenv environment at both real policy entry points. Independently added the root-authorized `apps/site/scripts/tests/analytics-build-env.test.mjs`: four tests pass, including actual Astro `Analytics.astro` output matched to policy, mode-specific dotenv overriding base dotenv/TOML, process-env precedence, and explicit false suppressing scripts/origins. CI now requires Mermaid's browser test in the installed browser job and executes both TOC/analytics browser scripts. Documentation/spec additions now cover the changed contracts. The findings are retained below as reproduction/repair evidence, not remaining blockers. No additional actionable issue remains in the reviewed #103/#104/#109 changes; root-owned full type/build and exact-head CI still need their own evidence.

## Actionable findings

### [P2] Astro dotenv analytics values still diverge from generated CSP

- Location: `apps/site/src/utils/analytics-settings.mjs:37–39`; callers `apps/site/scripts/postbuild.mjs:22` and `apps/site/scripts/generate-vercel-config.mjs:14`.
- App config passes `getEnvString/getEnvBoolean` into the shared resolver (`apps/site/src/utils/config-loader.ts:1724`); these readers support `import.meta.env` populated by Astro dotenv files (`src/utils/env.ts:16–37`). The default resolver used by both policy writers reads only `process.env`. Those writers are separate Node entry points and never load Astro's effective dotenv configuration.
- Reproduced with an isolated real Astro build using `.env.production` containing only synthetic `PUBLIC_ANALYTICS_ENABLE=true`, `PUBLIC_UMAMI_ID=review-fixture`, `PUBLIC_UMAMI_SRC=https://dotenv-only.invalid/script.js`. The fixture rendered the actual shared resolver with the actual app env readers. Result: `renderedMarkupIncludesDotenvOrigin: true`, `generatedPolicyIncludesDotenvOrigin: false`. No external requests or credentials were used; temporary fixture removed.
- Impact: documented custom analytics source configured through Astro dotenv can be emitted into production HTML while `script-src`/`connect-src` omit its origin. This leaves #103 exact effective-config parity unmet. Share/load the same effective public analytics environment at both policy-writing entry points and add a real dotenv regression fixture; preserve platform process-env precedence.

### [P2] New runtime browser regressions are not enforced in CI yet

- Location: `.github/workflows/ci.yml:179–180` (browser job command); `apps/site/scripts/tests/mermaid-browser.test.mjs:17` (optional skip); new `scripts/p5-browser/{toc-browser,analytics-browser}.mjs`.
- The quality job's `pnpm site:test` discovers the Mermaid browser test but does not install the separate `scripts/p3-browser` Playwright dependency/Chromium, so that test skips there. The job that does install Chromium executes only the existing P3 `scripts/tests/site-browser-fixture.test.mjs`. Neither new TOC nor analytics browser script is invoked by any current CI command. Thus green CI would not require the delivered TOC accessibility/route cleanup, Mermaid runtime gates/theme/error handling, or enabled analytics CSP browser regressions to pass.
- Register all three focused browser checks in the existing browser job after its browser installation, with `REQUIRE_SITE_BROWSER=true` for Mermaid. Keep provider traffic intercepted and no Production actions. This is source quality coverage required for the first-batch delivery, not a new deployment gate.

## Validation and non-findings

- Node v22.23.3: 21/21 focused tests pass across `analytics-policy.test.mjs`, `toc-lifecycle.test.mjs`, `mermaid.test.mjs`, no skips.
- Independently ran `scripts/p5-browser/toc-browser.mjs`: PASS in all four desktop/mobile × sidebar/floating variants, four real Astro route swaps each, persistent JS global, actual Tab/Enter heading focus, one named navigation landmark/current location, detached captured click listener removed, exact-element reattachment with a single handler, zero page errors. The fixture honestly limits placement evidence to a synthetic shell; root's full-site layout verification is still separate.
- TOC cleanup matches capture removal, clears initial/retry/correction timers and tracked RAF, disconnects both observer types, restores forced content visibility and scroll behavior, resets DOM references and generation guards. No additional actionable TOC defect found in this pass.
- Mermaid runtime uses one module installation, dynamic import, serial render queue, retained per-element source, current DOM gate, disconnection checks and per-theme idempotence. Measurement container is hidden/aria-hidden and always removed; strict renderer output and readable parser-error fallback are deliberate. Independent real-browser rerun of `mermaid-browser.test.mjs` with `REQUIRE_SITE_BROWSER=true`: PASS, no skips; direct/SPA gates, repeated events, theme redraw, parser fallback and translated-like/back navigation covered.
- Independently ran `scripts/p5-browser/analytics-browser.mjs`: PASS, eight rendered provider scripts and eight controlled collectors, zero CSP violations, zero real vendor requests.
- Root moved the declaration from `.d.mts` (which its Vite build resolved as runtime source) to a narrow filename-pattern ambient `.d.ts` declaration. The pattern applies only to `*analytics-settings.mjs`, retains the actual config type and avoids runtime code. No actionable broad typing suppression was identified; root must retain full build/type evidence for this resolution change.
- Analytics origin tests cover enabled/disabled fixtures and shared Vercel policy output; controlled browser collectors establish CSP acceptance for the chosen endpoint matrix, not correctness of vendor SDKs or consent compliance. P8 consent remains out of scope.
- Full root type/build/exact-head CI verification remains root-owned; this review does not claim those results. No Production, provider, credential or remote actions were performed.

## Completion acceptance still to confirm

- Dotenv parity, CI browser registration, and required Site spec/user-doc sync are now addressed in the current worktree; focused reruns pass as recorded above. Do not conflate local harness success with public Production behavior.
- #105 independent review must come from another reviewer/root. Deferred Worker upstream-host escape is recorded in `gateway-later-roadmap.md`, not silently included in this first-batch implementation.

## Final delta review: integrated smoke and registration

- Reviewed `scripts/p5-browser/site-smoke.mjs`, latest CI registration, effective-build analytics helper/declaration, and Site README/security/quality contract deltas. CI installs Chromium, requires the focused Mermaid test, invokes TOC and analytics browser checks, then builds and runs the integrated default-profile smoke. These checks stay local and add no provider/deployment operations.
- Independently reran the integrated smoke on Node 22: PASS at 1600/390 widths, **five diagrams each**, same-document Astro forward navigation and Back, one current-location TOC, actual observed `sidebar: true`/`floating: false`, widths 246/360.25, zero default analytics requests and zero page errors. Global `git diff --check` also passed.
- CSP observation is accurately scoped: **nine existing Iconify fallback `connect-src` blocks per viewport**, zero unexpected violations. The harness allows only `connect-src` violations whose hostname is exactly `api.iconify.design`, `api.simplesvg.com`, or `api.unisvg.com`, reports the count, and fails all other cases. It does not widen generated CSP and must not be described as zero total CSP violations. All external routes remain aborted locally.
- One small test-strength finding sent to root: `site-smoke.mjs:45–47` records `placement.sidebar` but only asserts that floating is false and width is nonzero. To make the stated sidebar/visibility guarantee executable, assert `placement.sidebar === true` and `await toc.isVisible()`. Observed current output is correct; this is a regression assertion gap, not a reproduced layout regression.
- No further actionable runtime/helper/type/docs issue found in the final delta. Prior dotenv and browser-CI findings remain resolved. Independent #105 signoff remains excluded.

Root resolution of final smoke assertion note: added explicit `placement.sidebar === true` and `toc.isVisible()` checks; reran both viewport cases successfully. Existing Iconify blocks remain counted.
