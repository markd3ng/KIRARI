# Implementation

1. [x] Create an isolated branch from current `origin/main` and establish the local Trellis identity.
2. [x] Add `.ads` at the approved v0.3 SHA and update the root KIRARI guidance.
3. [x] Add the minimal native Codex skill pointer for ADS adoption.
4. [x] Verify gitlink/checkout SHA, links and harmless Codex skill discovery. Codex CLI v0.163.0 found `ads-adopt`, read its pointer and the pinned canonical ADS skill, and made no edits under a read-only sandbox.
5. [x] Run relevant documentation and repository checks; inspect the exact diff. `pnpm trellis:check`, `pnpm release:check`, `node --test scripts/tests/trellis-adapter-sync.test.mjs` (8/8), Codex CLI skill-discovery smoke test, submodule SHA check, adapter parity assertions, and `git diff --check` passed; independent review passed for the adoption changes.
6. [ ] Push a focused branch and open a PR; do not merge without required gates and valid repository policy.

## Limits

- This adoption does not prove universal ADS compatibility or private-repository checkout behavior.
- No runtime, Vercel settings, secrets, or production state are changed.
