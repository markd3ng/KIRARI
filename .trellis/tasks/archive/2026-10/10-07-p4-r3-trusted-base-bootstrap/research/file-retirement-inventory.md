# File retirement and retained requirement inventory

Candidate source against main `c6db5da47d1b5d853a38032e1b676fb0cf2c013a`; engineering changes only, no merge/provider/credential authority. This is a source consumer inventory, not another roadmap. Issue mappings below resolve to actual Project #1 item IDs in the complete `evidence/native-git-correction-20261015/project-before.json` audit. Revised acceptance lives in those existing issues; old titles in the snapshot are historical.

## Roadmap identity key

| Issue | Actual Project item ID | Replacement requirement |
|---|---|---|
| #95 | `PVTI_lAHODRFUbM4BlFsVzg9nIVQ` | Immutable Core/Site pins and reproducible provenance KEEP |
| #96 | `PVTI_lAHODRFUbM4BlFsVzg9nIXM` | Read-only config composition and transport artifact identity KEEP |
| #98 | `PVTI_lAHODRFUbM4BlFsVzg9nIbE` | Portable package/export and native Preview; retire custom staging upload |
| #99 | `PVTI_lAHODRFUbM4BlFsVzg9nIdI` | Actual native Production commit/project/domain/browser acceptance; incomplete |
| #100 | `PVTI_lAHODRFUbM4BlFsVzg9nIe4` | DEFER indexing feature; actual Production signal required, default off |
| #102 | `PVTI_lAHODRFUbM4BlFsVzg9nIiw` | KEEP optional Gateway application capability, outside Site controller |
| #111 | `PVTI_lAHODRFUbM4BlFsVzg-HLlA` | KEEP Vercel Gateway adapter work independently |
| #129 | `PVTI_lAHODRFUbM4BlFsVzg-bx-s` | Native Git configuration/cutover readiness replaces release admission |
| #130 | `PVTI_lAHODRFUbM4BlFsVzg-byCk` | Portable provenance/export and native source build; no exact CI upload claim |
| #131 | `PVTI_lAHODRFUbM4BlFsVzg-byGs` | Read-only browser/security checks and honest deployment-evidence distinction |
| #132 | `PVTI_lAHODRFUbM4BlFsVzg-byJo` | Provider-native recovery requirements, no custom release-record rollback |

## Changed runtime, workflow, configuration, tests and active documentation

Each issue reference resolves to its concrete item above. REMOVE rows preserve the old requirement only where it has an independent purpose; custom admission itself has been retired by Owner decision. New utilities are classified REWRITE because they replace mixed old controller modules rather than introduce a new deployment subsystem.

