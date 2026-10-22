# Design

## CSP and Iconify

`apps/site/scripts/security-policy.mjs` is the shared CSP source used by the
generated host configurations. Add the three already-observed Iconify API
origins to its fixed `connect-src` allowlist; do not add them to `script-src`,
accept configurable origins, or use a wildcard. Regenerate `vercel.json` through
the repository's existing generator. The existing browser test currently
suppresses these exact CSP violations as baseline noise; remove that exception
so a regression fails the test.

This keeps the existing remote Iconify loading design. It allows icon fetches to
the three specific services and therefore allows those requests to disclose the
visitor's network metadata to the selected Iconify endpoint. No analytics or ads
origin is added by this change.

## Handoff and release metadata

`docs/HANDOFF.md` is the only handoff file. Replace its historical, conflicting
active-state narrative with a concise pointer to Project #1 as the live roadmap
source, its verified P0–P8 completion state, the outstanding nonblocking #122
item, main/tag release identity, and current native deployment model. Detailed
historical evidence stays in Trellis archives and existing CI links.

Advance the root and Site package versions to `0.5.0`, add a dated Keep a
Changelog section summarizing the P5–P8 user-facing release and this Iconify
fix, and make `scripts/release-regression-check.mjs` default to the root
package version rather than a frozen `0.4.1` literal. Keep the explicit
`KIRARI_RELEASE_VERSION` override for CI or targeted verification.

## Delivery and rollback

Submit one focused PR targeting `main`. A failed CSP/browser/build check blocks
merge. After merge, verify the exact main CI SHA, native Production deployment,
canonical domain, and browser behavior before tagging. Create annotated Git tag
`v0.5.0` on that verified main commit; do not create a GitHub Release. If the
deploy or smoke test fails, do not tag; fix through a follow-up PR or use the
existing native Vercel recovery path only if required and authorized.
