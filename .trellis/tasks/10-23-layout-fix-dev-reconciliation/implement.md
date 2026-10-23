# Execution plan

1. [x] User reviewed child 1 and confirmed the intentional entrance animation is the reported symptom.
2. [x] Reproduce the visual trigger, implement the narrowest causal fix, and add a regression check.
3. [x] Start from current `main` (`60691880f04ae8d36ef49f710edea09a89075514`); do not merge or replay audited dev commits because all are superseded by current-main CI, dependency/security policy, or architecture.
4. [x] Adopt/pin ADS v0.3 (`1e07d6c4bbd296b7d37dcd31934cfc70426f73ac`) in separate PR #166 and preserve KIRARI-specific instructions. Latest-head independent review passed; CI is pending.
5. [x] Verify the repository's merge policy. GitHub currently reports no branch protection/rulesets; use PRs, exact-head CI, and independent review, and obey any rules added before merge.
6. Merge only after all gates pass; record merge SHAs, exact-head Actions, and post-merge Actions. Update only relevant Project items, then hand off release-ready status to child 3.

## Current results

- [x] Started from `origin/main` `60691880f04ae8d36ef49f710edea09a89075514` on `codex/landing-hero-fade-in`; the five commits unique to the previous local audit branch were not carried over.
- [x] Removed the translation and renamed the local class/keyframe from `landing-fade-up` to `landing-fade-in`; opacity timing and reduced-motion behavior remain intact.
- [x] `node apps/site/scripts/qa-regression-check.mjs`, `pnpm site:type-check`, `pnpm site:astro-check`, `pnpm build`, `pnpm release:check`, `pnpm deploy:config:check`, and `git diff --check` passed. The full `pnpm site:test` suite now passes 147 tests including the added regression.
- [x] `apps/site/scripts/tests/landing-animation.test.mjs` guards the opacity-only animation and reduced-motion behavior; targeted test passes.
- [x] Production build output contains the expected opacity-only keyframe and no `translateY` declaration for the landing animation.
- [x] Independent bounded code review returned PASS for caller coverage, reduced-motion behavior, and compiled CSS.
- [x] Verified the local page in Ego Lite at 1440×900 and 390×844. During the initial 850ms, every `.landing-fade-in` element had `transform: none`; the hero copy's top coordinate stayed fixed and opacity moved from 0 to 1. Evidence: `research/evidence/local-animation-regression.json`.
- [ ] Follow up separately on a 24.5px movement of the third below-fold article card at mobile width while `document.fonts.status` changed from `loading` to `loaded`. The hero copy remained fixed, `scrollY` stayed at 0, and every sampled animation transform was `none`; this is outside the reported first-screen animation and was not changed here.
- [ ] ADS PR #166: the independent review passed. Exact-head CI is running; the separate “Advisory OCR Review” workflow failed because OpenRouter returned HTTP 402 (insufficient credits). It is not configured as a branch protection check; treat it as unavailable, not as a successful review.
- [ ] Open the animation bugfix PR. PR checks, merge, and post-merge verification remain outstanding.

**Known build note:** Astro prints a pre-existing `astro-icon` warning because `apps/site/src/icons/` is absent; the production build still completes successfully.

## Rollback

Before merge, close/revise the PR. After merge, use a reviewed revert PR. Do not force-push protected branches.
