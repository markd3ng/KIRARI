# Core/Site compatibility audit — native Git deployment correction

Date: 2026-10-14. Scope: Step A, source research only. Checkout: `/Users/ian/.codex/worktrees/p4-c1-hobby/KIRARI`, branch `codex/native-git-deployment-correction`, inspected baseline `c6db5da47d1b5d853a38032e1b676fb0cf2c013a`.

The active task's `prd.md`, `design.md` and `implement.md` supersede the former custom Production admission design. Hosting-provider Git integration should own main → Production and feature branch → Preview. Actions should retain quality checks and portable Core/Site output, without becoming another deployment controller.

## Recommendation

**KEEP** immutable Core/Site selection, external Site builds, portable export/provenance, safe archive/input parsing, browser health and optional application gateway adapters. **REMOVE** P3 upload/staging and P4 admission/stage/promote/rollback controllers. **SPLIT** shared artifact and browser modules before deleting their controller imports. Portable Build Output packaging is an export capability; it can survive without any publisher or mandatory release gate.

Two removal hazards are already present in ordinary product tests: local browser validation transitively imports `p4-production/production-validation.mjs`, and composition/security tests consume `package-vercel-site.mjs` through `site-artifact.mjs`. Deleting these directories/files wholesale loses product behavior and security coverage.

## Current consumer chain

| Entry point | Current chain | Required surviving behavior |
| --- | --- | --- |
| Default site build | `pnpm build` → `@kirari/site` build → profile materialization → optional gateway adapter materialization → Astro → postbuild | Native Git can run the ordinary application build; preserve routing/security headers and adapter generation. |
| External Site | `build.sh --site` → `scripts/build-external-site.mjs` → profile/v2 contract validation → disposable build workspace → output replacement | Separate Site inputs, source immutability, filtered build environment, deterministic build clock, lock/recovery handling and successful-output replacement. |
| Core/Site composition | `build.sh --compose` → `scripts/build-composed-site.mjs` → `scripts/composition-provenance.mjs` → external Site builder | Exact Core/Site revisions or explicit local Site content digest, clean/disjoint inputs, frozen toolchain, `dist/` plus provenance export. |
| Actions composition | `.github/workflows/ci.yml` composition job → separate pinned checkouts → selected Core builder → portable artifact upload → `package-vercel-site.mjs` | Read-only quality/build/export. Automatic Site uses event SHA and `.kirari/core` gitlink; safe Site subdirectory selection remains. |
| Build Output export | `package-vercel-site.mjs` → provenance validation → `_headers`/`_redirects` parsing → `.vercel/output/{config.json,static}` plus manifest | Optional static export, route metadata, exact provenance copy and output integrity; no automatic deployment side effect. |
| Artifact transport/integrity | `site-artifact.mjs` → `extract-site-artifact.py`, provenance/tree digests, package/upstream byte comparison | Bounded downloads and safe extraction, artifact identity/hash checks and local structural integrity, independent of a release approval. |
| Local browser fixtures | CI browser-fixtures → `p3-browser/build-fixtures.mjs` → external build → `validate.mjs --dist-root` → contract/browser-health | Minimal/full/migrated external Sites; real Chromium; route/content/assets/navigation/404 and network/console checks. |
| Production-like browser fixture | CI production-fixtures → `p3-browser/production-fixture.mjs` → browser-health/production browser helpers → P4 validation | Real Chromium canonical/robots/header/static-output negatives; remove fabricated Owner authorization and stage/live/restore record dependencies. |
| P3/P4 deployment | `site-staging.yml`, `site-production.yml`, `c1-readiness.yml` → bespoke upload/admission/controller scripts | Retire. Native Preview/Production must not compete with these Actions publishers. |

## KEEP: product build and reproducibility

