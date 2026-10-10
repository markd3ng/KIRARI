# P4 engineering validation

These are nonproduction checks. No Production deployment, promotion, alias,
settings/secrets, DNS, indexing, release/tag or live rollback was performed.

The final integrated P4 suite on 2026-10-05 passed 87 tests with no failures or
skips under Node 22.12.0, including Chromium against local simulated HTTPS.
All 18 full local CI commands passed: profile materialization/check, P1–P3
contracts, Site tests/contracts, Trellis, QA, Site TypeScript/Astro, Edge
TypeScript/tests/dry deployment, generated Vercel config, build and
release/version checks. The subsequent shared-browser P3 checks passed 15
contracts. See `final-local-ci.json` for the command results.

The root dependency audit passed with the existing narrow #122 policy: one low
advisory and one existing ignored high advisory remain. No production-tooling
audit exception was added. The official pinned Vercel CLI dependency audit is
still a blocking failure. Exact-head GitHub CI remains the merge gate; a failed
audit is not a PASS, and the engineering PR cannot merge with that gate red.

The actual source package and upstream ZIPs were independently checked:
315 static files, 8,915,636 bytes, exact archive digests, manifest and composition
provenance. A fresh download of package 11297428920 matched its exact SHA-256.
All 29 canonical documents pass their own `https://example.com` route policy.
The candidate `https://kirari-main.vercel.app` correctly fails the canonical
origin check. Immutable package bytes were not edited. Route policy permits
only an optional final slash, matching the existing localized search canonical;
wrong paths, query strings, fragments and userinfo are rejected.

Independent review corrections include owner-only environment reviewers,
first-release null snapshots, failed direct-rollback write evidence, explicit
main source metadata on staged deployments, dedicated Production credential
names, and canonical route validation. Focused regressions pass. Production
uses only `VERCEL_PRODUCTION_TOKEN`, with distinct target variables, in the
protected operation step. GitHub's workflow token cannot attest secret scope;
external owner metadata proof is a hard live-readiness prerequisite.

Rollback simulation authenticates the prior release archive and exact record,
retains original package/composition ZIPs, rejects producer/record/target/digest
substitution and verifies restored state through injected adapters. A still
retained authenticated release archive can supply rollback bytes after original
CI artifacts expire; expired release evidence is rejected. Live rollback is
NOT_AUTHORIZED. Chromium simulation is not live Production proof.

Operational prerequisites remain: a compatible reviewed Site artifact, the
owner-only protected `kirari-site-production` Environment, proven environment-only
credential scope/permission, exact authenticated Production Trusted Sources
readback, and fresh target/artifact-bound owner approval. The current legacy
Production deployment has UNKNOWN immutable provenance and is not an approved
rollback record. The documented project GET response must actually expose the
Trusted Sources shape required by the fail-closed runtime before a live attempt.

#99 / RM-05 remains open until authorized Production provenance/health evidence
and a fresh independent Phase Exit Audit satisfy the full contract.
