# Execution

- [x] Reconcile main, #99/#98 and Project; preserve older local P2 checkout.
- [x] Discover current production targets/environments/credential boundaries read-only; verify official Vercel semantics.
- [x] GitHub execution tasks A authorization/workflow, B immutable artifact, C validation/evidence, D rollback; mark active independent tasks In Progress.
- [x] Implement independent owned modules with gpt-6-luna/max workers; integrate shared interfaces.
- [ ] Focused positive/negative contracts, rollback simulation, full relevant CI; preserve P1–P3.
- [ ] PR, exact-head deterministic CI, advisory review disposition, independent review and normal merge gates.
- [ ] Re-read merged main/source/artifact/target and return concrete OWNER GATE. No production action.
- [ ] Only after fresh exact authorization: production workflow, evidence, independent Phase Exit Audit, reconcile #99/Project.

Validation: pnpm install --frozen-lockfile; focused scripts/tests; pnpm site:test; pnpm composition:test; pnpm site:contract:test; pnpm profile:check; pnpm trellis:check; QA; Site types/Astro; Edge types/tests/dry; generated config; build; release/version; audit moderate; git diff --check; exact-head CI. No live production workflow dispatch before owner authorization.
