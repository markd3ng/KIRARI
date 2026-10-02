# External Site Composition

## Status and scope

This document records the local and CI external Site build contract. PR-1's
local directory mode remains available; P1 adds a full-SHA composition mode
that produces static output and a provenance manifest for independent Core
and Site inputs.

The default `./build.sh` and `pnpm build` commands continue to build
`packages/site-profile`. The PR-1 `./build.sh --site <directory>` form
continues to publish static files to `apps/site/dist`. P1's
`./build.sh --compose` form verifies the checked-out Core and Site revisions,
builds static output, and writes `dist/` plus `provenance.json` to a new
artifact directory. It does not fetch or switch refs, mutate either input,
deploy, submit indexing notifications, or package Cloudflare Pages Functions.
The existence of a remote `config` branch is not assumed.

## Commands

```bash
./build.sh
./build.sh --site /absolute/path/to/site
./build.sh --compose \
  --core-ref <branch-tag-or-sha> \
  --site /absolute/path/to/site-checkout/packages/site-profile \
  --site-ref <branch-tag-or-sha> \
  --artifact-dir /absolute/path/to/new-artifact
pnpm site:profile:check -- --site /absolute/path/to/site
pnpm site:test
pnpm composition:test
```

Run `pnpm install --frozen-lockfile` in Core before composition. The command
checks that the active pnpm version matches `package.json` and that pnpm's
installed lock state matches `pnpm-lock.yaml`.

The command is the authoritative local/CI composition entry point. The Core
ref and Git-backed Site ref may be a branch, tag, short SHA, or full SHA, but
each must resolve to a full commit SHA matching that checkout's `HEAD`.
Git-backed inputs must have no staged, unstaged, or untracked changes; ignored
files used by the toolchain are outside the Git source identity. Check out the
desired commits before running the command; it does not fetch, switch branches,
merge, or cherry-pick. A Git-backed Site must use a distinct
checkout/worktree from Core. The Site source may be a repository subdirectory;
the manifest records that subdirectory and the full repository commit SHA.
Standalone non-Git Site directories use a SHA-256 content identity and are
never represented as Git SHAs.

The default Site profile is inside the Core repository, so it is not an
independent Site checkout by itself. To compose it by SHA, check out the
selected repository revision into a second directory and pass the
`packages/site-profile` path from that checkout.

The artifact destination must not already exist. The builder stages the
completed static output and provenance together before publishing the
directory. The manifest's SHA-256 covers a normalized tree of sorted relative
paths and file bytes in `dist/`; it excludes `provenance.json` to avoid a
self-referential digest and ignores timestamps and file modes. It normalizes
only the quoted bare `uid` value on actual HTML `<astro-island>` elements,
identified in the HTML namespace; comments, attributes, raw-text/RCDATA,
template contents, and SVG/MathML elements are left byte-significant. In
`pagefind/pagefind-entry.json`, it sorts only the `languages` keys and then
reserializes parsed JSON with `JSON.stringify`, so formatting is ignored and
JavaScript's normal JSON serialization/key-enumeration rules apply. No other
fields are intentionally omitted or sorted. A matching digest is a
semantic-equivalence signal only for the
verified KIRARI Site output whose code does not consume Astro's generated UID.
Trusted Site JavaScript can inspect that attribute, so the digest is not a
general semantic guarantee for arbitrary Site code. It does not establish
byte-for-byte identity or prove equivalence across arbitrary generated output.
The digest does not claim that a GitHub-generated ZIP archive or builds across
different operating systems are bit-for-bit identical. Builds with the same
inputs, toolchain, and selected build environment are checked by comparing
this normalized digest.

The versioned provenance binds Core repository/ref/full SHA, Site
repository/ref/full SHA (or a typed non-Git content digest), Site schema
version, Node/pnpm/toolchain details, build configuration, and static-output
digest. Composition derives `build_clock` from the later selected Git commit
timestamp; a non-Git Site uses the selected Core timestamp. It passes that
value as `SOURCE_DATE_EPOCH` and sets `TZ=UTC` for the child build, so rendered
build dates, age counters, expiry checks, calendar years, and local date
formatting use the same UTC clock on each rebuild. The provenance records the
clock source, epoch, and timezone. Ordinary default and `--site` builds retain
the current runtime clock. The manifest omits run-specific timestamps and
secrets. It stores a SHA-256 fingerprint of the selected child-build
environment, including public overrides and platform/runtime flags, without
copying their values. The artifact contains only static output and this
manifest.