1. **`build.sh`, `scripts/build-external-site.mjs`, `scripts/build-composed-site.mjs`.** No-argument build currently clears external Site/build-only selectors and invokes `pnpm build`; explicit external/composed modes retain their product contracts. External output locking, interrupted-build recovery and watchdog/temp cleanup protect local output, and are not hosting rollback controllers.
2. **`scripts/composition-provenance.mjs`.** Preserve `selectBuildEnvironment`, Git/local input resolution, tree digests, manifest creation/validation and rechecking inputs after build. It records exact Core/Site revision/subdirectory or Site content digest, toolchain, build clock and build-environment digest. Its normalized artifact digest intentionally normalizes specific Astro island UID and Pagefind language nondeterminism; do not describe that digest as universal byte equality.
3. **`apps/site/scripts/profile-manifest.mjs`, `materialize-profile.mjs`, `check-site-profile.mjs`, `site-contract-v2.mjs`, `site-contract-v2-migration.mjs` and CLI wrappers.** Keep authoritative configuration/content/data/image/snippet mappings, required fallback images, optional-input cleanup, v2 readiness and selected Core-pin checks. Preserve symlink/special-file rejection and read-only external Site treatment.
4. **`packages/site-profile/` and Site Contract v2 fixtures.** Core/Site remains a product boundary. Automatic config composition must use the Site's exact `.kirari/core` gitlink, not the current Core main branch. Explicit manual composition may select another exact Core revision and must record it truthfully.
5. **`apps/site/scripts/materialize-ghc-adapter.mjs`, application routes/adapters and `workers/kirari-edge/`.** These are optional application capabilities, unrelated to `scripts/p4-production/runtime-adapter.mjs`. Native hosting must continue generating the configured Vercel/Cloudflare gateway adapter. A static-only Build Output export may reject functions without prohibiting runtime routes in ordinary native hosting.
6. **`apps/site/scripts/postbuild.mjs` and indexing safeguards.** IndexNow/Google submissions stay explicit opt-in; external/composition builds continue forcing build-only behavior. Production health must support deliberate noindex as well as opt-in indexing, rather than adopting the retired P4 rule that every approved Production release is indexable.

CI composition currently installs workflow-root parse5 separately from the selected Core's frozen dependencies. This separation is useful: workflow code may be newer than the selected Core, while the product builder belongs to the pinned Core. Keep both toolchain validation and safe in-checkout Site-subdirectory checks. A portable artifact's Core SHA need not equal the workflow-source SHA for an automatic config build; the old release predicate requiring that equality must not become a general Core/Site rule.

## SPLIT: export and artifact security from release admission

| Source | KEEP / extract | REMOVE / simplify |
| --- | --- | --- |
| `scripts/package-vercel-site.mjs` | Static Build Output v3 conversion, `parseHeaders` at line 64, `parseRedirects` at line 82, safe restricted pattern parsing, provenance/output digest and browser route metadata. | Remove hardcoded `target={kirari-test,preview,prebuilt}` deployment destination coupling from the portable export contract and verifier expectations. Keep format identity separately. No publisher should consume exports automatically; no deploy credentials should be required to export. |
| `scripts/verify-site-package.mjs` | Local export verification wrapper, if retained as product tooling. | Release-only expectation that package Core SHA equals a main/manual CI head. An optional explicit expected Core SHA is valid only when it refers to the selected Core. |
| `scripts/site-artifact.mjs` | Safe file inventory; local package/provenance verification; `sha256File`; ZIP extraction/member reads; bounded GitHub artifact transport and archive digest/retention/identity checks; exact upstream provenance/static-byte/routing comparison. | `vercelRequest` at line 572 is authenticated deployment API plumbing. `uniqueUploads` is upload-specific. Remove their dead controller-only consumers. Separate successful-main-manual source/run predicates and original Preview-target admission from portable integrity checks. |
| `scripts/extract-site-artifact.py` | Full archive safety: new destination, POSIX/NFC path rules, traversal/absolute/backslash/colon rejection, no symlinks/special/encrypted entries, duplicate/file-directory conflict rejection, size/depth/entry/compression bounds, exclusive file writes and cleanup on failure. | Nothing here is intrinsically a deployment admission requirement. Preserve it while any product archive import/read capability remains. |

