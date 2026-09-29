# Design — safe external Site build POC

## Boundaries

- Core checkout remains the source of application code and the default Site profile.
- An external Site tree is a read-only build input. It is never merged into Core and never used as a working directory.
- The external build copies the current `apps/site` package into a fresh temporary workspace, reuses its installed dependency tree by symlink, then invokes the existing package build with an explicit Site-source variable and build-only indexing guard.
- Only a completed `dist` is copied into the standard `apps/site/dist` output, using a sibling candidate and rollback-safe replacement. Failed builds leave the prior output intact.

## Input contract and data flow

One ES module manifest owns source-to-target paths, kind, required/optional status, and validation notes. The materializer and both profile checks consume it; no second mapping table is maintained.

Required: valid `kirari.config.toml`; `content/spec/{about,friends,projects}.md`; `data/friends.json` as an array; `assets/images/` containing the two files used by current Core defaults; `assets/favicon/` containing the Core fallback icons; `assets/og/default.png`.

Optional: `content/posts/` (empty collection when absent); `data/devices.json` (the route already catches absence); `assets/images/devices/` (needed only by device data that references it); additional generic images; `snippets/` (trusted owner code); and root `ads.txt`.

All mapped input trees are scanned with `lstat`; symlinks, special files, type mismatches, malformed TOML/JSON, and missing required inputs fail before destination replacement. Paths use canonical roots plus `relative`-based component containment. Copy first stages every present mapping; install backs up owned destinations and rolls them back if replacement fails. Missing optional mappings remove the staged destination so old data cannot leak forward.

The legacy `profile:check` continues to compare the default materialized profile with its source. A separate `site:profile:check -- --site <path>` validates required external inputs only. Demo-specific QA runs only for the default profile.

## Build-only behavior

`postbuild.mjs` checks the explicit external build mode before calling either indexing submitter or reading service credentials. Ordinary `pnpm build` retains its current gates and behavior. The external builder itself performs no Git operations or platform deployment.

## Rollback

The command builds in a unique temporary directory and deletes only that directory in `finally`. It installs the result only after all build/postbuild steps succeed. The previous `apps/site/dist` is held as a sibling backup until the new output rename succeeds; on install failure, restore the backup. Reverting the PR restores the current default-only path.

## Trust assumptions

Site MDX and snippets can execute during a build and are trusted owner input. PR-1 is a local build POC; future CI must not pass deployment secrets into builds of untrusted Site changes. No Pages Functions upload behavior is claimed.