Composition also isolates Astro's content cache inside the temporary Site
workspace, so previously rendered ordinary-build content cannot enter the
artifact. GitHub Card DOM IDs derive from the logical source path and directive
offsets during composition. Pagefind uses the installed Node API to ingest HTML
in sorted relative-path order, keeping search page numbers stable across
filesystems. These generated IDs, executable references, and search assets
remain byte-significant in the artifact digest.

## Input-based rebuild and diagnostics

To rebuild or roll back, check out the recorded Core and Site SHAs into
separate directories, install the recorded toolchain from the lockfile, and
rerun the same `./build.sh --compose` command with the same schema and selected
build environment. For a Git-backed Site path inside a repository,
use that repository's SHA as `--site-ref` and pass the same relative
subdirectory. Do not restore an earlier local `dist` as a substitute for
rebuilding the original input pair.

Errors identify the stage and relevant Core/Site identity where available:
ref resolution, clean-checkout identity validation, Site validation/materialization, static
build, digest/provenance validation, or artifact publication. A missing ref,
non-commit ref, mismatch between a requested ref and checkout `HEAD`, reused
Core/Site checkout, invalid Site input, failed build, or provenance mismatch
fails without publishing a partial artifact.

GitHub Actions exposes the composition job only through manual
`workflow_dispatch` inputs for Core ref, Site repository/ref, and Site source
subdirectory. It checks out the two inputs separately and invokes the same
Core checkout's `build.sh --compose` command. The workflow retains the
downloadable artifact for 30 days and reports its URL and digest. This is an
artifact build, not a deployment or an indexing action.

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
`dist` when present, then removes stale staging directories. The local `--site`
mode installs only static `dist`; generated `functions/` output is outside the
composition artifact contract.

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
child. It filters inherited environment variables to selected build settings
and `PUBLIC_*` values. Provenance fingerprints those selected values without
copying them; `PUBLIC_*` remains public and must never contain secrets.

## Trust boundary

Materialization validates and stages the mapped source paths and does not write
to the original Site Source. It does not enforce read-only filesystem
permissions. This build is not an operating-system sandbox: MDX and other
build-time code can execute with the invoking user's filesystem and network
permissions. Snippets are loaded as raw text and emitted as browser-executable
HTML/JavaScript; they are trusted owner code, but current code does not run
snippet JavaScript in the Node build process. The temporary workspace and
environment filtering do not isolate build code from files the current user
can read or from network access.

The manual composition workflow treats Site changes as executable input: it
uses read-only repository permissions and provides no production credentials.
This does not isolate untrusted changes from the runner's filesystem or
network. Build and artifact publication do not deploy; deployment remains a
separate workflow.

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

`pnpm composition:test` checks ref resolution, clean-checkout enforcement,
provenance, A/A, A/B, and B/A input independence, repeated-build digest
stability, historical input reselection, environment fingerprinting, and the
manual CI workflow contract. The workflow uploads only `dist/` plus
`provenance.json` with 30-day retention. A local test run does not establish a
successful GitHub Actions artifact upload or download; that requires a remote
workflow run. Neither suite establishes browser/visual equivalence,
RSS/search/CSP equivalence, Pages Functions packaging, deployment behavior, or
production configuration.

## Build invariants

- Keep Site and Core revisions distinct and immutable; record both full commit
  SHAs and artifact identity.
- Never merge Site history into Core or silently build from a floating Core
  branch. Require clean Git checkouts so the recorded commit identifies the
  source files being built.
- Never pass deployment credentials to a build that executes Site-controlled
  code.
- Keep build and test side-effect-free with respect to Git, deployment, and
  external indexing. The manual composition workflow may publish a downloadable
  CI artifact, but deployment remains a separate workflow.
- Verify how platform-specific functions are packaged before claiming that a
  static `dist` upload includes them.
