# Independent advisory OCR triage — PR #143

OCR run 38668940211/1 SUCCESS reported 30 suggestions: 8 medium inline + 22 low summary. Read every inline and the complete summary via fresh read-only GitHub API. Source reviewed at local head `12cb0c23d67a2639b63673fd18e589c050eb45c1` (initial PR implementation 12cb0c2). Advisory success is not a Production or merge approval.

Result: no confirmed runtime/security defect. Two small regression-test coverage gaps merit correction before final head review: medium7 retained CI suites, medium8 implicit/flag-order curl writes. Other items are false premises, intentional documented limits, diagnostics tradeoffs or optional style/maintenance. No source edits, GitHub comments/settings or provider actions performed by reviewer.

## Medium inline comments (all eight)

| # | Comment / source | Disposition | Independent evidence |
|---|---|---|---|
| M1 | [4278283123](https://github.com/markd3ng/KIRARI/pull/143#discussion_r4278283123); `scripts/p3-browser/page-policy.mjs:10` | FALSE_POSITIVE | Actual Chromium reproduction: locator.getAttribute rejects multiple links with Playwright strict mode violation. It never silently reads first. No runtime fix required. |
| M2 | [4278283143](https://github.com/markd3ng/KIRARI/pull/143#discussion_r4278283143); `scripts/p3-browser/validate.mjs:184` | INTENTIONAL_SAFE_DIAGNOSTICS | FAIL retains sanitized errorCode and bounded network origin/path/type/classification. Raw page/console/error text can contain secrets or arbitrary data. Less diagnosis detail is a tradeoff, not false PASS. Do not add raw error.message. |
| M3 | [4278283151](https://github.com/markd3ng/KIRARI/pull/143#discussion_r4278283151); `scripts/site-artifact.mjs:53` | NO_ACTIVE_SECURITY_DEFECT | Branch is used for exact metadata string equality, not filesystem/path/command input or protected-branch admission. Provider cannot produce invalid Git ref ../x; mismatch fails. Tightening syntax optional, retired protected-only premise incorrect. |
| M4 | [4278283159](https://github.com/markd3ng/KIRARI/pull/143#discussion_r4278283159); `scripts/static-site-validation.mjs:114` | INTENTIONAL_SUPPORTED_REDIRECT | Root refresh/no-canonical is a supported Astro redirect document, not an indexable terminal page. Terminal localized documents and browser canonical/robots/allowed origins remain checked. Blanket noindex rejection would reject valid redirect output. |
| M5 | [4278283165](https://github.com/markd3ng/KIRARI/pull/143#discussion_r4278283165); `scripts/static-site-validation.mjs:157` | FALSE_PRECONDITION | Utility supports ordinary apps/site/dist as well as Build Output static. Ordinary Astro dist has no sibling Build Output config.json. Missing config is valid; malformed present config fails. Requiring it breaks the documented CLI. |
| M6 | [4278283176](https://github.com/markd3ng/KIRARI/pull/143#discussion_r4278283176); `scripts/static-site-validation.mjs:270` | INTENTIONAL_BYTE_ONLY_CONTRACT | compareStaticOutput checks observed response body identity, not remote route configuration or provider identity. Equal bodies after same-origin redirect satisfy that claim. Live browser routes and provider identity are separate; no hidden routing attestation claimed. |
| M7 | [4278283184](https://github.com/markd3ng/KIRARI/pull/143#discussion_r4278283184); `scripts/tests/ci-composed-artifact-contract.test.mjs:47` | CORRECTED_TEST_COVERAGE_GAP | CI currently runs all three suites, but contract assertion omits site-artifact/static-site-validation/native-deployment-architecture. Add their names to retained-suite assertion; no current missing execution. |
| M8 | [4278283187](https://github.com/markd3ng/KIRARI/pull/143#discussion_r4278283187); `scripts/tests/native-deployment-architecture.test.mjs:14` | CORRECTED_TEST_GUARD_GAP | Independently reproduced acceptance of curl URL -d data and URL -X POST. Strengthen write-shape checks in either flag order with negative samples; retain legitimate read-only/build cases. No live duplicate publisher exists today. |

## Low summary items (all 22, original order)

Summary comment: https://github.com/markd3ng/KIRARI/pull/143#issuecomment-6182766126

| # | Source | Disposition | Reason |
|---|---|---|---|
| L1 | `scripts/p3-browser/site-fixture.mjs:97` | OPTIONAL_REUSE | Shared resolver is already reused; short fulfill/abort branches differ in fixture counters vs general request callbacks. No observed divergence. No new helper required for this correction. |
| L2 | `scripts/tests/static-site-validation.test.mjs:168` | STYLE_ONLY | Indentation in test callback affects readability only; no behavioral defect. |
| L3 | `scripts/static-site-validation.mjs:223` | FALSE_POSITIVE | Loop follows at most five redirects, which requires up to six fetches including the initial request. Limit names redirects, not total requests; fail-closed bound is correct. |
| L4 | `scripts/p3-browser/page-policy.mjs:4` | NO_ACTIVE_CALLER | All callers pass Playwright response.headers() or tested header objects. Undefined is not produced; TypeError would fail validation rather than accept. Optional input API hardening. |
| L5 | `scripts/p3-browser/fixture-icons.mjs:25` | DIAGNOSTIC_ONLY | Routing supplies an already parsed valid request URL. Missing installed package is setup failure, not an invalid icon request. Both classifications fail; no placeholder or false success. |
| L6 | `scripts/p3-browser/validate.mjs:136` | INTENTIONAL_SAFE_DIAGNOSTICS | Same raw-message disclosure tradeoff as medium2. Counts and sanitized code/network evidence preserve failure; raw console samples are not required. |
| L7 | `scripts/tests/helpers/site-artifact-fixture.mjs:74` | OPTIONAL_COMMENT | Workflow head SHA and selected Core SHA are intentionally distinct and covered by explicit config-export regression. Comment suggestion only. |
| L8 | `scripts/tests/site-artifact.test.mjs:144` | STYLE_ONLY | Extra blank lines have no semantic effect. |
| L9 | `scripts/tests/site-artifact.test.mjs:163` | FALSE_POSITIVE | assert.throws matches specific deployment-destination/output-digest messages. Missing fixture HTML would not match them. Positive archive/package cases also pass independently. |
| L10 | `scripts/tests/native-deployment-architecture.test.mjs:44` | STYLE_ONLY | Blank-line style only. |
| L11 | `.github/workflows/ci.yml:179` | FUTURE_MAINTENANCE | Pinned Node22.12.0/.nvmrc and ubuntu24.04 x64 currently agree; CI passes. A later toolchain upgrade must update this path, no present failure. |
| L12 | `scripts/tests/composed-build.test.mjs:134` | OPTIONAL_RENAME | mismatchedSourceRun variable names an old concept but actual command/expected error tests selected Core mismatch correctly. |
| L13 | `scripts/p3-browser/request-routing.mjs:75` | DIAGNOSTIC_ONLY | Excess redirects fail closed; generic ROUTE_FETCH_FAILED remains honest. More specific error code is optional, not missing failure handling. |
| L14 | `scripts/static-site-validation.mjs:211` | OPTIONAL_REUSE | Duplicated tiny route mapping is currently equal. Refactoring is not necessary to fix behavior; existing byte/canonical cases cover mapping. |
| L15 | `scripts/tests/site-package-output.test.mjs:35` | PARTLY_ALREADY_COVERED | Destination injection is covered in site-artifact.test. Missing index inventory negative could be added, but implementation rejects missing index and no changed broken caller identified. |
| L16 | `scripts/tests/helpers/site-artifact-fixture.mjs:40` | FALSE_FUTURE_PREMISE | Fixture schema explicitly accepts refs/heads only. Slicing validated fixed prefix is intentional; future tag-schema support is outside current contract. |
| L17 | `.trellis/tasks/10-07-p4-r3-trusted-base-bootstrap/evidence/native-browser-extraction-20261015/fixture-determinism-results.json:2` | EVIDENCE_STYLE_ONLY | snake/camel case differs across independent report formats. No shared parser contract or wrong value shown. |
| L18 | `.trellis/tasks/10-07-p4-r3-trusted-base-bootstrap/evidence/native-browser-extraction-20261015/full-fixtures-final/summary.json:6` | EVIDENCE_PORTABILITY_ONLY | Local absolute report path is corroborated by retained relative folder/files and hashes. Not a credential or runtime requirement. Optional normalization, not acceptance blocker. |
| L19 | `.trellis/tasks/10-07-p4-r3-trusted-base-bootstrap/evidence/native-browser-extraction-20261015/fixture-determinism-results.json:23` | EVIDENCE_STYLE_ONLY | required_chromium versus chromium_required are report-format names; no consumer failure demonstrated. |
| L20 | `scripts/static-site-validation.mjs:89` | FALSE_POSITIVE | Independently reproduced /posts/welcome// versus /posts/welcome/ returns false: removing one trailing slash on both does not equalize double slash. Optional single trailing slash equivalence is intended. |
| L21 | `scripts/tests/static-site-validation.test.mjs:114` | STYLE_ONLY | Blank-line style only. |
| L22 | `scripts/site-artifact.mjs:199` | OPTIONAL_SIMPLIFY | expectedSourceSha alias can be removed but does not change Core binding or transport distinction. |

## Independent reproductions

1. Launched locked Playwright Chromium, set two canonical links, called actual assertCanonicalLink: duplicateCanonicalRejected=true; strictModeViolation=true. Confirms M1 false premise.
2. Called actual architecture guard function extracted in memory: curl endpoint -d and endpoint -X POST were accepted. Confirms M8 coverage hole, not an existing publisher.
3. Called actual canonicalMatchesRoute for /posts/welcome// against /posts/welcome/: false. Confirms L20 example is rejected.
4. Reviewed actual source/import/CLI/doc contracts for M2–M7 and all summary findings. No use of historical evidence as provider/Production proof.

## Follow-up gate

Root may apply the two narrow test corrections. Their exact final hashes/tests and eventual CI must be re-reviewed before this report is cited as final-head acceptance. No runtime expansion, raw error logging or mandatory Build Output config should be introduced to satisfy false premises. Production cutover remains unauthorized and P4 incomplete.

Captured 2026-10-15T02:25:56.250992+00:00.

## Final test-only correction validation

Root fixed only M7/M8 in ci-composed-artifact-contract.test.mjs and native-deployment-architecture.test.mjs. Independently reviewed the final two-file diff and ran both suites: 8/8 PASS, zero skips. Retained-suite assertion now includes all ten current suites; REST write shapes include implicit body/form/attached short flags and URL/flag order. Positive GET/log inspection, build and independent provenance cases remain valid. No runtime edits were needed for any OCR suggestion. Final reviewed test SHA256 values are recorded in independent-source-review.md; final commit/CI binding is root follow-up. All30 findings are dispositioned, with zero outstanding confirmed runtime defects.
