# Root Audit Continuing Eligibility Contract

## Trigger and signatures

Apply to publisher eligibility, replay, invalidation, or required-check conclusions.

```js
evaluateContinuingEligibility({ bundle, source, evidenceDigest, publisher, adapter })
assertEvidenceFresh(bundle, now)
revokeCachedSuccesses({ appId, adapter })
```

## Guarantees and limits

Valid exact eligibility returns technical PASS / authorization VALIDATED / mergeAdmission BLOCKED / requiredCheckSuccessAllowed false. Native required-check success is a hard-coded false constant and cannot be enabled through policy or environment. Every completed publisher check must conclude failure; pending checks may be in_progress. Neutral/skipped cannot satisfy the intended gate.

Evidence checkedAt must be valid ISO time, nonfuture, and younger than 900000ms. Revalidate exact current main, PR/head/base/head repository, #122 and #135 state/title/exact-body digest, selected decision identity/body/Owner/expiry, and authenticated latest verifier run before publication and completion. Same-run altered evidence is rejected. Exact blocked result replay is idempotent.

Revoke-only sweeps invalidate every observed dedicated-App/context/head success, including legacy metadata-free green. Check mutation responses and final readback must prove failure; partial/API/App/credential failures report incomplete invalidation. Never renew success. Shared publication/sweep serialization does not serialize GitHub merge admission.

Schedules/events cannot guarantee removal of legacy cached green during outage or across a merge race. Live continuous expiry/revocation and final merge admission are NOT_READY. Disabled ruleset proposals must retain false apply/activation readiness, null API payload, no bypass, and independent Owner settings recovery. Actual App identity/permission/isolation/provenance and recovery need separate isolated live verification.

The repository opt-in KIRARI_R3_PUBLISHER_ENABLED defaults false and must be checked before Environment/private-key access. A future merge alone must not start credential-bearing jobs or auto-create their Environment.

## Required validation

Root audit tests and the 18-case activation matrix must cover exact positive eligibility, expiry/revocation/replay, source/SHA/topology/finding/issue changes, forged/wrong-App checks, absent credentials, API/outage/TOCTOU, cached expiry, and recovery lockout. Linux CI exercises actual nobody audit isolation. Mock/static tests and candidate CI must not be reported as live GitHub enforcement.
