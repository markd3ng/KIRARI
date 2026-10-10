# Final Admission Inspection Contract

## Scope and signatures

Apply to `scripts/root-audit/final-admission.mjs` and its callers. This module
implements executable, read-only evidence inspection and fixed capability
denial. It does not implement an authoritative merge admission service.

```js
assessFinalAdmissionCapability()
inspectFinalAdmission({
  verificationInput, verificationResult, bundle, source, evidenceDigest,
  publisher, expectedPublisherAppId, adapter,
})
```

The adapter supplies `apiUrl`, optional `now()`, `assertPullRequest(pr, head,
base, headRepository)`, `assertIssue122(snapshot)`, `assertIssue135(snapshot)`,
`getDecisionComment(id)`, and `getPublisherCheck(head)`. The existing live
publisher adapter includes current-main and latest-verifier ordering in its PR
assertion. A caller must preserve those checks. The inspector does not attest
adapter transport, credential custody, artifact acquisition, or live GitHub
provenance. Synthetic adapters remain synthetic evidence.

## Fixed capability boundary

`assessFinalAdmissionCapability()` takes no configuration and always returns a
frozen `NOT_READY` assessment. Caller flags, provider objects, App setup,
environment variables, or a claimed atomic authority cannot enable a grant.
The assessment records these current limitations:

- Native completed checks have no predicate for this authorization's expiry.
- Native PR merge does not atomically compare the decision, #122/#135 contracts,
  dependency/audit evidence, and expiry with the final branch mutation.
- The prepared checks-write-only App has no merge authority.
- No exclusive final admission authority has been established.

The documented synchronous and asynchronous PR merge APIs compare the expected
head SHA; they require Contents write permission. Their documented request
schemas do not include the other required authorization predicates. This is
the basis for the module's fail-closed capability assessment, not a claim that a
local last-second read supplies server authority. [GitHub PR merge API](https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request)

Required-check rules bind a context and optional integration ID, while a check
run's completion timestamp records completion rather than an authorization
lease. The assessment infers the missing atomic boundary from these documented
schemas. Reassess future platform changes through a reviewed implementation;
never accept a caller's boolean claim as evidence of a new native capability.
[GitHub rules API](https://docs.github.com/en/rest/repos/rules),
[GitHub Checks API](https://docs.github.com/en/rest/checks/runs)

## Inspection data contracts

- Clone all evidence before crossing async boundaries. Caller mutation cannot
  replace candidate/audit/source bytes during inspection.
- Load trusted policy and publisher policy digests from module-owned files.
  Ignore caller policy overrides. Preserve exact R3 topology and separate #122
  scope; raw audit failure remains evidence and the normal CI command remains
  fatal.
- Re-evaluate the complete candidate files, lock topology, audit bytes, issue
  contracts, source, and decision at the original canonical `checkedAt`.
  Compare the full original `verificationResult`, including raw audit hashes,
  against that derivation. Only the existing CLI's four documented trusted-run
  additions are normalized, with relevant values checked.
- Rebuild and compare the publisher bundle. Match source run/attempt, original
  evidence digest, current policy digest, and original candidate/digest bindings.
  Inspection never reruns an audit or refreshes old `checkedAt`.
- Use `evaluateContinuingEligibility` at current observer time before and after
  reading the App check. It checks freshness, current source/main/PR/head/base,
  both pinned issue contracts, exact Owner decision identity/body and expiry.
- Require a numeric expected dedicated App identity, excluding shared Actions
  ID `15368`. That expected identity is inspection configuration, not an
  attestation of live App custody or permission setup.
- Match the observed check's App, exact context/head/external replay binding,
  details URL, title, and summary against `buildExternalId` and `checkPayload`.
  Accept only completed `failure`. Missing, pending, forged, wrong-App, altered,
  or cached successful checks deny inspection.

## Outputs and errors

Every output is frozen and includes `authoritative: false`,
`liveTransportVerified: false`, `mergeAdmission: BLOCKED`, `mergeAllowed: false`,
`requiredCheckSuccessAllowed: false`, `consumptionAllowed: false`, and the fixed
`NOT_READY` capability.

| Observed state | Inspection | Effect |
|---|---|---|
| Exact valid evidence and bound blocked App check | `VALIDATED_BUT_BLOCKED` | Evidence identity only; no merge grant |
| Missing setup, malformed evidence, drift, replay mismatch, expired/revoked decision, missing/wrong check, API/publisher failure | `DENIED` | Record failed phase; no grant |
| Mutation during check read | `DENIED` at final observation | No write or grant |
| Repeated exact evidence | Same inspection digest while observations remain valid | No reusable or single-use authorization token |

An inspection digest is an evidence fingerprint, not a durable replay ledger or
bearer authorization. Changed run/evidence/check bindings are rejected; exact
reinspection remains idempotent evidence. Adapter errors are discarded because
they can contain credentials; outputs retain only the failed phase. The module
never calls check mutation, merge, ruleset, credential minting, or deployment
callbacks.

## Real remaining prerequisites

The inspection engineering is independently executable and tested. Operational
final admission remains `NOT_READY` because no supported current native
transaction enforces the full invariant. A live App and keys can demonstrate
publisher provenance and custody; they do not resolve atomic admission.

A future supported remedy requires a separately reviewed, actually available
platform/authority that evaluates all authoritative state and expiry at the
final branch mutation, rejects unknown or unavailable state, and prevents an
alternative merge route from bypassing that evaluation. A generic external
broker that polls GitHub issue comments and then calls merge still has the same
race. New authority, decision-store semantics, permissions, or branch controls
must have explicit authorization and live verification; this module grants
none of them. Until then, retain disabled native success and the unapplied
ruleset. Do not label the remaining platform constraint as a completed live gate
or suggest that ordinary App setup alone can make it ready.

## Required validation

Run `node --test scripts/root-audit/tests/final-admission.test.mjs` and the full
root-audit suite. Cover exact evidence, expiry/revocation after green, source
and dependency mutation, additional qualifying findings, #122/#135 changes,
raw byte substitution, source/attempt/evidence replay, wrong App/check binding,
missing setup, API/publisher outage, read races, future/stale evidence,
caller-policy and atomicity spoofing, no-write guarantees, and error redaction.
The fixture factory is synthetic and cannot establish live enforcement. Keep
real isolated harness observations distinct from this module's inspection.
