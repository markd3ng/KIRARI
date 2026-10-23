# `origin/dev` vs `origin/main` difference ledger

As checked on 2026-10-23: merge base `5d3739a84c8bb813b89784e86a73032d95bd1696`; `origin/main=60691880f04ae8d36ef49f710edea09a89075514`; `origin/dev=757b1aa9e5acb582ad71ee2f54491f48c6377f34`.

`main` is 104 commits ahead of the merge base; `dev` is 3 commits ahead. The direct tip-tree comparison has 646 changed paths, largely reflecting main's later product and architecture work. The merge-base-to-dev history and three-dot diff isolate the following meaningful dev-only changes and paths.

| Dev-only change | Behavior / files | Current-main evidence | Disposition | Gate |
|---|---|---|---|---|
| `cd57a362f11b0210fc49c379172f20621c2afd70` — PR #159 dependency-audit CI tweak | Adds `continue-on-error: true` to `.github/workflows/ci.yml`, making the dependency audit informational. | Current `main`'s CI records the audit text and JSON, publishes a summary and artifact, and already treats the audit as non-blocking. Exact main Actions run `39763638938` succeeded. | **Superseded.** Keep the richer main workflow; do not replay the one-line change. | PASS |
| `99606ac3d10be4ad1fd2957f10a1d8e14ac2cd35` — PR #157 patch group | 12 site package-range/lockfile updates in `apps/site/package.json` and `pnpm-lock.yaml`. PR verification and Vercel preview checks succeeded. | This dependency batch was made against the older Astro 6 site tree. Current main uses Astro `7.3.5`; the current main lockfile already includes some of these versions (including RSS `4.0.19`, check `0.9.10`, and Sharp `0.35.5`) while other small range differences are not an independent reason to carry the old lockfile graph forward. | **Superseded as a batch.** Do not merge the historical lockfile. Evaluate any future package need against the current main graph in its own update. | PASS |
| `757b1aa9e5acb582ad71ee2f54491f48c6377f34` — PR #158 minor group | 22 site dependency updates plus Cloudflare Workers types/Wrangler updates in `apps/site/package.json`, `workers/kirari-edge/package.json`, and `pnpm-lock.yaml`. PR verification and Vercel preview checks succeeded. | Current main uses Astro `7.3.5` and a later lockfile with security overrides, including KaTeX `0.18.7`, Vite `8.3.5`, and Sharp `0.35.5`. The dev batch requests KaTeX `^0.19.0`, Satori `^0.62.0` and Workers types v5, while main's current package graph and gateway architecture have different versions/boundaries; current main Actions succeeds. | **Superseded as a batch.** Do not import old package manifests, lockfile, or legacy Worker version changes. A future targeted upgrade needs compatibility and security review against current main. | PASS |

## Reconciliation decision

No dev-only commit is a candidate for wholesale merge. The only meaningful three-dot paths are the workflow, site manifest, lockfile, and legacy Worker manifest listed above; all are accounted for by the three commits. Current main has extensive later site, edge gateway, and deployment work. Reconciliation should start from current `main` and carry forward only a newly confirmed fix or a separately justified adoption (ADS), not merge the old `dev` tree.

Open PRs #164 and #165 target `dev` but are not in the audited `dev` tip. They are out of scope for this ledger and should be re-evaluated against current main only if a dependency need remains after the parent task review.
