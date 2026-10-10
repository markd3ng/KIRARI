# P4 canonical input provenance — Stream B

## Finding

The accepted P3 Site package is cryptographically valid but cannot be used for the candidate Production canonical. The exact `https://example.com` source is the explicit `[site].url` value in `site/kirari.config.toml` at Site SHA `e73979998f668512937ed40ceac3e0a3fed52eaf` (line 3). It is an input value, not an Astro or postbuild fallback. That source commit's `.kirari/core` gitlink and `.kirari/site.toml` both pin Core SHA `c79659046cf6ea73ba69e03c3937d904c07ba93b`.

The existing source run was successful run `37189363285`, attempt `1`, event `workflow_dispatch`, on `main` at Core SHA `c79659046cf6ea73ba69e03c3937d904c07ba93b`. Its Site package is artifact `11297428920`, `kirari-site-package-37189363285-1`, archive digest `sha256:47dcbda5ed9e6ed72a6856af9700fd40b1afeeaa24623871005a515881b0c33c`. The Site package records upstream composition artifact `11297403999` with digest `sha256:20d8a4657eecf2b372bebd5fcfc6e503b995230b865f4a9d40bc69fbd6448208`. Existing provenance verification records composition output digest `sha256:7587a1670ba52cecf67f04b213f33a55a4f42c110817cd10d49018f22b299901` and composition digest `sha256:a56f0d07b34dfcbeaf13bfce4b6621eb4c06458126e09f9443dd74cbcee8fbcb`.

The retained package's route-policy readback found 29 canonical documents rooted at `https://example.com`, one sitemap, and an indexable robots policy. The candidate Production origin is `https://kirari-main.vercel.app`, so the old package fails the canonical target check. These values are recorded in `canonical-route-verification.json` and `shared-source-verification.json`.

## Input-to-package path

1. `.github/workflows/ci.yml` accepts exact Core and Site refs, repository, and Site subdirectory. For manual composition it checks out those refs, validates the Site contract/Core pin, and runs `./build.sh --compose`.
2. `scripts/build-composed-site.mjs` resolves full Core and Site Git identities, calls `scripts/build-external-site.mjs`, then writes `provenance.json` with both SHAs and the generated `dist/` digest.
3. `apps/site/scripts/profile-manifest.mjs` maps the required Site input `kirari.config.toml` into the build. `apps/site/astro.config.mjs` uses `Config.site.url` as Astro's `site` origin; postbuild reads the same configured origin for sitemap and other generated absolute URLs.
4. `scripts/package-vercel-site.mjs` packages the composed output into `.vercel/output`, copies the composition provenance, and writes `site-package-manifest.json` containing the upstream artifact ID/digest/run, Core/Site identities, output digest, and browser contract.
5. `scripts/site-artifact.mjs` verifies the Site archive and upstream composition archive, their GitHub metadata and SHA-256 digests, package/provenance equality, and exact Core/Site identity. The Production preflight uses this verifier before any protected operation.

No output HTML, package bytes, or prior artifact was rewritten.

## Separate Production input candidate

PR [#134](https://github.com/markd3ng/KIRARI/pull/134) adds a separate Site input commit `b1b488ce9491c75718a32cbcf06351d908204358`, based directly on e739. Its only diff is the `[site].url` value in `site/kirari.config.toml`, changed to `https://kirari-main.vercel.app`. Its config Git blob is `6824b153a62b8af7839766740355ee3be968007e`; the file SHA-256 is `sha256:16b92469044483c98fd676951fc96aaf9159bd8cdff2a1b92107fd17f07f59db`. The Site metadata and Core gitlink remain pinned to c796. The PR targets `codex/p3-staging-source-sync` and remains open/unmerged; the prior Site source and P3 package remain unchanged. The main agent reviewed the exact source diff at [PR review](https://github.com/markd3ng/KIRARI/pull/134#pullrequestreview-5409651983); this records the main integration source review, not a human approval.

The main agent reviewed the exact PR head and approved the build-only source run. CI run `37258535783`, attempt `1`, completed successfully through the existing `ci.yml` workflow on `main` with Core ref c796, repository `markd3ng/KIRARI`, Site ref equal to the full PR-head SHA above, and subdirectory `site`. `verify`, `composition`, and `browser-fixtures` all passed.

The new Site package is artifact `11323926470` (`kirari-site-package-37258535783-1`) with archive digest `sha256:21c27932ae527b81afe5cc19ec6b163da6dfd11e455b210f594a211e04ced7cd`. Its upstream composition artifact is `11324140696` (`kirari-composition-37258535783-1`) with archive digest `sha256:29d0f4da56ab01fdf5e6ec3dc6e598df591a9ef201eef7cbb00aad2c9658efab`. The `scripts/site-artifact.mjs` verifier independently re-read both GitHub archive records and bytes; both archive hashes, provenance, and package contents matched. Provenance binds Core c796 and Site b1b488ce9491c75718a32cbcf06351d908204358. The packaged static output contains 315 files totaling 8,919,408 bytes. The Production validation policy found 29 canonical documents at `https://kirari-main.vercel.app`, one sitemap, and an indexable robots policy.

Local real Chromium Production-fixture validation of the extracted package passed: 2 browser-contract routes, all 18 required and 35 observed assets loaded, byte equality passed, and there were zero browser console errors, page errors, failed requests, bad responses, or unexpected external calls. It used a local mocked Production endpoint and did not contact Vercel. The original package target metadata remains the `kirari-test` Preview target as required by the immutable package contract.

The PR triggered automatic Vercel status contexts. They were not used as artifact, browser, Production, or authorization evidence. No Production workflow or Production mutation was performed. Detailed machine-readable results are in `remediation-canonical-artifact.json`.
