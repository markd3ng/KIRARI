# Local browser fixture determinism — final validation

PASS on the frozen working-tree delta based on `c6db5da47d1b5d853a38032e1b676fb0cf2c013a`; source SHA-256 bindings are in `fixture-determinism-results.json`.

The reproduced migrated failure was **not** navigation cancellation. `route.fetch` timed out after 10 seconds on allowlisted `https://api.unisvg.com/material-symbols.json` and `/fa6-brands.json`. `full-fixtures-diagnosis/migrated.json` records the bounded origin/path/resource/error evidence, and `full-fixtures-diagnosis.log` retains the failed run. No timeout was ignored or retried into success.

Local fixtures now resolve exact allowlisted Iconify JSON paths and icon-name queries from the application's locked installed icon sets. They reject unknown hosts/prefixes/paths/query fields/methods/missing icons, support installed aliases, and record package versions/content hashes, resolution counts and `externalTransport: NOT_CHECKED`. There is no arbitrary package/path lookup. Live `--base-url` never creates this resolver; it keeps real external fetches and transport failures. The existing empty-icon mock in the local site fixture was replaced with the same validating resolver. Failure reports contain bounded network codes and origin/path, without raw exceptions, queries or headers.

Validation with Node **22.12.0**:

- `REQUIRE_SITE_BROWSER=true node --test scripts/tests/site-browser-fixture.test.mjs scripts/tests/static-site-validation.test.mjs scripts/tests/browser-request-routing.test.mjs scripts/tests/p3-browser-contract.test.mjs`: **22 tests, 22 pass, 0 fail, 0 skip** (26.17 seconds), actual Chromium. Log: `final-focused.log`.
- `KIRARI_BUILD_ONLY=true node scripts/p3-browser/build-fixtures.mjs <full-fixtures-final>`: **minimal, full and migrated all PASS**, routes 1/3/3 and successfully loaded assets 32/39/43. Reports: `full-fixtures-final/{minimal,full,migrated,summary}.json`; runner output: `full-fixtures-final.log`.
- Focused routing cases prove installed icon bodies/alias resolution and provenance, malformed/missing icon refusal and ordinary live transport timeout propagation. Real Chromium positively exercises local icon fetches and rejects missing fixture icons alongside dynamic canonical/navigation/assets/console/external-call negatives.
- Syntax checks and `git diff --check` pass. The observed transport failure remains documented; these results establish local fixture behavior, not public Iconify availability, provider identity or native Production acceptance.

Frozen delta paths: `scripts/p3-browser/fixture-icons.mjs`, `request-routing.mjs`, `validate.mjs`, `site-fixture.mjs`; `scripts/tests/browser-request-routing.test.mjs`, `site-browser-fixture.test.mjs`; `docs/SITE_PRODUCTION.md` (the local versus live external transport sentence only). No provider, credential, GitHub, configuration, deployment, merge or commit actions were performed. Root owns full workspace quality and independent final review.
