# Baseline audit — 2026-10-23

## Outcome

The production hero's layout box is stable in clean initial loads and settled hard reloads at both tested viewports. The page does have an intentional `18px` fade-up animation on hero content, which moves visible elements over `680ms`. The user later confirmed that this is the reported “jump”; child task 2 removes the translation while retaining the fade.

The repository has three commits unique to `dev`; all have a reasoned disposition in [difference-ledger.md](difference-ledger.md). The current `main` tree is far ahead of the shared base, so wholesale `dev` reconciliation would reintroduce an obsolete tree. ADS v0.3 is published at the expected frozen commit and its guidance supports a pinned, focused adoption PR while preserving KIRARI's local instructions. GitHub currently has no branch protection rules or rulesets; use normal PRs with the task's required checks and independent review, and honor any policy enabled before merge.

## Repository and release state

- Fresh refs: `origin/main=60691880f04ae8d36ef49f710edea09a89075514`, `origin/dev=757b1aa9e5acb582ad71ee2f54491f48c6377f34`, merge base `5d3739a84c8bb813b89784e86a73032d95bd1696`.
- From the merge base, `main` has 104 unique commits and `dev` has 3. A direct tip-tree comparison reports 646 paths because `main` contains extensive later additions, removals, and replacements. The three-dot comparison isolates four changed paths: `.github/workflows/ci.yml`, `apps/site/package.json`, `pnpm-lock.yaml`, and `workers/kirari-edge/package.json`.
- `main` Actions run `39763638938` succeeded at the exact current main SHA. `dev` Actions run `39708782586` succeeded at the current dev SHA; the CI commit from PR #159 also has successful run `39706221585`. PRs #157 and #158 are merged to `dev`, and their verification and Vercel preview contexts succeeded. Open Dependabot PRs #164 and #165 target `dev` and are not part of the current `dev` tip.
- GitHub API inspection returned no branch-protection configuration and no rulesets. Status checks were green but are not enforced by a protected-branch rule; exact-head CI and independent review remain mandatory task gates regardless.
- GitHub Project #1 (“KIRARI — Development & Security”) has 34 items: 33 Done and #122 Todo. #122 concerns an unrelated `http-cache-semantics` follow-up; no current issue or Project item was found for the landing-page symptom or this audit.
- Vercel project `kirari-main` has Production deployment `dpl_6oe2yqC3dWAP6m5p9uVac3sapAZS` in READY state, sourced from the same `60691880…` main commit, serving `https://kirari-main.vercel.app/`. No deployment or project setting was changed.
- At the initial release-state check, tag `v0.5.1` was absent and `v0.5.0` existed. Re-check before any release action.

## ADS v0.3

- The official GitHub Release `v0.3` (release ID `421553315`) was published on 2026-10-23 at `07:24:28Z`; its tag peels to `1e07d6c4bbd296b7d37dcd31934cfc70426f73ac`.
- This checkout has no `.ads`, `.gitmodules`, or root `.ads` ignore entry. `.agents/skills/` currently contains the project Trellis skills; no ADS skills are installed.
- ADS `docs/how-to-update.md`, `docs/agent-adoption.md`, and `SAFETY.md` call for a pinned submodule SHA, explicit host discovery/linking for skills, and keeping consumer-specific instructions. The release does not prescribe a separate deployment controller.
- Recommendation: adopt exact SHA `1e07d6c4…` in a separate, reviewable PR; retain the existing KIRARI deployment facts and instructions in root `AGENTS.md`, and link or copy only the chosen skills through the host-supported `.agents/skills/` mechanism. This task made no ADS integration changes.

## Production browser evidence

Target: `https://kirari-main.vercel.app/`, Production SHA `60691880f04ae8d36ef49f710edea09a89075514`. Ego Lite v2.1.0 was available. The browser reported Chromium `154.0.8037.44` on macOS `27.0.1` arm64. Browser cache was disabled per page; profile cookies, local storage, and other existing profile data were left untouched.