`verifySitePackage()` at `site-artifact.mjs:252` currently combines integrity and release assumptions. Its upstream comparison confirms that exported static files and route translations match the actual composition input. That is valuable product validation. Its default original Preview target, source-CI equality and `verifySitePackageArchive` source-run admission should be separated so legitimate config builds are not rejected merely because their selected Core differs from workflow source.

Prefer keeping the existing portable packager and useful verification CLI while deleting only controller-specific API execution and approval checks. No new exporter abstraction is needed merely to remove a controller. If a module is moved, change every caller and preserve its validation/error handling.

Native Git hosting rebuilds from Git input. The old promise that Production is the same uploaded CI package does not follow from that architecture. A byte comparator can remain an optional read-only diagnostic when matching output is available; it must not introduce another mandatory publish/approval path or claim native equivalence without observation.

## SPLIT: browser checks from P4 authorization

| Source | Product capability to retain | Controller dependency to retire |
| --- | --- | --- |
| `scripts/p3-browser/contract.mjs` | parse5 route/title/content/navigation and required stylesheet/script/image discovery; root/localized redirect handling. | None. Folder renaming is optional and need not create a broad refactor. |
| `scripts/p3-browser/browser-health.mjs` | Browser document status/title/content, navigation, essential asset loads, unknown-route 404, Preview noindex and configured Production canonical/indexing checks. | Its unconditional `production-browser-helpers` import reaches P4; repair before deleting P4. |
| `scripts/p3-browser/production-browser-helpers.mjs` | `assertIndexableHeaders` and canonical-link checking when indexing is enabled. | Import of `ProductionValidationError` and `productionCanonicalMatchesRoute` from P4. Move the small shared static/browser primitives to a neutral surviving module. |
| `scripts/p3-browser/validate.mjs` | `--dist-root` server, safe path resolution, Chromium execution, reports, routes/assets/navigation, network/console/page errors and public read-only URL checks. | `requestGithubOidcToken`, automatic OIDC acquisition for all remote mode, `--binding`, staged/live/restore phases, prior-release record, `assertProductionDeployment`. Live native verification should use actual native deployment metadata plus commit/domain, not old artifacts/approval bindings. |
| `scripts/p3-browser/production-fixture.mjs` | Real Chromium fixture and canonical/robots/header/byte-integrity negatives. | Imports of production-authorization, fabricated Owner binding, staged deployment admission and bespoke release-report assertion. Rewrite it as an ordinary application/browser fixture. |
| `scripts/p3-browser/request-routing.mjs` | Exact origin classification, expected external-origin allowlist, redirect bounds, external request blocking, request-failure reporting and stripping sensitive authorization/cookie/proxy headers on foreign-origin hops. | Mandatory Trusted OIDC header/token plumbing. Any optional protected native read-only QA should be separately scoped, never a C1/Trusted Sources deployment gate. |
| `scripts/p3-browser/github-oidc.mjs`, `create-staging-record.mjs` | No mandatory product build/browser dependency. | Remove automatic bespoke auth acquisition and release/staging record generation after callers are rewritten. |

`scripts/p4-production/production-validation.mjs` is mixed. Extract only the surviving plain HTTPS/canonical-route, static file walk/inventory, robots/sitemap/header/noindex and optional remote byte-comparison utilities. Retire `assertProductionAuthorizationBinding`, `assertProductionTargetSnapshot`, `assertProductionDeployment` and the phase/record requirements of `assertProductionBrowserReport`. `verifyDeployedStaticOutput` currently throws `PRODUCTION_OIDC_TOKEN_MISSING`; neutral public read-only verification cannot retain mandatory OIDC. Preserve same-origin redirect restrictions and bounded reading when decoupling that argument.

Browser reports must continue identifying failures; an inaccessible protected page or missing native deployment metadata cannot count as verified Production. Conversely, local fixtures are ordinary CI proof and should not require provider credentials or live policy readback.

