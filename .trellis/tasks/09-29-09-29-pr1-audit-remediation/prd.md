# PR-1 Audit Remediation

## Requirements

Repair only the confirmed PR-1 engineering findings F1, F2, F4, F5, F6, F8, and F9 against the current repository HEAD. Preserve existing features and required checks. Independently assess F3 (Astro/AVIF) and F7 (tar) against the current lockfile and authoritative advisories; do not mix dependency upgrades into this work.

Do not push, create a PR, merge, release, deploy, or submit production indexing requests. Preserve all pre-existing user work, including the untracked `kirari-agent-pack-v2/` directory.

## Acceptance Criteria

- CI prepares the profile before checks that require materialized inputs, retains fail-closed input validation, and runs `site:test` as a required workflow step.
- Default and external Site builds share an explicit build-only indexing boundary; tests with dummy credentials prove neither IndexNow nor Google indexing can reach the network.
- Dist replacement survives ordinary failure and documented crash points with deterministic recovery and repeatable runs.
- README/security and Trellis guidance match current implementation and do not claim an OS-level read-only sandbox.
- F3/F7 conclusions distinguish advisory range, installed version, reachability, exposure, and recommended separate security PR.
- Required local verification, diff review, and a fresh independent audit are reported without inventing remote CI evidence.

## Scope

F1–F9 as specified in the user-provided audit brief. No unrelated refactors, dependency upgrades, push, PR, merge, release, or deployment.