| Check | Desktop | Mobile viewport emulation |
|---|---|---|
| Viewport | 1440×900, DPR 1 | 390×844, DPR 1 |
| Clean initial loads | 3; stable scroll Y 0; hero `(x=120,y=72,w=1200,h=541.09)` | 3; stable scroll Y 0; hero `(x=0,y=63,w=390,h=765.45)` |
| Settled hard reloads | 3; all hero boxes identical and scroll Y 0 | 3; all hero boxes identical and scroll Y 0 |
| Runtime errors / unhandled rejections in corrected hard-reload sample | None | None |
| Touch input | Not emulated | `pointer: coarse` was false; this checks responsive layout, not physical touch behavior |

The first hard-reload sample set captured `about:blank` before `.landing-hero` existed. It is retained for traceability but is not used as a result. The corrected six-run set waits for the hero and the scroll-restore window before measurement; see `evidence/hard-reload-confirmed.json`. The 90-sample initial-load capture is retained locally in `evidence/browser-matrix.json`; the audit above records its three-run geometry summary.

Home → `/blog/` → home navigation succeeded at both viewports. After scrolling to about `980px`, refreshing restored to about `980px` after the page's restore interval. The first instant after reload was at an intermediate scroll offset, then stabilized; this is consistent with existing logic in `apps/site/src/layouts/Layout.astro:280`–`293` and `:589`–`:829`, which hides the page for a saved nonzero scroll position and retries restoration while OverlayScrollbars initializes. The test initially contaminated repeated loads by reusing a tab whose session storage held the saved position; subsequent initial-load evidence used a fresh page with `sessionStorage.scrollPos` absent or zero.

Early source instrumentation found stable header, main, and hero box geometry. It recorded a tiny desktop text-link width shift (`0.00000758`) during Roboto loading. A corrected hard-reload observer also captured a `0.0388` shift entry from the decorative `.landing-glow-b` background on two of three desktop runs; the hero box remained unchanged. On one mobile source run a decorative glow shift carried `hadRecentInput=true`; it is excluded from CLS by the browser definition. These are recorded observations, not evidence that the hero content box jumps. No application exception or unhandled rejection was observed. The earlier 4,864-event browser capture had 18 `net::ERR_ABORTED` fetch cancellations caused by test navigations/reloads; no console exception was present.

The CSS at `apps/site/src/components/landing/LandingPage.astro:582`–`:592` initializes `.landing-fade-up` at `opacity:0` and `translateY(18px)`, then animates opacity and transform to their final values over 680ms. The rule applies to the hero copy, illustration, feature cards, and article cards. A browser-only stylesheet diagnostic disabled the transform and confirmed the movement came from this animation; it did not change production source. The compact controlled comparison and its two screenshots are in `evidence/motion-comparison.json`. `prefers-reduced-motion: reduce` disables the animation at `:872`–`:875`.

**Root-cause confidence:** high that the hero container does not undergo a geometry jump in the tested environment, and that the visible 18px movement came from the landing-page animation. The initial audit left the symptom match open; the user confirmed it during review below.

## User review

On 2026-10-23, the user confirmed that the 18px/680ms fade-up animation is the reported first-screen jump and authorized starting child task `10-23-layout-fix-dev-reconciliation`.

## Evidence files and limits

- Compact machine-readable browser evidence and the two motion-comparison screenshots are in `research/evidence/`. Full browser event/DOM traces and the wider screenshot set remain locally available there but are excluded from Git because they total about 20 MB.
- The report covers one production browser and emulated viewports. It does not establish behavior on a physical phone, other browser engines, a new/empty browser profile, assistive technology, or an alternate theme. `prefers-reduced-motion` was source-inspected but not run as a separate browser matrix.
- All checks were read-only. This task changed no runtime source, remote GitHub/Vercel state, branch ref, or tag.
