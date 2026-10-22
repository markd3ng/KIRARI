# Implementation Plan

1. Record the fresh `main` audit and classify each advisory by affected dependency path, available upstream fix, and reachability.
2. Update only compatible vulnerable dependencies and regenerate the lockfile with pnpm 9.14.4 under Node 22.
3. Re-run the audit and inspect the resolved versions and peer dependencies; back out any forced major override that fails compatibility checks.
4. Run site tests, type checks, Astro checks, full repository checks, release checks, production build, and `git diff --check`.
5. Review the final diff and residual advisories independently; verify the tested commit is exactly the PR head.
6. Push the branch, open a focused PR targeting `main`, and wait for required GitHub CI. Do not merge because that would trigger native Production deployment and this request does not authorize that step.
