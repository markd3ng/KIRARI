# Implementation Plan

- [x] Review the final plan and confirm the main/tag release boundary.
- [x] Add the exact Iconify HTTPS hosts to shared `connect-src`, regenerate
   `vercel.json`, and remove the browser test's tolerated Iconify CSP blocks.
- [x] Add focused assertions for CSP origin scope and blocked-request failure.
- [x] Rewrite `docs/HANDOFF.md` to match Project #1 and release state; retain the
   detailed history in archived Trellis evidence.
- [x] Update both package versions, add the `0.5.0` Changelog entry, and make the
   release regression check read the package version by default.
  - Review found that the prior CSP exception classifier had become an
    identity-only wrapper; it and its no-op unit test were removed. The actual
    two-viewport browser smoke now asserts the complete violation list is empty.
- [x] Run focused tests and repository checks:
   - `pnpm site:test`
   - `pnpm site:type-check`
   - `pnpm site:astro-check`
   - `pnpm site:contract:test`
   - `pnpm release:check`
   - `pnpm release:version-check v0.5.0`
   - `pnpm build`
   - `pnpm edge:type-check`, `pnpm edge:test`, `pnpm edge:deploy:dry`
   - `node apps/site/scripts/qa-regression-check.mjs`
   - `node apps/site/scripts/generate-vercel-config.mjs --check`
   - `git diff --check`
- [ ] Push a focused branch and open one PR to `main`; verify standard CI and
   independent review on the exact HEAD, then merge using repository convention.
- [ ] Verify post-merge main CI, native Production identity/status, and a real
   browser smoke of Iconify, routes, assets, search, canonical/robots and
   security headers. Do not tag if any required check fails.
- [ ] Create and push annotated tag `v0.5.0` on the verified main commit. Confirm
   local and remote tag object/target, wait for the tag-triggered standard CI,
   and leave Issue #122 open in Backlog. The tag event does not match the
   composition job's dispatch/config trigger conditions.

Local validation note: `pnpm check` reaches all type, Astro, Edge and Gateway
checks, then the profile sync subcheck sees the ignored local Finder metadata
file `packages/site-profile/assets/images/.DS_Store` in this checkout. The
profile check passes when that ignored file is temporarily parked outside the
repository and restored afterward; the file was not deleted or committed.