| Path | Class | Original → replacement requirement | Issue / item key |
|---|---|---|---|
| `.github/workflows/c1-readiness.yml` | REMOVE | C1/Owner binding admission → ordinary review/access control and native cutover | #129 |
| `.github/workflows/ci.yml` | SIMPLIFY | Quality plus CLI/C1/release fixtures → source/portable/browser quality; KEEP composition/OCR/audit | #96, #98, #99, #131 |
| `.github/workflows/site-production.yml` | REMOVE | Custom Production controller → provider-native Git deployment | #99, #130 |
| `.github/workflows/site-staging.yml` | REMOVE | Custom Preview upload/receipt → native feature-branch Git Preview | #98 |
| `.gitignore` | SIMPLIFY | Removed locked CLI exception → no deployment-tooling lock consumer | #129 |
| `.trellis/spec/guides/repository-workflow.md` | REWRITE | Custom immutable release/admission instructions → native Git, portable build limits, truthful acceptance/recovery | #99, #129–132 |
| `.trellis/spec/site/frontend/quality-guidelines.md` | REWRITE | Custom immutable release/admission instructions → native Git, portable build limits, truthful acceptance/recovery | #99, #129–132 |
| `AGENTS.md` | REWRITE | Custom immutable release/admission instructions → native Git, portable build limits, truthful acceptance/recovery | #99, #129–132 |
| `CONTRIBUTING.md` | REWRITE | Custom immutable release/admission instructions → native Git, portable build limits, truthful acceptance/recovery | #99, #129–132 |
| `DEPLOY.md` | REWRITE | Custom immutable release/admission instructions → native Git, portable build limits, truthful acceptance/recovery | #99, #129–132 |
| `README.md` | REWRITE | Custom immutable release/admission instructions → native Git, portable build limits, truthful acceptance/recovery | #99, #129–132 |
| `README_CN.md` | REWRITE | Custom immutable release/admission instructions → native Git, portable build limits, truthful acceptance/recovery | #99, #129–132 |
| `SECURITY_MODEL.md` | REWRITE | Custom immutable release/admission instructions → native Git, portable build limits, truthful acceptance/recovery | #99, #129–132 |
| `apps/site/scripts/qa-regression-check.mjs` | REWRITE | main-disable guard → native main/feature eligibility; KEEP routing/security headers | #99, #129 |
| `apps/site/scripts/security-policy.mjs` | REWRITE | main-disable guard → native main/feature eligibility; KEEP routing/security headers | #99, #129 |
| `docs/EXTERNAL_SITE_BUILD.md` | REWRITE | Custom immutable release/admission instructions → native Git, portable build limits, truthful acceptance/recovery | #99, #129–132 |
| `docs/SITE_PRODUCTION.md` | REWRITE | Custom immutable release/admission instructions → native Git, portable build limits, truthful acceptance/recovery | #99, #129–132 |
| `docs/VERCEL.md` | REWRITE | Custom immutable release/admission instructions → native Git, portable build limits, truthful acceptance/recovery | #99, #129–132 |
| `scripts/deploy-vercel-preview.mjs` | REMOVE | Custom Preview upload/receipt → native feature-branch Git Preview | #98 |
| `scripts/deploy-vercel-production.mjs` | REMOVE | Custom Production controller → provider-native Git deployment | #99, #130 |
| `scripts/p3-browser/browser-health.mjs` | REWRITE | P4/OIDC-bound checks → reusable browser/static/network checks; local byte proof ≠ deployment proof | #131 |
| `scripts/p3-browser/create-staging-record.mjs` | REMOVE | Custom Preview upload/receipt → native feature-branch Git Preview | #98 |
| `scripts/p3-browser/github-oidc.mjs` | REMOVE | Mandatory GitHub OIDC browser credential → credential-free public read-only check | #131 |
| `scripts/p3-browser/fixture-icons.mjs` | REWRITE | Public icon API dependency in local fixtures → exact installed locked icon data with fingerprints; live transport unchanged | #131 |
| `scripts/p3-browser/page-policy.mjs` | REWRITE | P4/OIDC-bound checks → reusable browser/static/network checks; local byte proof ≠ deployment proof | #131 |
| `scripts/p3-browser/production-browser-helpers.mjs` | REMOVE | Old P4-bound browser module → page-policy/site-fixture/static-site-validation | #131 |
| `scripts/p3-browser/production-fixture.mjs` | REMOVE | Old P4-bound browser module → page-policy/site-fixture/static-site-validation | #131 |
| `scripts/p3-browser/request-routing.mjs` | REWRITE | P4/OIDC-bound checks → reusable browser/static/network checks; local byte proof ≠ deployment proof | #131 |
| `scripts/p3-browser/site-fixture.mjs` | REWRITE | P4/OIDC-bound checks → reusable browser/static/network checks; local byte proof ≠ deployment proof | #131 |
| `scripts/p3-browser/validate.mjs` | REWRITE | P4/OIDC-bound checks → reusable browser/static/network checks; local byte proof ≠ deployment proof | #131 |
| `scripts/package-vercel-site.mjs` | SIMPLIFY | Destination-bound schema1/upload inventory → destination-free schema2 export; KEEP archive/digest/source safety | #95, #96, #98, #130 |
| `scripts/production-authorization.mjs` | REMOVE | C1/Owner binding admission → ordinary review/access control and native cutover | #129 |
| `scripts/site-artifact.mjs` | SIMPLIFY | Destination-bound schema1/upload inventory → destination-free schema2 export; KEEP archive/digest/source safety | #95, #96, #98, #130 |
| `scripts/static-site-validation.mjs` | REWRITE | P4/OIDC-bound checks → reusable browser/static/network checks; local byte proof ≠ deployment proof | #131 |
| `scripts/tests/browser-request-routing.test.mjs` | REWRITE | P4/OIDC-bound checks → reusable browser/static/network checks; local byte proof ≠ deployment proof | #131 |
| `scripts/tests/ci-composed-artifact-contract.test.mjs` | REWRITE | Old package/controller assumptions → portable output/provenance/archive tests; distinguish workflow SHA from Core SHA | #95, #96, #98, #130 |
| `scripts/tests/composed-build.test.mjs` | REWRITE | Old package/controller assumptions → portable output/provenance/archive tests; distinguish workflow SHA from Core SHA | #95, #96, #98, #130 |
| `scripts/tests/helpers/site-artifact-fixture.mjs` | REWRITE | Old package/controller assumptions → portable output/provenance/archive tests; distinguish workflow SHA from Core SHA | #95, #96, #98, #130 |
| `scripts/tests/native-deployment-architecture.test.mjs` | REWRITE | Controller contracts → duplicate-publisher negatives; allow independent build/provenance/read-only capabilities | #99, #129 |
| `scripts/tests/p3-browser-oidc.test.mjs` | REMOVE | Controller/admission/upload test → retained browser/archive/network tests listed below | #99, #129–132 |
| `scripts/tests/p3-staging-workflow-contract.test.mjs` | REMOVE | Controller/admission/upload test → retained browser/archive/network tests listed below | #99, #129–132 |
| `scripts/tests/p4-alias-policy.test.mjs` | REMOVE | Controller/admission/upload test → retained browser/archive/network tests listed below | #99, #129–132 |
| `scripts/tests/p4-c1-readiness-workflow.test.mjs` | REMOVE | Controller/admission/upload test → retained browser/archive/network tests listed below | #99, #129–132 |
| `scripts/tests/p4-credential-provider.test.mjs` | REMOVE | Controller/admission/upload test → retained browser/archive/network tests listed below | #99, #129–132 |
| `scripts/tests/p4-owner-decision.test.mjs` | REMOVE | Controller/admission/upload test → retained browser/archive/network tests listed below | #99, #129–132 |
| `scripts/tests/p4-production-browser-fixture.test.mjs` | REMOVE | Controller/admission/upload test → retained browser/archive/network tests listed below | #99, #129–132 |
| `scripts/tests/p4-production-credential-contract.test.mjs` | REMOVE | Controller/admission/upload test → retained browser/archive/network tests listed below | #99, #129–132 |
| `scripts/tests/p4-production-preflight.test.mjs` | REMOVE | Controller/admission/upload test → retained browser/archive/network tests listed below | #99, #129–132 |
| `scripts/tests/p4-production-validation.test.mjs` | REMOVE | Controller/admission/upload test → retained browser/archive/network tests listed below | #99, #129–132 |
| `scripts/tests/p4-production-workflow.test.mjs` | REMOVE | Controller/admission/upload test → retained browser/archive/network tests listed below | #99, #129–132 |
| `scripts/tests/p4-rollback.test.mjs` | REMOVE | Controller/admission/upload test → retained browser/archive/network tests listed below | #99, #129–132 |
| `scripts/tests/p4-runtime-adapter.test.mjs` | REMOVE | Controller/admission/upload test → retained browser/archive/network tests listed below | #99, #129–132 |
| `scripts/tests/p4-runtime.test.mjs` | REMOVE | Controller/admission/upload test → retained browser/archive/network tests listed below | #99, #129–132 |
| `scripts/tests/p4-tooling-gate.test.mjs` | REMOVE | Controller/admission/upload test → retained browser/archive/network tests listed below | #99, #129–132 |
| `scripts/tests/p4-trusted-sources.test.mjs` | REMOVE | Controller/admission/upload test → retained browser/archive/network tests listed below | #99, #129–132 |
| `scripts/tests/production-authorization.test.mjs` | REMOVE | Controller/admission/upload test → retained browser/archive/network tests listed below | #99, #129–132 |
| `scripts/tests/site-artifact.test.mjs` | REWRITE | Old package/controller assumptions → portable output/provenance/archive tests; distinguish workflow SHA from Core SHA | #95, #96, #98, #130 |
| `scripts/tests/site-browser-fixture.test.mjs` | REWRITE | P4/OIDC-bound checks → reusable browser/static/network checks; local byte proof ≠ deployment proof | #131 |
| `scripts/tests/site-package-output.test.mjs` | REWRITE | Old package/controller assumptions → portable output/provenance/archive tests; distinguish workflow SHA from Core SHA | #95, #96, #98, #130 |
| `scripts/tests/static-site-validation.test.mjs` | REWRITE | P4/OIDC-bound checks → reusable browser/static/network checks; local byte proof ≠ deployment proof | #131 |
| `scripts/tests/vercel-preview-deployment.test.mjs` | REMOVE | Controller/admission/upload test → retained browser/archive/network tests listed below | #99, #129–132 |
| `scripts/tests/vercel-production-artifact.test.mjs` | REMOVE | Controller/admission/upload test → retained browser/archive/network tests listed below | #99, #129–132 |
| `scripts/verify-site-package.mjs` | SIMPLIFY | Destination-bound schema1/upload inventory → destination-free schema2 export; KEEP archive/digest/source safety | #95, #96, #98, #130 |
| `vercel.json` | REWRITE | main-disable guard → native main/feature eligibility; KEEP routing/security headers | #99, #129 |