## REMOVE: competing hosting controllers

After the above shared imports are repaired, retire:

- `.github/workflows/site-staging.yml`, `.github/workflows/site-production.yml`, `.github/workflows/c1-readiness.yml`.
- `scripts/deploy-vercel-preview.mjs`, `scripts/deploy-vercel-production.mjs`, `scripts/production-authorization.mjs`.
- P4 preflight/claim/consume, runtime stage/promote/rollback, Owner decision, alias policy, raw Trusted Sources admission, credential-contract/provider/gate and pinned deployment-CLI/tooling installation/gates. Preserve extracted product validation before deleting the old directory.
- The CI production fixture's Vercel CLI install, C1/tooling gate and related admission artifacts. Keep actual Chromium fixtures and browser dependency auditing independently.
- Obsolete deployment controller tests, explicit CI test paths/globs and stale active documentation obligations. Historical task evidence remains historical; deleting code does not authorize deletion/revocation of live settings or credentials used by current main.

## Native configuration and affected tests/specs

`apps/site/scripts/security-policy.mjs:createVercelConfig()` owns generated root `vercel.json`. At the inspected baseline it emits `git.deploymentEnabled.main=false` at line 118. Change that owner and regenerate root config, preserving Astro output, rewrites, CSP/security/cache headers and feature-branch Preview eligibility. `apps/site/scripts/qa-regression-check.mjs:627–630` independently asserts `main === false` and must change with the generator. `scripts/tests/p4-production-workflow.test.mjs` also asserts the retired main-disabled contract. `scripts/release-regression-check.mjs` protects root output/security-header ownership and duplicate site-config removal; retain those checks.

| Test/fixture group | Recommendation |
| --- | --- |
| `apps/site/scripts/tests/{profile-materializer,site-contract-v2,external-site-build,external-build-temp-lifecycle,external-dist-lock,external-dist-recovery,composition-provenance,build-clock,indexing,github-card-determinism,pagefind-index,astro-avif-build}.test.mjs` | KEEP product cases. Preserve immutable inputs, incomplete/mismatched v2 refusal, lock/recovery/temp cleanup, deterministic output and opt-in indexing veto. |
| `scripts/tests/composed-build.test.mjs` | KEEP clean exact-pin/toolchain/reproducibility cases and useful package export integrity. The package test at line 118 calls packager and verifier; separate any main-CI equality premise from selected-Core identity. |
| `scripts/tests/ci-composed-artifact-contract.test.mjs`, `ci-profile-contract.test.mjs` | KEEP exact event/gitlink/manual revision selection, safe subdirectories, separate toolchains, export/provenance and informational audit semantics. Rewrite retired explicit deployment-suite/upload/admission references. |
| `scripts/tests/site-artifact.test.mjs`, `helpers/site-artifact-fixture.mjs` | KEEP real ZIP bounds/traversal/duplicate/symlink/hash/expiry/source-substitution negatives and package/composition integrity. Fixture currently calls packager; preserve that useful export chain. Rename old release-record examples if needed. |
| `scripts/tests/p3-browser-contract.test.mjs`, `p3-browser-oidc.test.mjs` | KEEP route/asset/navigation discovery and request/redirect isolation negatives. Split or rename tests that assume automatic GitHub OIDC acquisition; remove obsolete acquisition cases rather than network safety coverage. |
| `scripts/tests/p3-staging-workflow-contract.test.mjs`, `vercel-preview-deployment.test.mjs` | SPLIT: retain generic archive, exact inventory/hash, parser and browser safety cases wherever their surviving helpers live. Remove publisher/workflow/upload/retry expectations. |
| `scripts/tests/p4-production-validation.test.mjs`, `p4-production-browser-fixture.test.mjs` | SPLIT: keep real-browser canonical/header/routes/assets/404/network and static policy/byte/redirect-shadowing negatives. Retire binding, alias snapshot, release record and stage/live/restore report tests; accommodate opt-in indexing. |
| `scripts/tests/production-authorization.test.mjs`, controller-only `p4-*.test.mjs`, upload/promotion portions of `vercel-production-artifact.test.mjs` | REMOVE with their controllers after shared cases above survive elsewhere. Replace CI's broad obsolete P4 glob with explicit useful suites. |
| `scripts/tests/ocr-review-workflow-contract.test.mjs` and OCR configuration | KEEP independent advisory review behavior. |

