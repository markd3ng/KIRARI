> **Owner continuation — 2026-10-10:** PR #139 retired the R3 dependency admission platform. T1 dependency approval/exception requirements below are historical and superseded. Current work refreshes existing PR #133 on main `0945eb82e76cab1878e7324ef3447f37855dfe79`, removes obsolete root-audit/T1 consumers, and retains strict artifact, credential, browser and rollback checks. Production remains separately authorized.

# Production engineering design

Boundary: production workflow_dispatch from reviewed main invokes small shared Node/Python boundaries. Separate authorization/preflight before the protected production credential job. Bind exact workflow SHA, source run/attempt/SHA, package ID/archive digest, Core/Site SHAs, team/project, complete production domain set, current deployment, operation and prior approved release record into a one-time approval. Deny reruns and reused dispatch authorization.

Immutable package: consume P3 package unchanged; its embedded Preview target is historical packaging metadata, not permission to rewrite output or infer production indexing. Reverify both archives and manifest/tree digests. Production indexing expectations must be derived from actual immutable HTML/robots and target, and incompatible packages fail closed. Select documented Build Output API/no-build production staging then promotion only after identity/output/browser checks, if confirmed by official API docs. Do not mutate Vercel during research.

Rollback: retained successful production workflow evidence is the approval source; exact run/artifact archive digest binds release record to deployment/package/target. Verify live READY identity and output, restore the existing immutable deployment, validate aliases/browser, emit separate truthful result. First release may have no provable prior record: report UNKNOWN rather than bless legacy deployments.

Ownership: A workflow/authorization contract; B shared package/archive verification and immutable deployment helper; C production browser/evidence; MAIN target discovery, release-record/rollback integration, Project/PR/checks. Interfaces are reconciled before integration. Credential responses are minimized before logs/artifacts; no raw project or token data in evidence.

## Threat boundaries

| Threat | Required check |
| --- | --- |
| Replay or rerun | Exact short-lived nonce binding; first production attempt; immutable consumed claim; global workflow concurrency |
| Source substitution or stale selection | Owner-dispatched successful exact CI run/attempt; full SHA; verified main ancestry; current workflow/main SHA re-read before writes |
| Artifact substitution | Server ID/name/run/SHA/expiry; archive SHA-256; safe extraction; normalized output and upstream byte/provenance equality |
| Target substitution | Complete target in the approval digest; protected environment; live team/project identity and domain set |
| Credential leakage | No credentials in preflight; production secret only in protected operation; sanitized evidence; exact-origin OIDC request handling |
| Preview confusion | Preserve package descriptor; require newly staged READY Production deployment; never promote the existing Preview |
| Wrong alias assignment | Validate staged bytes/browser before promotion; current aliases re-read; every approved alias checked after promotion |
| Concurrent changes | Workflow concurrency plus fresh main, metadata, environment, deployment and alias checks before writes |
| Unverified rollback | Successful first-attempt owner production record from a reviewed main ancestor; exact retained evidence ZIP/record/package fingerprints; live READY identity and byte check |
| False success after failure | Failed promotion/health remains FAIL; restoration is a separate result; failed restoration remains INCOMPLETE |
| Indexing side effects | No build, postbuild, indexing endpoint or notification command in the production path; browser policy blocks unapproved origins |

Discovery found `kirari-main` as the current production candidate, with three
production aliases pointing to a legacy Git deployment. Its artifact provenance
is UNKNOWN; no approved rollback candidate is inferred. The retained P3 package
uses `https://example.com` and fails the candidate's canonical policy. Dedicated
GitHub protection, production credential permission, and exact Production
Trusted Sources readback are prerequisites, not assumed facts. No settings were
changed and no production write is authorized.

## Remediation boundary refinements

Canonical input is a separate source branch from accepted Site SHA e739, changing only its explicit site.url to the candidate origin; exact source PR #134 is b1b488ce9491c75718a32cbcf06351d908204358 and retains Core c796. A successful manual CI run on main produces a new package through the unchanged pipeline. Existing P3 source/artifacts remain immutable.

Trusted Sources validation also binds the complete configured trust set: explicit false same-repository CI flag, empty custom project rules, one unambiguous external GitHub provider container and exact existing claims/Production target. Unknown authenticated serialization remains blocked instead of inferring defaults or accepting extra callers. Source correction requires no provider setting mutation. CI records audited local Chromium before an independent tooling failure; the audit still blocks its job/merge and remains before live credential mapping.

## Approved T1/C1 application — 2026-10-05

Add isolated tooling and credential validators with exact content/hash/runtime/runner/command/target binding, finite expiry, current inventory comparison, unknown exposure and independent review. Bind separate Owner approval to canonical manifest digest, never a framework boolean. Workflow collects complete audit before evaluating acceptance before credential mapping. No change to immutable upload/promote/rollback semantics. Owned streams: A tooling validator/lock/evidence/tests; B credential validator/template/evidence/tests; independent D contract/advisory challenge; MAIN workflow/runtime integration, docs, validation and GitHub reconciliation.
