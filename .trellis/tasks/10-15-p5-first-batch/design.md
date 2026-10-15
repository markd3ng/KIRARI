# Design

Baseline main1d8997d647c17d448be906108b510f75c24e0efa, independently fetched and ancestor verified. Use isolated p5-hardening worktree/branchcodex/p5-first-batch; preserve root P2 and completed P4 records.

Keep first-batch changes at their existing owners. Worker Adapter owns only sync checker/tests and adapter copies if real drift exists. Worker TOC owns widget/TOC and dedicated TOC utility/tests. Worker Mermaid owns Markdown preprocessing, client Mermaid runtime and dedicated tests. Root owns CSP/provider alignment, CI test registration, shared spec/doc updates and integration. No worker edits shared config/layout/runtime hooks without coordination. Existing transition-manager is reused; no generic lifecycle framework or broad refactor.

Keep rollback as ordinary source revert before merge; no provider operations. Current source and tests prove implementation, Issue contracts define remaining scope. Gateway remains an optional application capability with exact operation whitelist, isolated secrets/cache and adapters around shared business logic; plan only after consumer inventory. Later-phase privacy/enablement decisions remain unchanged and explicit where still needed.
