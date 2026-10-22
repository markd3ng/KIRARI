# Dependency Security Remediation

## Goal

Apply compatible dependency security updates on `main` and accurately track the
remaining disputed `http-cache-semantics` advisory.

## Requirements

- Use the current GitHub `main` and exact PR/CI evidence.
- Update dependencies only through compatible, validated releases.
- Do not claim the disputed upstream behavior is fixed without an upstream fix.
- Keep the remaining follow-up informational and nonblocking.

## Acceptance Criteria

- [x] Compatible security updates and lockfile changes merged in PR #160.
- [x] Site tests, checks, build, and release checks passed on the candidate.
- [x] Exact-main CI run 39717053085 succeeded on `5d9303c708e3d61acf11920d6c8252cae589b8a9`.
- [x] The `http-cache-semantics` behavior remains accurately documented and tracked by Issue #122.
- [x] Native Production deployment followed the Owner-authorized merge; no manual deployment or credential/configuration change occurred.

## Outcome

PR #160 merged on 2026-10-22. Available compatible patches were applied. The
upstream `http-cache-semantics` dispute remains open as informational Issue #122;
KIRARI does not claim that the disputed behavior was fixed.
