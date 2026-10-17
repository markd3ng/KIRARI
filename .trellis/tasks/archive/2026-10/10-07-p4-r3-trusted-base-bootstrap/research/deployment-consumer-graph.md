# Deployment consumer graph — Step A audit

Scope: current source on `codex/native-git-deployment-correction`, baseline main `c6db5da47d1b5d853a38032e1b676fb0cf2c013a`. Read-only source audit; no provider/auth/GitHub changes. Archived task evidence is history, not a live consumer. Recommendations follow the active PRD/design: native Git owns deployment, Actions owns quality and portable output. This report does not authorize deletion of live credentials/settings consumed on current main.

## Entry-point graph

| Entry | Current edges | Decision |
|---|---|---|
| `.github/workflows/site-production.yml` | `preflight.mjs` claim/prepare/consume → `production-authorization.mjs` + GitHub artifacts/environment; tooling install/gate → C1 contract/provider/Owner comment; `run.mjs` → runtime adapter → deploy production/stage/promote, OIDC browser and rollback | REMOVE workflow and controller edges |
| `.github/workflows/c1-readiness.yml` | protected Production secret/variables → credential-gate → tooling-gate → C1 provider/manifest/Owner comment | REMOVE |
| `.github/workflows/site-staging.yml` | selected CI artifact → `site-artifact.mjs verify` → `deploy-vercel-preview.mjs` raw files/deployment upload; OIDC browser → `create-staging-record.mjs` | REMOVE; Preview comes from native Git, not an upload job |
| `.github/workflows/ci.yml` verify | explicitly executes old production authorization/P4 glob, staging/OIDC/upload contracts | REWRITE explicit suite list |
| CI `production-fixtures` | local real Chromium → production-fixture; additionally installs pinned Vercel CLI and runs C1/tooling gate/audit | KEEP meaningful browser job, REMOVE CLI/C1 install/gate/artifact steps |
| CI `browser-fixtures` | build-fixtures → build-external-site → validate → browser-health → production-browser-helpers → P4 production-validation | KEEP, repair transitive dependency before deleting P4 |
| CI composition | immutable Core/Site selection → `build.sh --compose` → composition-provenance; upload dist/provenance → `package-vercel-site.mjs` → portable Build Output v3 package | KEEP build/provenance/export; REWRITE Preview/deployment labels so package export is not an admission/release controller |
| `package.json` composition:test | composed-build + ci-composed-artifact-contract + apps/site provenance tests | KEEP; workflow contract assertions must change |

No root package script directly invokes the deployment controllers. CI explicit paths/globs and browser imports are the real removal hazards. There are no third-party package `exports` exposing P4; scripts are private repository modules.

## REMOVE inventory

Delete these after reusable checks are extracted and consumer imports rewritten:

- Workflows: `site-production.yml`, `site-staging.yml`, `c1-readiness.yml`.
- Top-level controllers: `scripts/deploy-vercel-production.mjs`, `scripts/deploy-vercel-preview.mjs`, `scripts/production-authorization.mjs`.
- `scripts/p4-production/`: `alias-policy.mjs`, `credential-contract.mjs`, `credential-gate.mjs`, `credential-provider.mjs`, `evidence.mjs`, `npm-runtime.mjs`, `owner-decision.mjs`, `preflight.mjs`, `rollback.mjs`, `run.mjs`, `runtime-adapter.mjs`, `tooling-gate.mjs`, `tooling-identity.mjs`, `tooling-install.mjs`, `trusted-sources.mjs`, `tooling/package.json`, `tooling/package-lock.json`. `production-validation.mjs` is mixed; extract retained functions first, then remove its old location.
- Deployment-only browser modules: `scripts/p3-browser/github-oidc.mjs`, `scripts/p3-browser/create-staging-record.mjs`.
- Deployment-only tests: `production-authorization.test.mjs`, `p4-alias-policy.test.mjs`, `p4-c1-readiness-workflow.test.mjs`, `p4-credential-provider.test.mjs`, `p4-owner-decision.test.mjs`, `p4-production-credential-contract.test.mjs`, `p4-production-preflight.test.mjs`, `p4-production-workflow.test.mjs`, `p4-rollback.test.mjs`, `p4-runtime-adapter.test.mjs`, `p4-runtime.test.mjs`, `p4-tooling-gate.test.mjs`, `p4-trusted-sources.test.mjs`, `p3-staging-workflow-contract.test.mjs`, `vercel-production-artifact.test.mjs`.
- `.gitignore` exception for `scripts/p4-production/tooling/package-lock.json` after tracked lock deletion.

Do not confuse `scripts/p4-production/runtime-adapter.mjs` (release controller) with application hosting adapters/functions under `apps/site` or `workers/kirari-edge`; the latter are KEEP.

## REWRITE inventory and safe extraction boundaries

