# Implementation plan

1. Add a compact provider behavior matrix and record exact official API
   references in `research/provider-behavior.md`.
2. Implement persistent Privacy Settings storage and accessible localized UI;
   add focused unit/browser tests for default state, opt-out, persistence,
   restore, malformed storage, and route lifecycle.
3. Move Analytics vendor loading into one gated runtime. Preserve shared config
   and CSP resolution; implement one page-view dispatch path and provider
   adapters without duplicate auto-tracking.
4. Add disabled-by-default Ads configuration, validation, `AdSlot` rendering,
   Production-only environment gating, AdSense CSP sources, named article
   placement, and Search AdSense suppression. Preserve static sponsor and
   ads.txt behavior.
5. Update bilingual profile comments, README/README_CN, SECURITY_MODEL, and
   focused tests for the public config and network behavior.
6. Run focused unit and browser tests; then run the full repository standard
   validation on the final candidate.
7. Review the complete diff, verify no production credentials/configuration or
   deployment action changed, update Issues #106/#107 and Project #1 only with
   verified evidence, and leave merge/deployment to the existing authorized
   delivery rules.

## Verification commands

- `pnpm site:test`
- `pnpm site:type-check`
- `pnpm site:astro-check`
- `pnpm edge:type-check`
- `pnpm edge:test`
- `pnpm build`
- `node apps/site/scripts/qa-regression-check.mjs`
- `pnpm release:check`
- `node apps/site/scripts/generate-vercel-config.mjs --check`
- `pnpm trellis:check`
- `git diff --check`
