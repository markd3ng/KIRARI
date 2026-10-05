PARENT_CONTRACT=#99 / RM-05
PROPOSED_PHASE=P4_AUTHORIZED_PRODUCTION_DEPLOYMENT
WORKSTREAM=C

SCOPE
Reuse P3 browser core with production canonical/robots/network contract; bind secret-free release evidence to exact deployment and artifact.

DEPENDENCY
Independent implementation; integration consumes A/B verified identities.

ACCEPTANCE_CRITERIA
- Deliver the scoped engineering implementation with focused negative/positive checks and reviewed PR.
- Preserve P1–P3, the main Git deployment guard and immutable no-rebuild chain.
- No production mutation, production settings/secrets, DNS, release/tag, indexing, Gateway or P5+ action is authorized.

DELIVERY_EVIDENCE
Positive/negative production policy and evidence tests, local browser proof.

STATUS
Engineering in progress. #99 remains open until separately authorized production evidence and independent Phase Exit Audit pass.
