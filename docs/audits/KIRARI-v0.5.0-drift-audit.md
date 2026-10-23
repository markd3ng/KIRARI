# KIRARI v0.5.0 post-release drift audit

Audit date: 2026-10-22 (Asia/Shanghai)
Repository: `markd3ng/KIRARI`
Audit branch: `codex/v0.5.0-post-release-audit`

## Baseline

| Record | Verified value |
|---|---|
| Current `main` | `4bedd3904e468d3b68b16cbb56b98bdff00e4c2e` |
| Release tag | Annotated `v0.5.0`, tag object `cb74d1338e6f493fbf170d5089a46035124e9f7e`, peeled commit `b55ec2e1fde8c69d0a1534b7cb97a8704978dd98` |
| Tag CI | Run [39744139965](https://github.com/markd3ng/KIRARI/actions/runs/39744139965), success at the tag target |
| Current-main CI | Run [39745698669](https://github.com/markd3ng/KIRARI/actions/runs/39745698669), success at the exact current main SHA; `verify`, browser fixtures, Site browser validation and informational dependency audit completed successfully. The composition job was correctly skipped for this push. |
| Vercel target | Team `team_NsBZHGUVnyygP7veiROKLuUx`, project `kirari-main` / `prj_QNMVdxTkPOad4ynN4fwFCYEST8Jk` |
| Current Production | `dpl_2HUQVRnZZBZigR7UnpQMdtNqeNeo`, `READY`, `Production`, Git source `markd3ng/KIRARI`, branch `main`, exact SHA `4bedd3904e468d3b68b16cbb56b98bdff00e4c2e` |
| Canonical domain | `kirari-main.vercel.app` is attached to the current Production deployment; a live `HEAD /` returned HTTP 200 on 2026-10-22. |

`main` is 7 Trellis archival file changes ahead of `v0.5.0` and has no application/runtime changes relative to the tagged release. PR #162 archived the release task. No GitHub Release record exists; the release task explicitly requested a Git tag only, and the annotated tag plus its CI are present.

The current Production read is metadata plus an HTTP header request. It confirms the deployed identity and serving response, but does not repeat the release-time full browser smoke test.

## Current planning source and Project #1

The current GitHub Project API returned 34 unique Issue items and 16 fields. The 33 P0–P8 items are all `CLOSED`, `Done`, and `Completed Phase`; Issue #122 is `OPEN`, `Todo`, and `Backlog`, with no Phase or Priority. No duplicate or missing roadmap Issue was found. The phase counts for the 33 roadmap items are P0: 1, P1: 4, P2: 7, P3: 3, P4: 6, P5: 8, P6: 1, P7: 1, P8: 2.

The 16 configured fields are Title, Assignees, Status, Labels, Linked pull requests, Milestone, Repository, Reviewers, Parent issue, Sub-issues progress, Created, Updated, Closed, Priority, Phase, and Roadmap Status. Twelve parent links and 37 direct blocker links were returned; every blocker endpoint is closed. No Project milestone is assigned. The Linked pull requests field currently contains values for #102 → PR #146 and #111 → PR #148 only; the audit matrix records the merged PR evidence for every roadmap item without changing these Project values. Priority is unset on completed sub-issues #129–#132 and on backlog #122; no acceptance rule requires assigning a new priority to those closed sub-issues, so those values were preserved.

The Project's previous top checkpoint was stale: it named main `5d9303c`, old CI run `39717053085`, old Production deployment `dpl_9kXdksxpf1YUTTjCrL6PuQYdKYch`, and said no version tag existed. The Project README has been refreshed with this audit baseline and the current #122 / `dev` status. Item identities, fields, statuses, dependencies, and historical checkpoints were left untouched.

### P0–P8 trace matrix

Every row below is present as a GitHub Issue and currently `CLOSED / Done / Completed Phase`. Source and test references are in the current tree on `main`; the PR links identify the corresponding merged delivery record. Status words are deliberately scoped: `IMPLEMENTED` is source evidence, `VERIFIED` is test/CI evidence, and `DEPLOYED` is used only where the Production read confirms it.

| Issue | Phase | Delivery trace and current evidence |
|---|---:|---|
| [#86](https://github.com/markd3ng/KIRARI/issues/86) | 0 | PR [#93](https://github.com/markd3ng/KIRARI/pull/93); repo baseline and security/remediation queue are retained in the P0 Trellis archive; current release and native deployment contracts are in `.github/workflows/ci.yml` and `docs/SITE_PRODUCTION.md`. IMPLEMENTED, VERIFIED. |
| [#87](https://github.com/markd3ng/KIRARI/issues/87) | 1 | PR #93; current security updates in PR [#160](https://github.com/markd3ng/KIRARI/pull/160), `apps/site/package.json`, and `pnpm-lock.yaml`; current exact-main dependency-audit job is in CI run 39745698669. IMPLEMENTED, VERIFIED. |
| [#88](https://github.com/markd3ng/KIRARI/issues/88) | 1 | PR #93; current dependency tree and audit workflow use `pnpm-lock.yaml` and the informational `dependency-audit` job in `.github/workflows/ci.yml`. IMPLEMENTED, VERIFIED. |
| [#89](https://github.com/markd3ng/KIRARI/issues/89) | 1 | PR #93; full audit policy and retained findings are implemented by the `dependency-audit` job in `.github/workflows/ci.yml`; PR #160 contains the compatible fixes adopted for v0.5.0. IMPLEMENTED, VERIFIED. |
| [#90](https://github.com/markd3ng/KIRARI/issues/90) | 2 | PR #93; regression checks are in `scripts/release-regression-check.mjs`, `scripts/tests/`, and CI. IMPLEMENTED, VERIFIED. |
| [#91](https://github.com/markd3ng/KIRARI/issues/91) | 3 | PR #93; standard source, browser, release, and exact-main CI are present in `.github/workflows/ci.yml`; current main run 39745698669 succeeded. VERIFIED. |
| [#92](https://github.com/markd3ng/KIRARI/issues/92) | 3 | PR #93; current release checks are `scripts/release-regression-check.mjs` and `scripts/release-version-check.mjs`; v0.5.0 tag and tag CI are verified above. VERIFIED, RELEASED. |
| [#95](https://github.com/markd3ng/KIRARI/issues/95) | 1 | PR [#113](https://github.com/markd3ng/KIRARI/pull/113); `scripts/composition-provenance.mjs`, `scripts/build-composed-site.mjs`, and `apps/site/scripts/tests/composition-provenance.test.mjs`. IMPLEMENTED, VERIFIED. |
| [#96](https://github.com/markd3ng/KIRARI/issues/96) | 2 | PRs [#115](https://github.com/markd3ng/KIRARI/pull/115), [#121](https://github.com/markd3ng/KIRARI/pull/121), and [#123](https://github.com/markd3ng/KIRARI/pull/123); read-only config/profile materialization and CI contracts are in `scripts/check-profile-materialization.mjs`, `apps/site/scripts/profile-manifest.mjs`, and `scripts/tests/ci-profile-contract.test.mjs`. IMPLEMENTED, VERIFIED. |
| [#97](https://github.com/markd3ng/KIRARI/issues/97) | 2 | PR #115 and correction PRs [#127](https://github.com/markd3ng/KIRARI/pull/127), [#128](https://github.com/markd3ng/KIRARI/pull/128); starter/profile mappings and checks are in `apps/site/scripts/profile-manifest.mjs`, `scripts/materialize-profile.mjs`, and Site profile tests. IMPLEMENTED, VERIFIED. |
| [#98](https://github.com/markd3ng/KIRARI/issues/98) | 3 | PR [#125](https://github.com/markd3ng/KIRARI/pull/125); portable Site output and browser validation are in `scripts/p3-browser/`, `scripts/tests/p3-browser-contract.test.mjs`, and `scripts/tests/site-browser-fixture.test.mjs`. IMPLEMENTED, VERIFIED. |
| [#99](https://github.com/markd3ng/KIRARI/issues/99) | 4 | PR [#143](https://github.com/markd3ng/KIRARI/pull/143); native Git config is generated by `apps/site/scripts/generate-vercel-config.mjs`; current Production identity is exact-main and READY. IMPLEMENTED, VERIFIED, DEPLOYED. |
| [#100](https://github.com/markd3ng/KIRARI/issues/100) | 7 | PRs [#152](https://github.com/markd3ng/KIRARI/pull/152), [#153](https://github.com/markd3ng/KIRARI/pull/153), [#154](https://github.com/markd3ng/KIRARI/pull/154); post-deployment workflow and event verification are `.github/workflows/post-production-indexing.yml`, `apps/site/scripts/submit-indexing-after-deployment.mjs`, and `apps/site/scripts/verify-indexing-event.mjs`. Google Indexing API remains disabled. IMPLEMENTED, VERIFIED. |
| [#101](https://github.com/markd3ng/KIRARI/issues/101) | 6 | PR [#151](https://github.com/markd3ng/KIRARI/pull/151); source-backed Markdown views, canonical URLs, language indexes, and retained `llms-full.txt` are in `apps/site/src/utils/llm-*`, `apps/site/scripts/postbuild.mjs`, and `apps/site/scripts/tests/llms-output.test.mjs`. IMPLEMENTED, VERIFIED. |
| [#102](https://github.com/markd3ng/KIRARI/issues/102) | 5 | Security boundary PR [#145](https://github.com/markd3ng/KIRARI/pull/145) and Core PR [#146](https://github.com/markd3ng/KIRARI/pull/146); `packages/edge-gateway-core/src/`, its operation/cache tests, and `workers/kirari-edge/test/`. IMPLEMENTED, VERIFIED. |
| [#103](https://github.com/markd3ng/KIRARI/issues/103) | 5 | PR [#144](https://github.com/markd3ng/KIRARI/pull/144); `apps/site/src/utils/analytics-settings.mjs`, `apps/site/scripts/security-policy.mjs`, and `apps/site/scripts/tests/analytics-policy.test.mjs`. IMPLEMENTED, VERIFIED. |
| [#104](https://github.com/markd3ng/KIRARI/issues/104) | 5 | PR #144; TOC lifecycle and accessibility are in `apps/site/src/components/widget/TOC.astro`, `apps/site/scripts/tests/toc-lifecycle.test.mjs`, and `scripts/p5-browser/toc-browser.mjs`. IMPLEMENTED, VERIFIED. |
| [#105](https://github.com/markd3ng/KIRARI/issues/105) | 5 | PR #144; Trellis sync validation is in `scripts/check-trellis-adapter-sync.mjs` and `scripts/tests/trellis-adapter-sync.test.mjs`. IMPLEMENTED, VERIFIED. |
| [#106](https://github.com/markd3ng/KIRARI/issues/106) | 8 | PR [#155](https://github.com/markd3ng/KIRARI/pull/155); eight-provider configuration, owner gate, visitor opt-out persistence, and tests are in `apps/site/src/utils/analytics-*`, `apps/site/src/utils/privacy-settings.mjs`, `apps/site/src/components/PrivacySettings.svelte`, and privacy/analytics tests. IMPLEMENTED, VERIFIED. |
| [#107](https://github.com/markd3ng/KIRARI/issues/107) | 8 | PR #155; named AdSense slots, Production-only request gating, and tests are in `apps/site/src/components/Ads.astro`, `apps/site/src/components/AdSlot.astro`, `apps/site/src/utils/ads-*`, and `apps/site/scripts/tests/ads-settings.test.mjs`. IMPLEMENTED, VERIFIED. |
| [#109](https://github.com/markd3ng/KIRARI/issues/109) | 5 | PR #144; Mermaid preprocessing and SPA lifecycle are in `apps/site/src/plugins/rehype-mermaid-pre.mjs`, `apps/site/src/utils/mermaid-runtime.ts`, and Mermaid browser/unit tests. IMPLEMENTED, VERIFIED. |
| [#110](https://github.com/markd3ng/KIRARI/issues/110) | 5 | PR [#147](https://github.com/markd3ng/KIRARI/pull/147); Cloudflare adapter and cache tests are in `workers/kirari-edge/src/cloudflare-gateway.ts` and `workers/kirari-edge/test/cloudflare-gateway.test.ts`. IMPLEMENTED, VERIFIED; no live Worker deployment was required. |
| [#111](https://github.com/markd3ng/KIRARI/issues/111) | 5 | PR [#148](https://github.com/markd3ng/KIRARI/pull/148); Vercel adapter behavior is in `packages/edge-gateway-vercel/src/` and `packages/edge-gateway-vercel/test/`. IMPLEMENTED, VERIFIED; no live adapter deployment was required. |
| [#112](https://github.com/markd3ng/KIRARI/issues/112) | 5 | PR [#149](https://github.com/markd3ng/KIRARI/pull/149) and cross-platform path correction PR [#150](https://github.com/markd3ng/KIRARI/pull/150); EdgeOne adapter/package tests are in `packages/edge-gateway-edgeone/`. IMPLEMENTED, VERIFIED; no live Makers deployment was required. |
| [#117](https://github.com/markd3ng/KIRARI/issues/117) | 2 | Provenance correction PR #121; artifact identity is validated by `scripts/composition-provenance.mjs` and provenance tests. IMPLEMENTED, VERIFIED. |
| [#118](https://github.com/markd3ng/KIRARI/issues/118) | 2 | PR #123 and the P2 archived task record; the OCR outage is recorded separately from source/test acceptance in `.trellis/tasks/archive/2026-10/10-03-p2-site-inputs-readonly-ci/`. ACCEPTED evidence handling; no false OCR pass. |
| [#119](https://github.com/markd3ng/KIRARI/issues/119) | 2 | Profile artifact correction PRs #127/#128; output digest checks are in `scripts/composition-provenance.mjs` and its tests. IMPLEMENTED, VERIFIED. |
| [#120](https://github.com/markd3ng/KIRARI/issues/120) | 2 | PR #115 and P2 correction evidence; profile source/target counts are enforced by `scripts/check-profile-materialization.mjs` and Site profile tests. IMPLEMENTED, VERIFIED. |
| [#129](https://github.com/markd3ng/KIRARI/issues/129) | 4 | PR #143; `vercel.json`, `apps/site/scripts/generate-vercel-config.mjs`, and the native deployment architecture test restore provider-native Git behavior. IMPLEMENTED, VERIFIED. |
| [#130](https://github.com/markd3ng/KIRARI/issues/130) | 4 | PR #143; root build/output contract is covered by `scripts/tests/site-package-output.test.mjs` and the current Production build record. IMPLEMENTED, VERIFIED. |
| [#131](https://github.com/markd3ng/KIRARI/issues/131) | 4 | PR #143; current Vercel metadata confirms repository, `main`, Production, exact SHA, READY, and canonical alias; release archive contains the live browser smoke. VERIFIED, DEPLOYED. |
| [#132](https://github.com/markd3ng/KIRARI/issues/132) | 4 | PR #143; current recovery contract is `docs/SITE_PRODUCTION.md`, `docs/VERCEL.md`, and `DEPLOY.md`. IMPLEMENTED, VERIFIED. |
| [#135](https://github.com/markd3ng/KIRARI/issues/135) | 4 | Closed by Owner decision as superseded; no C1/R3 trusted-source or approval-binding controller exists in active CI. SUPERSEDED, not an outstanding implementation requirement. |

## Functional and architecture review

- **Core/Site:** immutable Core/Site inputs, Site Contract v2, external builds, provenance, and portable output are implemented in root scripts and exercised by composition/profile tests. Current Project items #95–#98 and correction items #117–#120 are closed. No change was made to the runtime contract.
- **Deployment:** current architecture is GitHub source CI plus Vercel native Git Preview/Production. `docs/HANDOFF.md`, `DEPLOY.md`, `docs/VERCEL.md`, and `docs/SITE_PRODUCTION.md` describe the current model. Active workflows are source CI, advisory OCR, and post-Production indexing; there is no custom Production promotion controller. Historical C1/R3/Trusted Sources workflows are superseded.
- **Gateway:** portable Core and all three adapters have allowlisted operations, platform-specific cache bindings, security boundaries, and automated tests. The current release did not deploy Cloudflare or EdgeOne adapters to live environments; those were not required for their code/package acceptance and remain platform-validation limits.
- **Content/SEO:** LLMs v2 emits canonical Markdown views and indexes while retaining `llms-full.txt`; tests cover emitted outputs. IndexNow lives in a separate post-Production workflow and verifies the native Production event. Google Indexing API remains disabled.
- **Analytics/Ads:** source supports GA4, Umami, Plausible, Clarity, Fathom, Simple Analytics, Matomo, and Amplitude; visitor categories default enabled and persist opt-out, while owner-level provider settings gate actual requests. AdSense uses named slots and is Production-only; test fixtures verify no Local/Preview ad requests. The public profile has no real GA4 or AdSense identifiers and no publisher `ads.txt`; this is an accepted configuration state, not missing P8 code.
- **Changelog and handoff:** `CHANGELOG.md` has a v0.5.0 entry; `docs/HANDOFF.md` agrees with the current 33-complete / #122-backlog plan and native deployment architecture. No stale active handoff was found.

## Drift findings

| ID | Severity / classification | Finding and evidence | Resolution |
|---|---|---|---|
| D-01 | Low — `DOCUMENTATION_DRIFT` | Root README files listed Astro 6.4.8, MDX 6.0.3, and other stale package versions; the Site Trellis index also described the app as Astro 6 while the current manifest declares Astro 7.3.5. Quick Start and deployment instructions remained valid. | Fixed both README stack tables from `apps/site/package.json`, updated the verified Trellis index to Astro 7, and added regression checks for the README versions/islands and Trellis Astro major. Historical CHANGELOG entries were preserved. |
| D-02 | Low — `DOCUMENTATION_DRIFT` | Both READMEs said there were three client islands. A scan of all Astro client directives found six unique Svelte islands: `Search`, `LightDarkSwitch`, `DisplaySettings`, `PrivacySettings`, `DevicesFilter`, and `SharePoster`, with `client:idle`, `client:only="svelte"`, or `client:load`. `DevicesFilter` occurs on both default and localized routes. | Fixed both READMEs with component, route/use condition, and hydration directive; the sync test re-scans `.astro` source. |
| D-03 | Medium — `EVIDENCE_GAP` | PR #161 has no GitHub Review submissions. The archived release task records Advisory OCR run 39742831089 failed with OpenRouter HTTP 402 and produced no OCR review. Its in-process review found/fixed one CSP classifier issue but is not independent review evidence. No record supports claiming a second reviewer reviewed PR #161 before merge. | Kept the gap explicit. It does not imply a known code defect or retroactively invalidate the accepted deployment; carry independent exact-head review into the next release checklist. |
| D-04 | Informational — no current drift | Issue #122 contains dated historical wording that main was on `http-cache-semantics` 4.2.0. The current lock resolves 4.3.0 and the latest Owner comment explicitly says this is not proof of a behavior fix. The current [GitHub Advisory](https://github.com/advisories/GHSA-ch52-4w7c-c8xp) still lists affected versions `<=4.2.0` and no patched version. Current audit CI succeeded, but that is not upstream behavior proof. | Issue #122 remains OPEN / Todo / Backlog and nonblocking, per the latest Owner comment. No forced override or version-only remediation claim. |
| D-05 | Informational — `ACCEPTED_DEVIATION` | `dev` is 3 commits ahead and 103 behind `main`. Its three unique commits are PRs #157–#159: dependency updates from the older Astro 6.4.8 baseline and a legacy workflow audit-step change; no Site or Gateway implementation is unique to `dev`. The package candidate changes require fresh compatibility review on current main; PR #159's required-step model is superseded by main's separate informational audit job. | No merge, rebase, or cherry-pick. Project README records the divergence; continue feature work from `main`. |
| D-06 | Low — `PROJECT_DRIFT` | The Project README top checkpoint lagged current main, CI, Production, tag, and dev divergence. | Fixed its current checkpoint and verified the saved readback, preserving prior history and Project items. |

## Accepted deviations and limits

- No GitHub Release object was created because the archived release plan requested an annotated Git tag only; `v0.5.0` and its CI are present.
- The post-tag main delta contains only Trellis archival files from PR #162.
- Real Analytics/Ads provider IDs are intentionally absent in this public repo. The application features are implemented, but no actual GA4 or AdSense request is claimed for the current profile.
- Live Cloudflare Cache and EdgeOne Makers runtime behavior was not exercised; adapter code/package acceptance is independently test-backed and does not require live deployment.
- `dev` remains unreconciled and is not a safe base for current feature work; the three unique commits were inspected and contain no missing application behavior.
- Local `pnpm build` emitted the existing optional `astro-icon` warning that `apps/site/src/icons` is absent, then built all 112 pages successfully. This audit did not change or suppress the warning.
- Opening PR #163 triggered the repository’s normal Vercel Preview builds; its Preview checks passed. No manual Production deployment, Production configuration, credentials, tag, or release action was performed. Issue #122 remains open.

## Verification and verdict

The post-release baseline is verified for current Project/Issue state, current `main`, annotated tag target, exact-SHA Production deployment, canonical alias, CI, active deployment architecture, changelog, and handoff. D-01, D-02, and D-06 are fixed in this audit change. No functional or unauthorized architecture drift was found. `pnpm site:test` passed 146 tests; `pnpm site:type-check`, `pnpm site:astro-check` (0 errors/warnings/hints), `pnpm build`, `pnpm release:check`, and `git diff --check` passed. Project field gaps were recorded but not rewritten: PR links are populated only for #102/#111; Priority is blank for #129–#132 and #122; Milestone is blank throughout. These do not change the verified acceptance state.

**Final verdict: `PARTIAL`.** The outstanding item is D-03: the release PR lacks independent-review evidence. The audit cannot retroactively create that pre-release evidence, and no new review has been represented as independent. This is a process evidence gap, not a release rollback or merge blocker for this documentation-only audit PR.

The audit PR remains open for Owner review; it is not merged. No tag or Production operation was performed.