### Removed P4 controller tree (all changed paths)

REMOVE — #99/#129–132. Old C1/tooling/Owner receipt, raw trust policy, stage/promote/alias and custom rollback requirements are retired. Portable static/browser functions were extracted before deleting their old module. Exact paths:

- `scripts/p4-production/alias-policy.mjs`
- `scripts/p4-production/credential-contract.mjs`
- `scripts/p4-production/credential-gate.mjs`
- `scripts/p4-production/credential-provider.mjs`
- `scripts/p4-production/evidence.mjs`
- `scripts/p4-production/npm-runtime.mjs`
- `scripts/p4-production/owner-decision.mjs`
- `scripts/p4-production/preflight.mjs`
- `scripts/p4-production/production-validation.mjs`
- `scripts/p4-production/rollback.mjs`
- `scripts/p4-production/run.mjs`
- `scripts/p4-production/runtime-adapter.mjs`
- `scripts/p4-production/tooling-gate.mjs`
- `scripts/p4-production/tooling-identity.mjs`
- `scripts/p4-production/tooling-install.mjs`
- `scripts/p4-production/tooling/package-lock.json`
- `scripts/p4-production/tooling/package.json`
- `scripts/p4-production/trusted-sources.mjs`

## KEEP unchanged consumer capabilities

