# Execution

- [x] Verify the merged #145 security repair and post-merge main CI (`6f5e65981df13b27592ecb518de9cb6a577ab797`; CI run `38835218305` passed).
- [x] Read current Issues #102 and #110–#112, Site call sites, package specs, Trellis workflow, and GHCardCache source at `b7fecbbe8120c64de9cfa1557273656beab8d02d`.
- [x] Add the platform-independent workspace package, route/API/cache contracts, migration matrix, and focused built-in tests.
- [x] Add package type-check/test to normal root and GitHub CI without adding adapter or deployment behavior.
- [x] Run package tests/type-check, root checks, build, contract/release checks, browser checks, dry-run adapter checks, and `git diff --check`.
- [x] Independently review and fix confirmed findings; exact PR HEAD and GitHub CI remain pending.
- [ ] Create a focused Core PR. Merge only after the accepted Core contract, review, and required checks pass.
- [ ] Keep Issue #102 open until Core acceptance; start no #110–#112 adapter implementation before that gate.

No production project settings, credentials, or deployments are in scope.
