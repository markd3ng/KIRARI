> Historical pre-application draft. Applied/read-back results and current statuses are in [roadmap-final-reconciliation.md](./roadmap-final-reconciliation.md); this draft is not live execution guidance.

# Roadmap reconciliation — native hosting correction

Fresh audit contains **33 Project items**, **16 field definitions**, and **35 issue dependency snapshots**. All item field pages are complete. `issue-updates/reconciliation-matrix.json` preserves every actual field value and lists every unset field; this is the full Project review, not an open-issue-only sample.

The Project has Status, Priority, Phase and Roadmap Status custom selects plus12 built-in fields. At initial read Phase supports only Phase0–3 and later roadmap phases are unset. Root will extend the existing field with Owner-defined Phase4–8 using GitHub-supported option IDs, preserve all existing option IDs/colors/descriptions and populate actual roadmap phases; priorities, Roadmap Status and parent relations remain unchanged. Repository/title fields are provider-derived; unchanged unset assignee/reviewer/milestone/date values are recorded in the matrix.

|Issue|Current state / status|Action|Replacement status|
|---|---|---|---|
|#86|CLOSED / Done|KEEP|CLOSED / Done|
|#87|CLOSED / Done|KEEP|CLOSED / Done|
|#88|CLOSED / Done|KEEP|CLOSED / Done|
|#89|CLOSED / Done|KEEP|CLOSED / Done|
|#90|CLOSED / Done|KEEP|CLOSED / Done|
|#91|CLOSED / Done|KEEP|CLOSED / Done|
|#92|CLOSED / Done|KEEP|CLOSED / Done|
|#95|CLOSED / Done|SIMPLIFY_REFERENCE|CLOSED / Done|
|#96|CLOSED / Done|SIMPLIFY_REFERENCE|CLOSED / Done|
|#97|CLOSED / Done|SIMPLIFY_REFERENCE|CLOSED / Done|
|#98|CLOSED / Done|REWRITE|CLOSED / Done|
|#99|OPEN / In Progress|REWRITE|OPEN / In Progress|
|#100|OPEN / Todo|REWRITE|OPEN / Todo|
|#101|OPEN / Todo|SIMPLIFY_REFERENCE|OPEN / Todo|
|#102|OPEN / Todo|SIMPLIFY_REFERENCE|OPEN / Todo|
|#103|OPEN / Todo|SIMPLIFY_REFERENCE|OPEN / Todo|
|#104|OPEN / Todo|SIMPLIFY_REFERENCE|OPEN / Todo|
|#105|OPEN / Todo|SIMPLIFY_REFERENCE|OPEN / Todo|
|#106|OPEN / Todo|SIMPLIFY_REFERENCE|OPEN / Todo|
|#107|OPEN / Todo|SIMPLIFY_REFERENCE|OPEN / Todo|
|#109|OPEN / Todo|SIMPLIFY_REFERENCE|OPEN / Todo|
|#110|OPEN / Todo|SIMPLIFY_REFERENCE|OPEN / Todo|
|#111|OPEN / Todo|SIMPLIFY_REFERENCE|OPEN / Todo|
|#112|OPEN / Todo|SIMPLIFY_REFERENCE|OPEN / Todo|
|#117|CLOSED / Done|SIMPLIFY_REFERENCE|CLOSED / Done|
|#118|CLOSED / Done|SIMPLIFY_REFERENCE|CLOSED / Done|
|#119|CLOSED / Done|SIMPLIFY_REFERENCE|CLOSED / Done|
|#120|CLOSED / Done|SIMPLIFY_REFERENCE|CLOSED / Done|
|#129|OPEN / Blocked|REWRITE|OPEN / In Progress|
|#130|OPEN / In Review|REWRITE|OPEN / In Progress|
|#131|CLOSED / Done|REWRITE|OPEN / Blocked|
|#132|CLOSED / Done|REWRITE|OPEN / In Progress|
|#135|CLOSED / Done|SIMPLIFY_REFERENCE|CLOSED / Done|

## Contract decisions

- #99/#129–132 now define native Git configuration, product build compatibility, actual Production smoke and native recovery. Reopen #131/#132 because old Done meant local/simulation engineering under retired machinery; it cannot imply new native acceptance. #131 stays Blocked awaiting cutover evidence; #132 In Progress covers documentation/read-only work. #129 old Trusted Sources blocker is retired, replaced by engineering work and later one Owner cutover decision. #130 no longer uploads Production artifacts.
- #98 remains closed for completed P3 work. Preserve portable packaging and minimal/full/migrated browser tests; use native Preview instead of a custom staging controller. No fresh remote Preview success is claimed.
- #102/#110–112 retain optional Gateway capability/runtime/cache/token boundaries; native deployment and Gateway are separate concerns. #103/#104/#105/#109 independent hardening; #101 LLM discovery keeps canonical/language/Markdown/no llms-small requirements. #106/#107 keep consent/provider/default-off/CSP/lifecycle requirements. None inherits P4 release admission.
- #100 requires an authenticated supported native deployment signal binding exact approved team/project, Production environment, commit, READY deployment and canonical domain, with rejected stale/replay/wrong-target/failure signals. Main CI is insufficient. Indexing remains opt-in/default-off and is not implemented here.
- #95–97/#117–120 stay completed; prepend minimal current-reference clarifications and retain original delivery history. #135 remains superseded with a minimal reference correction. #122 stays independent upstream maintenance. #108 stays closed duplicate, outside Project.

## Native dependencies

Current P3/P4/P5–P8 native blockedBy lists are empty. There are therefore no live custom admission dependency edges to delete; obsolete dependency assumptions occur in bodies. Add actual product dependencies listed in the matrix: #99→#129–132; #100→#99; #102→completed#95–97; adapters→#102; consent→#95/#103; ads→#95/#106; LLM/Mermaid→completed#98. #131→#129/#130; #132→#129 (browser checklist can reuse131 without forcing a live rollback). Existing security/P1/P2 edges and all parent/subissue links remain. No Gateway, CSP, TOC, Trellis, LLM, analytics or advertising edge points to P4.

## Protection and mutation boundaries

Fresh rulesets snapshot is empty. main branch-protection GET returns404 “Branch not protected”; ordinary GitHub review/CI practices cannot be described as verified enforced protection. Do not mutate rulesets/protection as part of Issue drafting. Drafts preserve source-check/secure-permission requirements and report protection gap for cutover review.

These files are proposed existing-issue body/title/state replacements, not posted changes. Apply Issue129 body/title only; never touch its historical Owner approval comments. Existing P4 history is retained in explicitly superseded details; no old approval is reused and no production deployment or credential/settings cleanup is claimed.
