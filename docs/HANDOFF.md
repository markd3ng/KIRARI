# KIRARI handoff — 2026-10-22

## Sources of truth

- [GitHub Project #1](https://github.com/users/markd3ng/projects/1) is the live
  roadmap and progress source; use each Issue for its acceptance criteria.
- `main` is the release source. The `v0.5.0` tag identifies this release
  snapshot; check current GitHub state before continuing later work.
- Trellis task archives hold detailed execution and acceptance evidence. This
  handoff is only a current-state guide, not a second project ledger.

## Current state

- Project #1 records all 33 P0–P8 roadmap items as Done / Completed Phase.
- Issue [#122](https://github.com/markd3ng/KIRARI/issues/122) remains the sole
  informational Backlog item: upstream has not confirmed a compatible fix for
  the disputed `http-cache-semantics` behavior. It is nonblocking; do not claim
  the behavior is fixed or close the issue without fresh upstream evidence.
- KIRARI uses GitHub-to-Vercel native Git deployment from `main`. A merge to
  `main` can trigger Production; verify the exact commit and deployment after
  each release. Do not restore the retired C1/Trusted Sources or custom
  promotion controller.
- Gateway adapter code is accepted, but code acceptance does not prove live
  Cloudflare Cache or EdgeOne runtime behavior. Treat those as platform
  validation limits, not reopened Project phases.

## Release contents

`v0.5.0` includes the P5 Gateway Core and platform adapters, P6 canonical
Markdown views and `llms-full.txt`, P7 post-deployment IndexNow, P8 visitor
analytics controls and AdSense placements, compatible dependency security
updates, and the Iconify CSP correction. Analytics and advertising identifiers
remain configuration-specific; no credentials belong in this public repository.

## Continuing work

Before starting, read current `main`, Project #1, the relevant Issue, and the
active Trellis task. Use normal pull requests and required CI. The `dev` branch
is not the release source; compare its current history with `main` before any
integration. Keep #122 open until its own upstream exit criteria are met.
