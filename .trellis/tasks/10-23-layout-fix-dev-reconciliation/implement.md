# Execution plan

1. [x] User reviewed child 1 and confirmed the intentional entrance animation is the reported symptom.
2. [x] Reproduce the visual trigger, implement the narrowest causal fix, and add a regression check.
3. [x] Start from current `main` (`60691880f04ae8d36ef49f710edea09a89075514`); do not merge or replay audited dev commits because all are superseded by current-main CI, dependency/security policy, or architecture.
4. [x] Adopt/pin ADS v0.3 (`1e07d6c4bbd296b7d37dcd31934cfc70426f73ac`) in PR #166; merged as `446290d59de2f51d155a62c86d302dc2a5521e90`; exact-head and main post-merge CI passed; independent review passed. Advisory OCR returned HTTP 402 and is non-required.
5. [x] Verify the repository's merge policy. GitHub currently reports no branch protection/rulesets; use PRs, exact-head CI, and independent review, and obey any rules added before merge.
6. [x] Merge after gates passed; PR #167 bugfix merged as `c07569dddc431809662c034edd51c42c716ec42e`; PR #168 release merged as `12a95a12023eac707cb2e6211e121459cc9df4eb`; PR #169 reconciled dev as `33382d521a4a4dd5446e6c1edd9108d05687a9c7`. Required PR and post-merge CI passed; no matching Project item required an update.

## Current results

- [x] Started from `origin/main` `60691880f04ae8d36ef49f710edea09a89075514` on `codex/landing-hero-fade-in`; the five commits unique to the previous local audit branch were not carried over.
- [x] Removed the translation and renamed the local class/keyframe from `landing-fade-up` to `landing-fade-in`; opacity timing and reduced-motion behavior remain intact.
- [x] `node apps/site/scripts/qa-regression-check.mjs`, `pnpm site:type-check`, `pnpm site:astro-check`, `pnpm build`, `pnpm release:check`, `pnpm deploy:config:check`, and `git diff --check` passed. The full `pnpm site:test` suite now passes 147 tests including the added regression.
- [x] `apps/site/scripts/tests/landing-animation.test.mjs` guards the opacity-only animation and reduced-motion behavior; targeted test passes.
- [x] Production build output contains the expected opacity-only keyframe and no `translateY` declaration for the landing animation.
- [x] Independent bounded code review returned PASS for caller coverage, reduced-motion behavior, and compiled CSS.
- [x] Verified the local page in Ego Lite at 1440×900 and 390×844. During the initial 850ms, every `.landing-fade-in` element had `transform: none`; the hero copy's top coordinate stayed fixed and opacity moved from 0 to 1. Evidence: `research/evidence/local-animation-regression.json`.
- [ ] Follow up separately on a 24.5px movement of the third below-fold article card at mobile width while `document.fonts.status` changed from `loading` to `loaded`. The hero copy remained fixed, `scrollY` stayed at 0, and every sampled animation transform was `none`; this is outside the reported first-screen animation and was not changed here.
- [x] ADS PR #166 merged and required CI passed; OCR Advisory Review was unavailable (HTTP 402) and was not a required check.
- [x] Animation PR #167 merged; exact-head and post-merge CI passed. Release PR #168 and dev reconciliation PR #169 also merged with required CI passing.

**Known build note:** Astro prints a pre-existing `astro-icon` warning because `apps/site/src/icons/` is absent; the production build still completes successfully.

## Rollback

Before merge, close/revise the PR. After merge, use a reviewed revert PR. Do not force-push protected branches.


## Follow-up: Blog route and Explore snapshot

- [x] Reproduced production Blog → Explore → Categories. The outgoing open-menu snapshot is visible over the destination page around 80ms and gone by 140ms; screenshots and notes: `research/route-follow-up/production-reproduction.md`.
- [x] Checked cold direct Blog load: sampled `#top-row` and `#main-grid` geometry stayed stable; no LayoutShift entries were reported; the top progress indicator stayed hidden.
- [x] Give the desktop Explore dropdown its own transition identity and suppress its outgoing snapshot without changing the shared navbar fade or progress indicator.
- [x] Give the mobile nav panel its own transition identity; selecting a route link closes the panel and updates its expanded state before navigation.
- [x] Replayed Blog → Explore → Categories at 1512×838 and Blog → mobile menu → Categories at 390×844. At 80ms both menus are visually absent; after 700ms the progress indicator is opacity 0. Evidence: `research/route-follow-up/evidence/local-desktop-explore-categories-80ms.png` and `local-mobile-explore-categories-80ms.png`.
- [x] Confirmed keyboard focus on Explore still opens the dropdown through `:focus-within`.
- [x] Sampled 20 representative routes in both viewports (home, blog and page 2, categories and category detail, tags and tag detail, post, search, static/feature pages, and Chinese routes). All 40 had loaded fonts, no horizontal overflow, no non-input LayoutShift entries, and a hidden progress bar on direct load. Geometry and page results: `research/route-follow-up/evidence/local-direct-route-matrix.json`.
- [x] Ran `pnpm site:test` (146 pass, 0 fail, 1 skipped), `pnpm site:type-check`, `pnpm site:astro-check`, `pnpm build` (112 pages), `pnpm release:check`, regression QA, Vercel config check, Trellis validation, and `git diff --check`.
- [ ] Follow-up review and PR publication remain before merge; production has not been redeployed.
