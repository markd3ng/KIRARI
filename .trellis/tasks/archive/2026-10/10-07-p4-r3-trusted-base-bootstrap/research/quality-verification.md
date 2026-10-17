# Quality verification — native Git correction

Baseline: main `c6db5da47d1b5d853a38032e1b676fb0cf2c013a`; local checks use repository-pinned Node22.12.0 and pnpm9.14.4. Build-only mode is set and indexing submission opt-in is unset. No Production deployment was run.

The sequential source run in `evidence/native-git-correction-20261015/quality/results.json` passed all18 commands: CI contract/portable/security Node tests (47), Site unit/integration (68), Site contract (7), Edge tests (10), composition (21), profile materialization/check, Trellis, QA regression, Site/Edge types, Astro check, Edge dry-run, generated Vercel parity, Astro production build, release regression/version and diff whitespace. Test counts overlap where CI includes composition; they are not a unique aggregate. This repo has no separate root lint script; existing QA regression is its lint-style check.

Both remaining workflow YAML files parse successfully using the installed js-yaml dependency, with expected CI jobs and advisory OCR. actionlint and shellcheck are not installed; YAML parsing is not represented as actionlint. Existing contract tests verify the changed workflow and unchanged OCR model/provider/advisory settings.

Active workflows/scripts/application/docs/spec were searched for deleted controller paths. Only explicit negative fixtures in native-deployment-architecture.test.mjs remain. Historical Trellis records are retained as history and are not live consumers. Negative tests reject duplicate deploy/promote/rollback commands and allow independent provenance/read-only checks.

Browser tooling npm audit passes at moderate threshold. Workspace pnpm audit reports7 vulnerable dependency instances (4low,2moderate,1high), retained visibly as informational as before. Its lockfile is unchanged, so these versions were not introduced by this correction. Detailed advisory IDs/paths are in the raw audit logs and concise audit-summary.json. #122 remains independent upstream maintenance; no exception or suppression was added.

Full browser run initially failed on Iconify fallback timeouts; bounded failure evidence is retained. Final deterministic local fixtures, their external transport limits, and the independent delta review are recorded separately in the browser extraction and source-review reports. A local fixture pass is not Production, provider identity, or external-service availability evidence. Live Production smoke remains pending Owner cutover.

Final browser follow-up:22 focused tests passed with real Chromium, zero failures/skips. Full minimal/full/migrated build-fixtures passed, respectively1/3/3 routes and32/39/43 loaded assets. See evidence/native-browser-extraction-20261015/result.md and full-fixtures-final reports. The local icon resolver accepts only bounded exact allowlisted requests and installed pinned icon sets; it is not enabled for live --base-url. Live transport is still checked rather than replaced.

After the frozen icon delta, the exact CI Node suite was rerun:50/50 pass, zero skips; final-ci-node-suite.json records command and timing. Independent frozen source review also passed, including independent routing8 and real Chromium4 tests; its SHA-256 table binds candidate source bytes.
