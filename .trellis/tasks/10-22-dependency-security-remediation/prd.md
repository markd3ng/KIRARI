# Dependency Security Remediation

## Goal

Remediate actionable dependency security advisories on `main` without replaying resolved Astro/tar work or hiding unresolved upstream risk.

## Requirements

- Use the current `main` baseline `3f86df5fe5a320373aa51aa58a29ff494e9354b4`; the older `dev` audit is not a source of current dependency state.
- Update affected packages to supported upstream fixes where they remain compatible with the existing Astro site and build pipeline.
- Verify each remaining advisory against its affected version, dependency path, runtime reachability, and upstream fix status.
- Do not disable audit, lower the audit threshold, or claim a dependency is patched when the vendor has not shipped a fix.
- Keep Production configuration and deployment credentials untouched; prepare a reviewed PR and stop before merging to `main`.

## Acceptance Criteria

- [ ] Current dependency audit is captured and all applicable Critical/High advisories are either remediated or explicitly shown to have no available fix, with reachability assessed.
- [ ] Compatible patched releases resolve their advisories; necessary site tests, type checks, and production build pass.
- [ ] Lockfile is reproducible with the repository's pinned pnpm version and no unrelated dependency churn is introduced.
- [ ] Independent review and GitHub CI complete on the exact PR HEAD.
- [ ] Residual advisories and risks are stated accurately; no Production deployment occurs.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
