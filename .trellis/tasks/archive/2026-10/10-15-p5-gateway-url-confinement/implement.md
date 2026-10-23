# Execution

- [x] Verify the current #102 contract, main baseline, Worker source, active callers, and exact authority-changing URL trigger.
- [x] Read the required edge backend and shared workflow guides.
- [x] Add the fixed-origin guard and regression tests without changing Worker configuration or deployment behavior.
- [x] Run `pnpm edge:type-check`, `pnpm edge:test`, `pnpm edge:deploy:dry`, and root CI checks relevant to changed docs/source.
- [x] Create focused PR #145 for the narrow #102 security repair; leave it open for normal review and CI.

This task does not complete Issue #102. Continue the portable capability contract only after the isolated forwarding fix has a reviewed result.
