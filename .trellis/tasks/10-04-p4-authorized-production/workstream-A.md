PARENT_CONTRACT=#99 / RM-05
PROPOSED_PHASE=P4_AUTHORIZED_PRODUCTION_DEPLOYMENT
WORKSTREAM=A

SCOPE
Owner-only main manual workflow, exact target/artifact approval, replay/concurrency denial and credential/environment isolation.

DEPENDENCY
Independent of B/C/D after interface freeze; integration depends on all streams.

ACCEPTANCE_CRITERIA
- Deliver the scoped engineering implementation with focused negative/positive checks and reviewed PR.
- Preserve P1–P3, the main Git deployment guard and immutable no-rebuild chain.
- No production mutation, production settings/secrets, DNS, release/tag, indexing, Gateway or P5+ action is authorized.

DELIVERY_EVIDENCE
Positive/negative authorization and workflow tests, protection readback, threat model.

STATUS
Engineering in progress. #99 remains open until separately authorized production evidence and independent Phase Exit Audit pass.
