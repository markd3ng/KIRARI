# Safe external Site build POC

## Goal

Provide a local, reproducible `./build.sh --site <path>` that builds a Site tree outside the Core checkout without changing that source, leaving external content in the shared Core worktree, publishing, or submitting indexing notifications. Keep the current default-profile commands working unchanged.

## Confirmed facts

- Site package commands currently materialize `packages/site-profile` into `apps/site` before Astro reads TOML and content.
- Materialization mappings are duplicated in `scripts/check-profile-materialization.mjs`; existing QA assertions describe the demo profile.
- `friends.json` is statically imported by both friends routes. The about, projects, and friends routes throw when their required spec entry is absent.
- Devices JSON is dynamically imported under a catch and can be omitted. Posts can be an empty content collection.
- The TOML loader and Astro content glob resolve files from the Site package root, so external values must be present before Astro starts.
- `postbuild.mjs` can submit IndexNow and Google indexing requests when configured.
- The only initial workspace change was the user-provided, untracked `kirari-agent-pack-v2/`; preserve and update its documents as requested.

## Requirements

- Accept a local Site directory through `./build.sh --site <path>`; the command does no Git ref fetching, commit, push, deploy, or indexing submission.
- Keep `./build.sh` without arguments and current `pnpm` profile commands on `packages/site-profile`.
- Keep one authoritative mapping/contract for validation, copy, profile checking, and documentation.
- Validate required files, types, JSON/TOML syntax, required spec pages, and path boundaries before replacing generated inputs. Reject symlinks inside mapped inputs and mapped destination paths.
- Materialize into an isolated disposable Site workspace; never write to the input Site. Optional absent mappings must not carry stale/default Site data into the build.
- Support the existing mapping set, generic local images, and optional root `ads.txt`. Treat MDX and snippets as trusted executable source.
- Suppress IndexNow and Google indexing submissions only for external build mode; preserve legacy default-site postbuild behavior.
- Distinguish the legacy default-profile equality check from the external Site contract check; existing demo QA must not run against or overwrite an external Site.
- Update the applicable Trellis specs, owner docs, and the provided handoff-pack documents with verified implementation status.

## Acceptance criteria

- [ ] Default profile `pnpm build` and existing checks still use `packages/site-profile`.
- [ ] A copied default Profile builds externally with equivalent route paths and representative metadata/assets.
- [ ] A separate fixture with a unique title and article emits those values and no stale default-profile article routes.
- [ ] Missing TOML, friends JSON, required spec page, wrong types, invalid destination boundaries, and input symlinks fail before destination changes.
- [ ] Failed/repeated materialization does not report success, modify Site input, or retain omitted files from a prior profile.
- [ ] A Site path containing spaces and non-ASCII characters works.
- [ ] With IndexNow and Google indexing flags enabled in a fixture, external build makes zero indexing endpoint requests and needs no indexing credential.
- [ ] Profile equality validation remains default-specific; external validation checks the external contract without comparing to demo content.
- [ ] Run focused negative tests, site type/Astro checks, default build, and external build; record actual commands/results. Do not claim browser or Cloudflare validation.

## Out of scope

Remote `config` branch checkout, lockfile and dual-SHA provenance, CI wiring, staging/production deployment, Pages Functions packaging, `llms-small.txt` removal, full llmstxt.org v2, Ads/Analytics/Consent changes, and Worker/UI hardening.

## Open decisions

None block this local POC. The Site ref/repository and production/provider choices remain future-task decisions.