- `build.sh`, composition builders/provenance, `scripts/extract-site-artifact.py`: immutable inputs, normalized output and safe archives (#95/#96/#98/#130).
- Browser contract/build-fixtures and locked Playwright package: real page/navigation/assets/network checks (#98/#131); new modules repair the old unconditional P4 import chain.
- `.github/workflows/ocr-review.yml`: advisory review, not a Production success prerequisite (#99).
- Application security, source types/build/QA, release checks and optional Gateway runtime adapters (#102/#111): independent capabilities, not retired deployment controllers.

## DEFER operational and feature work

DEFER — #129/#99: Production token/PAT revocation, protected Environment/secret/variable removal, provider Trusted Sources cleanup and any existing project/settings removal. Current main and old queued/running workflows can still consume them until authorized cutover; verify merged consumer removal and stale-run state before separately authorized cleanup. This inventory does not mutate or authorize any resource.

DEFER — #99/#131: actual native Production deployment, commit/project/environment/domain association and live browser acceptance. Candidate source/config and local fixtures cannot mark P4 Done. Merge may itself trigger Production and is not authorized here.

DEFER — #132: actual native recovery execution. Document eligible existing Production versions, domain-assignment behavior and first-release limitation; do not claim simulated/custom rollback proves live recovery.

DEFER — #100: indexing notification implementation. Keep default-off/explicit opt-in; source CI/build success is not an actual Production signal. Gateway and P5–P8 feature delivery remain their own roadmap work, not prerequisites invented for this correction.

## Active references and retained history

Active workflow/scripts/docs/spec consumers were scanned for retired controller paths. Only explicit architecture-negative test strings remain. Old Trellis evidence and PR history remain immutable history; old task10-04 planning and current retirement.md are explicitly superseded, with P4 still incomplete. They are not executable consumers or fresh evidence. Do not remove historical credentials facts by rewriting them into current readback.

## Byte identity boundary

Portable schema2 package verification still binds the selected Core/Site, normalized output digest, exact upstream archive identity and safe extraction. GitHub transport workflow SHA is distinct from selected Core SHA. Vercel native Git rebuilds source and is not asserted to deploy earlier CI bytes. Ordinary browser CLI reports byteEquality=NOT_CHECKED/providerDeploymentIdentityVerified=false; local fixture comparison proves only its local routed bytes. Actual provider commit/domain identity must be checked separately after cutover.

Local-fixture reliability delta: icon response resolution accepts only the existing allowed API hosts, known installed icon sets, a single icons query, valid bounded icon names and GET. Missing/invalid icons fail; no live network fallback is hidden. Local reports explicitly mark externalTransport=NOT_CHECKED; live --base-url keeps actual transport and failure checks. This is test determinism, not provider availability evidence.
