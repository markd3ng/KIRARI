# Progress reconciliation — 2026-10-16

Authority: fresh GitHub Project #1, Issues and PRs; branch-scoped Trellis records.

- Current main: d7b72b0360f9b1c312fc1fa476a78ad62454c374 (PR #146 merge).
- P0–P4 accepted; #99 and #129–#132 closed / Done.
- P5 complete: #102, #103, #104, #105, #109 (5/8).
- #110: OPEN / In Review, PR #147 c0a6b251e2aad977829b84e2ec7adcaedadb60b2, CI/OCR passed, all nine review threads resolved, READY_FOR_OWNER_MERGE. Not Todo/unstarted. No Cloudflare deployment.
- #111: OPEN / In Review, PR #148, current engineering/review continuation. Keep open until accepted/merged. Live Runtime Cache/CDN behavior is unverified.
- #112: OPEN / Todo, not started. No authorization to implement it inherited from this reconciliation.
- P6 #101 / P7 #100: Future Roadmap / Todo; P8 #106/#107: Backlog / Todo.
- #122 stays open as informational upstream tracking; it is not a P5 completion slot.

## Corrected tracking drift

Project has 33 items. Status corrections: #102 In Review → Done; #110 Todo → In Review; #111 Todo → In Review. Other Status/Phase/Priority/Roadmap Status fields are preserved. Project's outdated current P4 checkpoint is historical. PR #147's stale body was updated to the already-recorded final review status and #111 progress.

Archived Trellis tasks: 10-03-p2-site-inputs-readonly-ci, 10-04-p4-authorized-production (retired, not acceptance of the old controller), 10-07-p4-r3-trusted-base-bootstrap, 10-15-p5-first-batch, 10-16-p5-portable-gateway-core. Historical evidence remains intact. #111 remains active here; #110 remains active on its own PR branch. Archives do not modify old dirty worktrees or imply changes have already merged to main. The retired custom-P4 context manifests still cite the removed site-staging workflow as historical evidence; they are not active task manifests or requirements and must not be revived.

## Review inputs for PR #148

1. OCR Node.js export complaint: false positive. Official Node.js docs explicitly support the default fetch object in api/*.ts: https://vercel.com/docs/functions/runtimes/node-js and https://vercel.com/docs/functions/functions-api-reference .
2. OCR repeat-generation complaint: false positive as stated; cleanup precedes generation. Repeat-run regression passes before the fix. Related confirmed defect: mixed generated/owner route directories lose owner files in the original code (regression ENOENT); fix deletes only marker-owned regular files, preserves symlinks without traversal, and prunes empty directories.
3. OCR silent-catch complaint: reasonable hardening; fixed with static event/category logging and a regression preventing raw error or credential output.
4. Same-scope confirmed defect: public /_kirari/edge/healthz received CDN caching while the internal function health path did not. Regression fails before fix; both GET/HEAD paths now remain uncached.

5. Independent review reproduced symlinked api/functions roots deleting outside marker files and exact generated targets writing through symlinks. Both fail closed after component-wise lstat checks; tests cover Site/deploy roots and both providers.
6. Independent review confirmed missing Preview Git ref used preview:preview scope. Missing/empty/whitespace ref now omits the persistent port, giving Core CACHE_NONE without any Runtime Cache access; regression fails before and passes after.
7. CI verify previously did not invoke Vercel adapter-specific checks. Both type-check and tests are now mandatory verify steps.

8. Follow-up 2026-10-17 (Asia/Shanghai): official Vercel Functions limits document Hobby team-shared Runtime Cache. Keys now include provider project ID in an unambiguous JSON scope tuple; absent project ID bypasses storage. Cross-project and missing-project regressions fail before and pass after. Namespacing is not an ACL against a malicious same-team cache writer; provider trust boundary is documented. Source: https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#limits-and-usage .

No C1/Trusted Sources/admission controller is restored. No live Production setting, credential or platform runtime has been mutated. Merge authorization remains separate for the open adapter PRs.
