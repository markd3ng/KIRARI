# KIRARI 0.5.0 Release Closeout

## Goal

Fix the currently blocked Iconify requests, replace stale current-state Handoff
material with a concise GitHub Project-aligned handoff, and publish a coherent
`v0.5.0` version on `main`.

## Confirmed Baseline

- GitHub `main` and local `main` are `5d9303c708e3d61acf11920d6c8252cae589b8a9`.
- GitHub Project #1 has 33 roadmap items complete; #122 is the only remaining
  informational backlog item and is nonblocking.
- The repository has exactly one Handoff file, `docs/HANDOFF.md`; it still says
  P7 is in progress and P8 is next, which no longer matches GitHub Project #1.
- `api.iconify.design`, `api.simplesvg.com`, and `api.unisvg.com` are blocked by
  the current `connect-src`. Browser tests classify those blocks as an accepted
  baseline even though icons fail to load.
- The current package versions and changelog are `0.4.1`; the latest Git tag is
  `v0.4.1`. No `v0.5.0` tag exists.
- Pushing a `v*` Git tag triggers the repository's standard CI workflow;
  composition deployment runs only for its configured dispatch/config events.

## Requirements

- Permit only the three HTTPS Iconify API origins used by the existing
  Iconify/Svelte integration, and only in the CSP `connect-src` directive.
- Make browser regression tests fail on CSP-blocked Iconify requests.
- Keep generated deployment CSP output synchronized with the shared policy.
- Rewrite the current Handoff as a current-state guide driven by Project #1 and
  the exact main/tag state. Keep completed audit evidence in Trellis archives;
  do not delete historical evidence.
- Update root and Site package versions, Changelog, and release checks for
  SemVer minor release `0.5.0`.
- Merge the reviewed change through a normal PR, verify main CI and the native
  Production result, then create and verify GitHub tag `v0.5.0` on the verified
  release commit. Create a Git tag only; no GitHub Release is requested.

## Acceptance Criteria

- [ ] Focused CSP tests assert the exact Iconify origins and tests no longer
  whitelist their violations.
- [ ] Generated Vercel policy matches the shared policy and the live site loads
  icons without Iconify CSP violations.
- [ ] `docs/HANDOFF.md` contains no stale P7/P8/PR state and matches Project #1.
- [ ] Package versions, `CHANGELOG.md`, and `pnpm release:check` agree on 0.5.0.
- [ ] Standard CI passes on the exact PR head and on the resulting main commit.
- [ ] Native Production deploy and canonical-domain browser smoke pass for the
  resulting main commit.
- [ ] Remote Git tag `v0.5.0` points to the verified main release commit.
- [ ] No Production settings, credentials, deployment controller, analytics
  credentials, or AdSense credentials are changed; Issue #122 stays open.

## Out of Scope

- Closing or rewriting Issue #122.
- Changing the analytics/ads product policy, real GA4/AdSense IDs, or external
  deployment settings.
- Creating a GitHub Release entry or another release/deployment controller.
