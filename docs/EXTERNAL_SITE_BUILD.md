# External Site Build POC

## Status and scope

This document records the local external Site build contract independently of
the engineering workflow used to implement it. The POC accepts a local,
trusted Site directory and produces static files in `apps/site/dist`.

The default `./build.sh` and `pnpm build` commands continue to build
`packages/site-profile`. `./build.sh --site <directory>` does not fetch Git
refs, mutate Git, deploy, submit indexing notifications, or package Cloudflare
Pages Functions. The existence of a remote `config` branch is not assumed.

## Commands

```bash
./build.sh
./build.sh --site /absolute/path/to/site
pnpm site:profile:check -- --site /absolute/path/to/site
pnpm site:test
```

The external source may contain spaces and non-ASCII path characters. The
contract checker validates the source without writing to it. The external
build copies `apps/site` into a temporary workspace, validates and stages the
mapped inputs, and does not use the original Site Source as a write target. It
runs the package's normal build there and installs only a successful static
`dist` into `apps/site/dist`. A failed build leaves the prior output in place.

## Site input contract

`apps/site/scripts/profile-manifest.mjs` is the current source of truth for
source-to-target mappings and required/optional status.

| Site source | Generated site target | Requirement and validation |
|---|---|---|
| `kirari.config.toml` | `kirari.config.toml` | Required; valid TOML table |
| `content/spec/` | `src/content/spec/` | Required; contains `about.md`, `friends.md`, and `projects.md` |
| `data/friends.json` | `src/_data/friends.json` | Required JSON array; each entry has string `siteTitle`, `siteDesc`, `siteUrl`, and `siteIcon` fields |
| `assets/images/` | `src/assets/images/` | Required; contains `demo-avatar.png` and `demo-banner.png` |
| `assets/favicon/` | `public/favicon/` | Required; contains light and dark 32, 128, 180, and 192 pixel fallback files |
| `assets/og/default.png` | `public/og/default.png` | Required |
| `content/posts/` | `src/content/posts/` | Optional; an absent directory becomes empty |
| `data/devices.json` | `src/_data/devices.json` | Optional JSON object; `brands`, when present, is an array |
| `assets/images/devices/` | `public/images/devices/` | Optional; an absent directory becomes empty |
| `snippets/` | `src/snippets/` | Optional trusted maintainer HTML/JavaScript; an absent directory becomes empty |
| `ads.txt` | `public/ads.txt` | Optional; removed from generated output when absent |

All present mapped inputs must be regular files or directories of the declared
type. Symlinks and special file types inside mapped input trees are rejected.
The canonical source and generated target roots must not overlap. The full
required input contract is checked before any generated target is replaced.

Optional directories are materialized empty when absent, and optional files
are removed when absent. This prevents content from an earlier Site build from
surviving a switch to a Site that omits those inputs.

## Replacement and failure behavior

Materialization stages every mapped output and its ownership manifest before
installing it. Existing owned paths are moved to a temporary backup; a failed
install rolls back already replaced paths. If rollback itself fails, the error
identifies the preserved recovery directory.

The external build uses a disposable copy of `apps/site`. It copies the built
`dist` to a sibling staging directory and replaces `apps/site/dist` only after
the build succeeds. If the replacement fails, it restores the previous `dist`
or reports the preserved recovery path. On the next invocation, startup
recovery restores a backup when `dist` is absent, keeps an already installed
`dist` when present, then removes stale staging directories. Only static `dist`
is installed; generated `functions/` output is outside this POC's contract.

Publication and recovery are serialized by the canonical destination path.
Builds targeting the same `dist` wait for one another; different destinations
can proceed independently. The filesystem ticket records process identity, is
reclaimed only after its owner is verified dead, and has a bounded wait. A
publisher holds its ticket through staging recovery, build-temp cleanup, and
dist installation. Temporary build directories include the full SHA-256 of
the canonical destination, so recovery removes only that destination's stale
workspaces and cannot clean another active target's workspace.

The child build receives `KIRARI_SITE_SOURCE` and
`KIRARI_BUILD_ONLY=true`. IndexNow and Google Indexing API submissions require
`KIRARI_ALLOW_INDEXING_SUBMISSIONS=true`, and are vetoed by either
`KIRARI_BUILD_ONLY=true` or `NODE_ENV=test`. The external builder always sets
build-only mode and does not forward `KIRARI_ALLOW_INDEXING_SUBMISSIONS` to the
child. It filters other inherited environment variables to selected build
settings and `PUBLIC_*` values; `PUBLIC_*` remains public and must never
contain secrets.

## Trust boundary

Materialization validates and stages the mapped source paths and does not write
to the original Site Source. It does not enforce read-only filesystem
permissions. This POC is not an operating-system sandbox: MDX and other
build-time code can execute with the invoking user's filesystem and network
permissions. Snippets are loaded as raw text and emitted as browser-executable
HTML/JavaScript; they are trusted owner code, but current code does not run
snippet JavaScript in the Node build process. The temporary workspace and
environment filtering do not isolate build code from files the current user
can read or from network access.

Future CI must treat Site changes as executable input: provide no production
credentials to the build and isolate untrusted changes before executing them.
Build, verification, provenance, artifact publication, and deployment remain
separate steps.

## Verification contract

`pnpm site:test` exercises the actual `./build.sh --site` entry with equivalent
and distinct external Site fixtures. It compares default/equivalent routes,
page metadata, and selected public asset hashes; verifies custom content
replaces demo posts; checks that build-only and test modes cannot submit to
IndexNow or Google even with both integrations configured and dummy credentials;
and confirms source files remain unchanged. It also checks that ordinary builds
need explicit authorization before either submitter runs.
Materializer tests cover required and malformed inputs, source/destination
symlinks and overlap, failed copies and replacement rollback, optional-file
removal, stale-output cleanup, and paths containing spaces and non-ASCII
characters. The suite also verifies that a failed external build preserves the
previous static output.

These checks do not establish browser/visual equivalence, RSS/search/CSP
equivalence, CI ref semantics, Pages Functions packaging, deployment behavior,
or production configuration. PR-1 records local build behavior only.

## Future integration invariants

- Keep Site and Core revisions distinct and immutable when remote composition
  is introduced; record both full commit SHAs and artifact identity.
- Never merge Site history into Core or silently build from a floating Core
  branch.
- Never pass deployment credentials to a build that executes Site-controlled
  code.
- Keep build and test side-effect-free with respect to Git, deployment, and
  external indexing. Any publication or deployment requires a separate,
  explicit workflow.
- Verify how platform-specific functions are packaged before claiming that a
  static `dist` upload includes them.
