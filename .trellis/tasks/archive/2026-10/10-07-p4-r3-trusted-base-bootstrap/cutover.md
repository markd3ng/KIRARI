# Owner cutover checklist — native Git deployment

This correction is prepared for review only. One separate Owner decision must cover the final PR merge and its expected native Production deployment. No merge, Production configuration change, promotion, rollback or credential revocation has been performed.

## Before / after

|Responsibility|Baseline main|Candidate|
|---|---|---|
|Production|main Git deployments disabled; Actions admission/upload/stage/promote controller|Vercel native Git builds main; no competing Actions publisher|
|Preview|native Git plus custom staging machinery|native Git feature-branch Preview|
|GitHub CI|source checks plus C1/release prerequisites|source checks, browser fixtures, portable exports; advisory OCR/audit|
|Product guarantees|Core/Site immutable pins, deterministic composition, safe inputs, provenance|retained independently from release authorization|

## Current read-only findings

Baseline main is `c6db5da47d1b5d853a38032e1b676fb0cf2c013a`. Reads on 2026-10-15 authenticated through the existing Owner CLI session identify team `team_NsBZHGUVnyygP7veiROKLuUx`, project `prj_QNMVdxTkPOad4ynN4fwFCYEST8Jk` / `kirari-main`, GitHub `markd3ng/KIRARI`, Production branch `main` and root directory null (repository root). Git deployment creation is enabled. No project build/install/output overrides are set; repository `pnpm build` and `apps/site/dist` match the actual monorepo build and recent deployment settings. Current project environment metadata is empty, queried with decryption disabled. The canonical domain is verified `kirari-main.vercel.app`, without branch/custom-environment/redirect assignment. Automatic custom-domain assignment is currently true.

The current Production target remains legacy READY deployment `dpl_7ACbEGqeC8f7yyqZqmAjzL78F5sB`, commit `408dff70c5aa7b39cbd3df31103b5847dba9751f`. It is not evidence that current main or this correction reached Production. The fully paginated 87-record history read on 2026-10-14 is historical corroboration, not fresh post-cutover proof.

The current project API omits both ignored-build fields. Recent deployment snapshots have no ignore command, but that does not establish the current dashboard setting. main branch protection returns 404 and inherited rulesets are empty. No existing enforced protection can be claimed; no protection setting was changed.

## One Owner cutover decision

1. Review the final PR head, source CI, independent review and advisory findings. Refresh main/head and exact project/Git/root/build/domain identity before merge; stop on unexpected drift.
2. Confirm the current dashboard Ignored Build Step will permit main, and review the reported absence of enforced branch protection. Keep ordinary review/CI requirements. Keep `KIRARI_ALLOW_INDEXING_SUBMISSIONS` unset/false; P7 is not implemented.
3. Authorize the PR merge together with the expected automatic Vercel Production build and domain assignment. Removing `main:false` makes the merge eligible to publish; current Git/main/auto-assignment settings indicate native deployment is expected. No manual deployment is needed. A provider skip/ignore or integration failure must be investigated, never reported as deployed from green CI alone.
4. After the authorized merge, record its actual main SHA and post-merge CI. Read the new deployment from the exact team/project: native Git source, Production target, main branch, exact merged commit, READY state and canonical domain assignment. A Preview or older READY deployment does not satisfy this step.
5. Run the documented live browser smoke against the canonical domain using matching local output and the intended robots/indexability policy. Check routes/assets/navigation/canonical/robots/security behavior. Browser success does not independently bind provider identity; pair it with step 4. No claim that a provider rebuild equals earlier CI bytes is made.
6. Update #99/#129–132 and Project only for actual revised acceptance evidence. P4 remains incomplete until native Production identity/domain/browser checks pass. Independently schedule verified unused secret/variable cleanup; do not reuse old C1 approval comments or create approval manifests.

## Recovery if the authorized cutover fails

Use Vercel's native deployment history and available rollback/redeployment controls. First inspect the actual current/previous Production deployment and domain assignment. On Hobby, Instant Rollback is limited to the immediately previous Production deployment; do not promise arbitrary old artifact rollback. Rolling back disables automatic domain assignment until Undo Rollback or promotion restores it. Document that effect, recheck the canonical domain and run browser smoke after recovery. A source revert is a new Git deployment and may not undo external setting changes. No recovery operation was rehearsed on Production during this correction.

See [Vercel Instant Rollback](https://vercel.com/docs/instant-rollback) and [native Git deployment](https://vercel.com/docs/git). Use provider controls under the Owner cutover/recovery decision; do not resurrect an Actions stage/promote pipeline.

## Remaining legitimate limits

- Production cutover and live smoke are pending; #131 stays blocked for that reason.
- Current ignored-build behavior requires dashboard confirmation. main presently lacks enforced protection.
- Native provider builds preserve source traceability, not earlier CI artifact byte identity.
- Local browser fixtures validate locked local icon data and report external-service transport as NOT_CHECKED. Live smoke still uses real networking.
- Existing dependency advisories remain visible and separately tracked by #122; this correction does not upgrade dependencies or suppress audit findings.
- Old deployment secrets may still serve baseline main until cutover. No credential was revoked, rotated or exported, and no Vercel configuration was changed.
