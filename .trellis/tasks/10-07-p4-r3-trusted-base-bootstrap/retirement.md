# Owner decision: retire R3 admission and resume P4 — 2026-10-10

The Owner explicitly cancelled the custom R3 Trust Root, GitHub App publisher,
exception-consumption and Atomic Final Admission architecture. This supersedes
all pending R3 activation requirements and the earlier setup checklist. No App
custody, lab harness, exception decision or atomic-admission gate is required to
complete this cleanup or assess P4.

Dependency vulnerability remediation follows compatible upstream patches.
`pnpm audit --audit-level moderate` remains a non-blocking informational CI job;
its raw text, the complete standard `pnpm audit --json` inventory, errors and
exit statuses are retained. The #122 advisory is no longer suppressed in
`package.json`. Supported source-map-js 1.2.2 and smol-toml 1.9.0 fixes remain.
No new dependency upgrade or custom security mechanism is introduced.

Build, test, typecheck, QA, release checks, artifact provenance, credential
isolation, P3 staging/OIDC and the Vercel main deployment guard remain strict.
Production deployment requires separate authorization. This cleanup does not
perform a deployment or change production settings, credentials or protection.

## Engineering scope

- Delete the three R3 workflows, all 51 `scripts/root-audit` files and the four
  obsolete repository contracts. Remove their CI suite/matrix/isolation steps
  and active guide references.
- Keep historical Trellis evidence and merged PRs #136–#138 as history. The
  removed source is recoverable from baseline main
  `a93c3ebab9399fea532337895f20bd76e9877616` and its parent commits.
- Update current dependency-audit documentation and the existing workflow
  contract test; do not rewrite staging, production or unrelated source.
- Reconcile #135 as superseded/closed and Project Done; retain #122 as upstream
  tracking. Return #99 to P4 engineering assessment, without production authority.

## PR #133 renewed assessment

Current head: `ef5ecc412e165ebd7f3c6f38f111c7bdcb8cfda8`.
Current main: `a93c3ebab9399fea532337895f20bd76e9877616`.
The PR remains open and has not been deployed or merged. Read-only merge-tree
analysis finds conflicts in `.github/workflows/ci.yml` and the old root-audit
README/CLI/evaluator. Its branch also retains a root-audit job, policy and three
old evaluator/source/prepare suites; the next P4 source refresh must remove
those consumers instead of restoring the cancelled platform. Preserve its
original immutable artifact/provenance, separate production authorization,
credential boundaries, validation and rollback objectives.

Latest existing CI run: 37443504704. Verify and browser fixtures passed;
root-audit and production-fixtures failed. The retired root-audit result is no
longer an approval requirement. Production-fixtures reports `EXECUTION_MISMATCH`
and `CONCRETE_OWNER_APPROVAL_MISSING_EXPIRED_OR_MISMATCHED` in its legacy T1
tooling gate. Renewed P4 assessment must reconcile that guard with the simplified
dependency-audit direction while retaining actual credential/deployment safeguards.
This cleanup does not authorize Production.

## Resource cleanup checklist — approval required before deletion

The retirement branch has no App/PAT/lab consumers. Repository metadata shows
no R3 variable, secret or publisher Environment; production publishing was never
enabled. Verify the cleanup is merged, PR #133 cannot restore retired consumers,
and no old workflow run or external local process is using these resources before
executing this checklist. No Owner resource has been deleted by this cleanup.

1. Uninstall and delete **KIRARI R3 Trusted Publisher** (App 5258825,
   installation 169862234); **KIRARI Lab Expected f214b2dc** (5260361,
   installation 169862107); **KIRARI Lab Wrong f214b2dc** (5260368,
   installation 169861959). Confirm the selected repository scopes before each
   operation so unrelated Apps are untouched.
2. Revoke all keys for those three Apps, including the production key previously
   shown in GitHub with unavailable local material. Remove their protected local
   PEM copies/downloads only after server-side retirement. No key value is needed
   in chat, logs or evidence.
3. Revoke the lab-only fine-grained PAT if the Owner created one; remove its local
   token file. Do not revoke the normal `gh` login or unrelated credentials.
4. Delete only `markd3ng/kirari-r3-disposable-lab-20261010-f214b2dc`
   (repository ID 1412716615) after confirming it is still the disposable lab.
   Remove obsolete nonsecret setup configs under the private local setup directory
   when they are no longer needed; preserve the historical Trellis record.
