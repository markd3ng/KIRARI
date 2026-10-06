# Separate concrete T1/C1 Owner decisions

The T1/C1 policy frameworks are approved. Concrete version, advisory, credential,
setup, merge, and Production decisions remain separate. This package requests
no token value and authorizes no Production action.

## T1 — exact Vercel CLI candidate

Review `t1-concrete-tooling-manifest.json`, the complete
`t1-concrete-tooling-advisory-inventory.md`, retained raw audit, and independent
security assessment together. Candidate is Vercel CLI 62.2.0, Node v22.12.0,
npm 10.9.0, Linux/x64, Ubuntu image 20260927.320.1 / 24.04.5 LTS. Exact lock,
tarball integrity, npm tree, installed CLI tree, command path, target and all
20 material source hashes are bound in the manifest.

The complete raw audit remains FAIL: 8 moderate, 24 high, 1 critical,
33 vulnerable-package entries, 38 structured advisory objects and 107 total
advisory/inherited references. The counts describe npm's package-level
inventory, not unique CVEs. Two newly published advisory references were added
since the initial capture and received fresh independent review.

Root package registry signatures verified identity/integrity. Whole-tree
signature verification is inconclusive, publisher source/build provenance and
SBOM are absent, and bundled code can contain vulnerabilities outside the npm
lock audit. All unproved install/startup/import/config/network/archive/fallback
paths remain UNKNOWN/exposed. Absolute Node/npm launch, source/tree hashes,
clean CLI install environment and shell preload clearing reduce risks; they do
not create an OS sandbox. Earlier same-job installs can modify the workspace
or persist a process. Non-Node helper resolution through inherited operation
PATH and Node/npm advisory coverage remain UNKNOWN/exposed.

Under the proposed C1 model, compromise can exercise additional same-project
capabilities, including domains, Development/Preview settings, other accessible
deployments, promotion and rollback. The credential is not constrained to this
one approved artifact by endpoint-level permissions.

Proposed expiry is **2026-10-07T15:31:37Z** (2026-10-07 23:31:37 Asia/Shanghai).
The original 48-hour window starts at candidate selection; resume and review
updates do not extend it. An Owner decision may select an earlier expiry.
Expiry, new/changed advisories, version/support/lock/integrity/runtime/runner/tree/
install/command/source/target/review/role changes, new reachability evidence, or
revocation immediately require re-review and a new exact decision. A new
comment or an edited Owner decision cannot silently inherit old acceptance.

Canonical concrete manifest digest: **sha256:88cb0906b13f7d1f2ff1c00a326d7a811657cb0db6c4dc6f817ed2c2a876c8b0**.

If the Owner elects to accept this exact T1 candidate and exposed inventory,
post a new Issue #130 comment whose entire body is this JSON. It must be posted
by `markd3ng`; do not edit an existing comment. This is a proposed decision body,
not an approval issued by the agent:

```json
{
  "schema_version": 1,
  "kind": "T1_CONCRETE_TOOLING_MANIFEST",
  "decision": "APPROVED",
  "manifest_sha256": "sha256:88cb0906b13f7d1f2ff1c00a326d7a811657cb0db6c4dc6f817ed2c2a876c8b0",
  "expires_at": "2026-10-07T15:31:37Z"
}
```

Rejecting or deferring the candidate leaves acceptance FAIL. No concrete
approval has been posted or consumed. This approval alone cannot authorize
merge, waive the root dependency audit, approve a credential or authorize
Production. Any later source change needed for C1 evidence ingestion also
invalidates this exact T1 material-source binding.

## C1 — setup evidence is still missing

`C1_CONCRETE_CREDENTIAL_MANIFEST=INCOMPLETE_OWNER_SETUP_REQUIRED`.
The incomplete JSON template intentionally contains null actual identity,
plan, grant, scope and expiry fields; its Owner marker stays PENDING. It cannot
pass even if someone approves its digest. Review `owner-setup.md` for the exact
secure setup and metadata-only readback procedure. Setup itself needs separate
Owner authorization; this agent has not created any token, Environment, secret
or provider setting.

After separately authorized Owner setup, supply only authenticated sanitized
metadata: principal and personal-account identity, team/plan, direct/effective
Developer and project role, every direct/Directory Sync Access Group and its
project mapping, complete extended-permission set containing only Full
Production Deployment, PAT scope exactly this project, safely exposed creation
metadata or explicit NOT_EXPOSED, finite expiry, revocation procedure, and
source/timestamp evidence for all seven categories. Unknown or elevated roles,
additional grants, team/full-account or multiple-project scope fail closed.
Never supply a token value. The fixed target is `kirari-main`, project
`prj_QNMVdxTkPOad4ynN4fwFCYEST8Jk`, team
`team_NsBZHGUVnyygP7veiROKLuUx`.

Then finalize the complete sanitized C1 manifest and obtain its separate
canonical-digest-bound Issue #129 Owner decision. The current workflow has no
complete authenticated provider observation reader and defaults to FAIL;
supported authenticated ingestion needs independent review before any use.
Tracked JSON claims cannot establish current provider identity/grants/scope.

## Readiness and independent blockers

The dedicated protected Environment is absent on authenticated GitHub GET.
Its exact UI/API setup procedure is in `owner-setup.md`; no setup was performed.
Trusted Sources and provider Git settings are omitted from the connected
provider projection. API readability and verification remain NO, matching
UNKNOWN. No undocumented boolean is an Owner instruction. The main source
Git deployment guard remains exactly `git.deploymentEnabled.main=false`.

The refreshed root dependency audit also fails on newly published qualifying
advisories. Its complete report is `root-audit.json`; only the existing #122
exception remains, with no new suppression. This independent blocker is not
covered by the T1 CLI version decision. Source/build/P4/P3/browser checks passed;
exact final-head CI and fresh code review are recorded in the GitHub #99/#129/
#130/PR #133 control plane. PR #133 remains open and unmerged, #99 Blocked,
#129 In Review and #130 Blocked; #131/#132 remain Done for their limited
engineering acceptance. Project scope stays unchanged.

Stop here. `PRODUCTION_OWNER_GATE=NOT_READY`, `PRODUCTION_AUTHORIZATION=NO`.
No Production deployment, promotion, rollback, alias, settings, secrets, DNS,
indexing, release/tag, P5 or Gateway action is authorized by this package.