1. `scripts/p4-production/production-validation.mjs`: retain portable HTML/canonical/robots/static inventory/redirect shadowing/byte integrity checks and safe error class. Retire `assertProductionAuthorizationBinding`, `assertProductionTargetSnapshot`, `assertProductionDeployment` in their old binding/stage/restore form. Put retained utilities under browser/static validation, with no import of `production-authorization`. New native deployment identity checks, if implemented, must bind project/team/environment/repository/commit from native deployment metadata, never generic main CI. `verifyDeployedStaticOutput` currently *requires* OIDC; remove mandatory credential coupling while keeping redirect origin restriction and full output integrity checks where a concrete matching output is available.
2. `scripts/p3-browser/production-browser-helpers.mjs`: redirect import to extracted utility module. This module is imported unconditionally by `browser-health.mjs`; deleting P4 without this change breaks ordinary Preview/local fixture runs.
3. `scripts/p3-browser/validate.mjs`: remove OIDC acquisition and custom `--binding`, `--phase staged|live|restore`, `--prior-release-record` admission. Preserve local `--dist-root` validation and browser counters/network allowlist/navigation/assets/not-found tests. Keep or simplify read-only live URL mode; missing/blocked live access is not Production verification success. Production identity evidence and browser health are separate checks.
4. `scripts/p3-browser/production-fixture.mjs`: remove fabricated Owner approval binding/deployment preflight/old phase semantics and fake OIDC token. Retain real Chromium Production canonical/robots/routes/assets/404/network/byte verification. The generated local test binding must not survive as a native deployment proof.
5. `scripts/p3-browser/request-routing.mjs`: retain external-origin allowlist and redirect/request safety; remove `x-vercel-trusted-oidc-idp-token` coupling and credential plumbing. Existing `p3-browser-oidc.test.mjs` should become ordinary network/redirect leakage tests, not be discarded wholesale.
6. `scripts/tests/p4-production-browser-fixture.test.mjs`: KEEP/rename browser test, update fixture utility imports/report shape. `scripts/tests/p4-production-validation.test.mjs`: split; retain canonical mismatch, noindex/robots policy, byte equality, header/canonical-route errors, redirect-shadowing negatives; remove authorization binding/alias snapshot/release record tests. Indexing remains opt-in: preserve tests for both intentional noindex and opt-in indexability rather than assuming every Production site must be indexed.
7. `scripts/site-artifact.mjs`: KEEP safe immutable package verification/archive utilities. Its `vercelRequest` is deployment API plumbing with only controller callers: REMOVE after controllers gone. `uniqueUploads` is upload-specific; removable. `deploymentFiles` currently supplies verified package inventory, so preserve/rename to output inventory. `compareRemoteFileInventory` becomes dead if only production controller consumes it; remove or retain only with explicit useful test consumer. Artifact download/expiry/SHA/digest checks remain build transport safety, not Production admission. `readSiteArtifactZipMember` has generic archive safety beyond old rollback record naming.
8. `scripts/tests/vercel-preview-deployment.test.mjs`: mixed. Preserve exact output-file hashing, symlink rejection, digest collision protection only if shared inventory/dedup functions remain; preserve `parseHeaders` comment handling under package tests. Drop API status retry/upload-controller tests. Redirect imports to shared module instead of removed preview controller.
9. `scripts/tests/site-artifact.test.mjs` and `helpers/site-artifact-fixture.mjs`: KEEP safe ZIP/path, source substitution/expiry/archive hash, composition byte equality checks. Rename release-record sample members if misleading. Helper calls `package-vercel-site.mjs`, so blanket deletion of that packager breaks multiple retained security tests.
10. `scripts/tests/ci-composed-artifact-contract.test.mjs`: REWRITE expected verify list; currently asserts preview deployment suite exists. Preserve manual/config event bounds, exact immutable revision selection, pinned contract/provenance upload, informational audit status/error retention.
11. `docs/SITE_PRODUCTION.md`, README external Site deployment paragraphs, deployment guide native Git guard assertions: REWRITE architecture and native acceptance; preserve portable external Site composition/export requirements. Remove references to manual Production upload, C1 admission, exact per-release approval, rollback record, mandatory OIDC/Trusted Sources. Historical Trellis evidence may retain those terms with history classification.

## KEEP inventory

- `build.sh`, `scripts/build-composed-site.mjs`, `scripts/build-external-site.mjs`, `scripts/composition-provenance.mjs` and their immutable revision/provenance tests.
- `scripts/package-vercel-site.mjs`, `scripts/verify-site-package.mjs`, `scripts/extract-site-artifact.py`, shared artifact fixture/security tests. Build Output export is portable data; it need not deploy anything. Labels/target descriptors can be simplified separately, preserving header/redirect parsing and archive bounds.
- `scripts/p3-browser/contract.mjs`, `browser-health.mjs`, `build-fixtures.mjs`, browser package manifests/lockfile. These are current CI consumers and require Playwright independently of Vercel CLI.
- Site security-policy generator, generated config/routing/security headers, browser counters, redirect containment, optional gateway adapters, site-contract-v2/profile validation, release version/regression checks, edge dry-deploy/typechecks/tests.
- OCR workflow/advisory contract and dependency audit independent informational reporting.

## Implementation ordering and edge cases

1. Extract browser utilities and simplify local fixture/validator before deleting old P4 location; test module imports alone early.
2. Retire all three Actions workflows and controllers together; do not leave `site-staging` as a second Preview publisher or approval-only dead workflow.
3. Rewire CI explicit tests and remove CLI installation. Replace the broad P4 glob with explicit useful browser/security suites; do not accidentally stop running retained browser coverage.
4. Preserve CI composition exports and their upstream artifact identity fields. Producing Build Output data is compatible with native deployment as long as no automatic/manual upload/promote consumer remains.
5. Update generated `vercel.json` through `apps/site/scripts/security-policy.mjs` + generator, not direct generated-only edits; check root and materialized profile copies for main guard assertions. A config change enabling Git main builds can trigger Production upon merge; PR must remain unmerged until cutover authorization.
6. Validate absence of live old imports/workflow paths while excluding `.trellis/tasks/**/evidence`, archives and journal history. Remove stale active docs/spec obligations; do not rewrite historical evidence as current policy.
7. Live Production credentials/environments remain needed by old main until cutover. Repository source removal does not revoke secrets or grant deletion authority. Record exact consumer-free cleanup point after merge/old-run cancellation verification.
8. Native Production acceptance requires actual provider Production deployment with expected repository commit/project/domain plus browser verification. Main CI or local Chromium fixtures alone cannot complete P4/P7.