Update `.trellis/spec/site/frontend/quality-guidelines.md`: preserve external build/composition/search/security guidance, rewrite the generated main guard and native deployment contract, and retire manual P4/C1/Trusted Sources/release-binding obligations. Preserve product read-only/clean-pin contracts in `.trellis/spec/site-profile/frontend/{hook-guidelines,quality-guidelines}.md`; rewrite deployment-specific wording only. Shared repository quality/audit guidance should remain, without a new approval gate.

`docs/EXTERNAL_SITE_BUILD.md`, `docs/SITE_PROFILE.md` retain their build/export/pin contracts. `docs/SITE_PRODUCTION.md`, `docs/DEPLOYMENT_MATRIX.md`, README/README_CN and security/deployment references need native hosting wording while keeping product trust limitations (trusted Site MDX/snippets are not an untrusted-code sandbox). P7 acceptance should bind the actual native Production project's environment/repository/commit and canonical domain/browser evidence, never generic main CI alone.

## Validation plan for implementation

These are proposed implementation checks, **not runs performed by this research audit**. Use the actual repository toolchain (`Node >=22.12.0`, pnpm `9.14.4`; installed site manifest is Astro `7.3.5`, so stale framework versions in Markdown are not authoritative).

```sh
pnpm install --frozen-lockfile
pnpm site:contract:test
pnpm site:test
pnpm composition:test
pnpm check
KIRARI_BUILD_ONLY=true pnpm build
node apps/site/scripts/generate-vercel-config.mjs --check
pnpm release:check
pnpm release:version-check
pnpm trellis:check
git diff --check
```

Run focused surviving workflow/browser/artifact suites explicitly after imports are rewired. Install the browser-only lockfile and actual Chromium (`npm ci --prefix scripts/p3-browser`, `npx --prefix scripts/p3-browser playwright install --with-deps chromium`) and run `node scripts/p3-browser/build-fixtures.mjs <results-directory>` plus the rewritten Production-like fixture test. A skipped Chromium fixture is not browser verification.

Exercise valid external Site and two composition exports using clean, separate pinned Core/Site checkouts; compare provenance/normalized digest and confirm input source inventories are unchanged. Keep mismatched Core pin, dirty checkout, symlink/traversal, unknown function mode, missing assets/404, noindex/canonical and redirect/credential isolation negatives. Update expected source-CI identity predicates only when they were release-specific; do not weaken selected Core/Site/hash/archive integrity.

Add a small source/workflow regression proving generated main is deployable, feature Preview remains eligible, and no active Actions/custom script publishes, promotes, rolls back or requires C1/Trusted Sources/per-release authorization. Search active code/workflows/specs/docs for old imports/controllers after deletion, excluding historical Trellis evidence from absence assertions. Do not add another native deployment dispatcher.

Actual native Production verification is a later authorized read-only acceptance step: provider deployment must report expected project/environment/repository commit, canonical domain and passing browser health. Local checks/CI cannot establish that outcome. Merge can trigger native Production; this audit does not authorize merge, provider mutation, deployment or credential cleanup.

## Research evidence and limits

Read active task artifacts, repository AGENTS/package/shared/site/site-profile guidance, workflow consumer lists, source imports/exports and connected tests. `get_context.py` reported no developer initialized in this worktree; no identity was created. Package context remained readable. Codegraph reported this worktree unindexed and instructed source-search fallback; no index was initialized. Source was therefore inspected with `rg` and direct reads, consistent with AGENTS evidence priority. No source, provider, credential or GitHub action was changed. No build, browser, live deployment or credential test was run for Step A.
