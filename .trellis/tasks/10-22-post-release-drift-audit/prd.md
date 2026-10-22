# KIRARI v0.5.0 post-release drift audit

## Goal

Verify that the accepted P0–P8 roadmap, its GitHub Issues and Project #1, the
release tag, current Production, source, tests, and current documentation agree.
Fix confirmed low-risk documentation drift and publish one audit PR without
merging it.

## Requirements

- Use the live GitHub Project, Issues, PRs, CI, current `main`, `v0.5.0`, and
  Vercel Production records as the current baseline; retain the historical
  release SHA and explain the post-release `main` delta.
- Trace all 33 roadmap items from Project item through Issue acceptance,
  merged PR/main evidence, implementation, and tests/evidence. Audit #122
  separately as an open, non-blocking dependency-maintenance item.
- Classify each finding using the requested drift taxonomy and distinguish
  implemented, verified, accepted, deployed, superseded, not applicable, and
  not verified. Never treat an absent record as proof of success.
- Recheck D-01 through D-05, the active deployment architecture, Gateway,
  content/SEO, Analytics/Ads, docs, and archived Trellis acceptance evidence.
- Repair confirmed documentation drift and add only a lightweight regression
  check that prevents the README stack/island inventory from going stale.
- Refresh the stale current checkpoint in Project #1's README while preserving
  item identities, statuses, fields, dependencies, and historical checkpoints.
- Create `docs/audits/KIRARI-v0.5.0-drift-audit.md` with the full trace matrix,
  evidence gaps, deviations, fixes, and a calibrated verdict.
- Submit one PR against `main`; do not merge, retag, create a release, change
  deployment configuration/credentials, or perform a Production operation.

## Acceptance Criteria

- [ ] The audit records the exact current main SHA, annotated `v0.5.0` target,
  current exact-SHA Production deployment, canonical alias, and main CI result.
- [ ] All 33 roadmap items and the #122 follow-up have evidence-backed status;
  all current Project fields/dependencies are checked and any unavailable
  evidence is explicitly `NOT_VERIFIED`.
- [ ] D-01 to D-05 and all requested P0–P8 architecture areas are classified;
  historical superseded deployment controls are not reintroduced as gates.
- [ ] README and Chinese README list current declared package versions and the
  complete Astro client-island inventory, including routes and hydration mode.
- [ ] The documentation consistency regression test passes with the normal
  Site test command.
- [ ] Focused local checks, build, and the PR's actual standard CI pass at the
  same final head; no production or version-tag mutation occurs.
- [ ] One audit PR is open against `main` and is not merged.
