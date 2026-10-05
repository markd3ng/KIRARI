# C1 Owner setup and evidence request

`C1_CONCRETE_CREDENTIAL_MANIFEST=INCOMPLETE_OWNER_SETUP_REQUIRED`.
No concrete principal, team plan, effective role/group grants, PAT scope or
expiry was observed for this task. The JSON beside this file is an incomplete
schema template, not a credential manifest or approval. No token value is
requested, copied, printed, or stored here.

The framework approval authorizes contract implementation only. It does not
authorize this agent to create a token, GitHub Environment, secret, or provider
setting. An Owner must make any required setup decision separately. If a
credential is later created under that separate authorization, create the
sanitized concrete manifest first, calculate its canonical digest with
`credentialManifestDigest`, then obtain a separate digest-bound Owner decision
on Issue #129 before any protected credential use.

## Vercel principal, grants, and token metadata

1. Confirm the actual Vercel team plan and select the actual principal whose
   direct and effective team role is **Developer**. A Team Owner or Member does
   not satisfy C1. Do not assume the signed-in Owner is the token principal;
   bind the token row in the selected personal Account Tokens context to an
   authenticated Vercel user identity and record that stable principal ID. If
   the account context cannot be tied unambiguously to that principal, stop.
   If the selected principal's effective role is Owner, Member, or anything
   other than Developer, stop.
2. In the target team, inspect the member's direct/effective role and all
   project-level assignments. Inspect every Access Group membership, including
   Directory Sync-derived membership and the group's mapping for `kirari-main`.
   Record a complete sanitized list. Team Developer is documented as
   equivalent to Project Developer; any direct Project Admin or any
   group-derived Admin for this project fails C1. Missing group evidence is
   UNKNOWN and fails closed.
3. Read the complete effective extended-permission list. It must contain only
   `Full Production Deployment`. Owner/Member inheritance, any additional
   permission, or incomplete evidence fails C1.
4. From the principal's personal Account Tokens page, when credential creation
   is separately authorized, select the one project `kirari-main` under team
   `team_NsBZHGUVnyygP7veiROKLuUx`; do not choose All Projects, Team, or Full
   Account. Use a finite expiry and a label that identifies this use (the
   template suggests `kirari-p4-production-c1`). Record only the label,
   expiry, selected principal identity, and exact project/team scope. Record
   the creation time when the provider safely exposes it; otherwise enter
   `NOT_EXPOSED` and identify the metadata source that omitted it. Do not infer
   a creation time. The expiry must always be finite and verified. The token
   value appears only once: store it directly in the
   Owner-managed secret store and never paste it into a chat, terminal output,
   issue, artifact, or repository file. Secret creation is separately
   unauthorized here.
5. Record every documented same-project capability in the template. The
   Full Production Deployment grant includes CLI Production deploy, rollback,
   and promotion of any accessible deployment in this project, not only the
   approved artifact. This is an explicit same-project capability disclosure.
   Exact endpoint-level rights and the provider's role-by-project-token
   intersection remain UNKNOWN/inference; do not claim exact endpoint denial.
6. Fill the template from authenticated readbacks, with UTC timestamps and
   sanitized source descriptions. The principal, account, plan, direct/effective
   roles, all groups and their target-project mappings, every effective
   extended permission, exact one-project scope, explicit creation-time
   metadata state, and expiry are required. Do not retain raw provider
   responses or a credential value.
   Revoke the named token from the personal Account Tokens page and verify its
   metadata row if it is exposed or setup is abandoned.
7. At every protected use, obtain fresh authenticated sanitized metadata for
   the actual token principal, plan, roles, groups, extended grants, scope, and
   expiry; the readback must exactly match the approved manifest. Any role,
   group, plan, scope, expiry, or grant change invalidates approval. The
   verifier requires a readback no older than five minutes.

The separate Issue #129 decision must be a new authenticated comment by
`markd3ng` whose entire body is exactly the JSON object below. Replace the
digest with the canonical digest of the complete C1 manifest and set a finite
UTC expiry no later than the PAT expiry. Do not use the existing policy
framework approval comment as concrete-manifest approval.

```json
{
  "schema_version": 1,
  "kind": "C1_CONCRETE_CREDENTIAL_MANIFEST",
  "decision": "APPROVED",
  "manifest_sha256": "sha256:<64 lowercase hex characters>",
  "expires_at": "<YYYY-MM-DDTHH:MM:SSZ>"
}
```

The read-only decision reader verifies the actual GitHub comment, repository,
issue, author, Owner association, exact JSON body, digest, and expiry. A local
`approved: true` field, proposal text, or approval for another digest does not
pass. The detached decision approves only the concrete credential manifest; it
is not Production operation authorization.

## GitHub Production Environment

After separate Owner authorization to configure repository settings, open
GitHub markd3ng/KIRARI → Settings → Environments → New environment, enter
`kirari-site-production`, then Configure environment. Enable Required reviewers,
select only the User `markd3ng`, disable Allow administrators to bypass protection
rules, leave Prevent self-review disabled, and save. Under Deployment branches
and tags select Selected branches and tags and add only a Branch named `main`
(no tag policy). Under Environment variables add the two IDs below; under
Environment secrets add the token directly through the secure UI after separately
authorized credential setup. Never paste its value into chat or a command.
The resulting Environment must have exactly one required reviewer: `markd3ng`, type
`User`. Set `can_admins_bypass=false`, `prevent_self_review=false`, and a custom
deployment branch policy allowing only `main`. Add exactly these non-secret
Environment variables:

```ini
VERCEL_PRODUCTION_ORG_ID=team_NsBZHGUVnyygP7veiROKLuUx
VERCEL_PRODUCTION_PROJECT_ID=prj_QNMVdxTkPOad4ynN4fwFCYEST8Jk
```

The only Production secret name is `VERCEL_PRODUCTION_TOKEN`. This task did not
create the Environment or secret. After authorized setup, use metadata-only
readbacks; the commands below never request the secret value:

```sh
gh api repos/markd3ng/KIRARI/environments/kirari-site-production \
  --jq '{name,protection_rules,can_admins_bypass,deployment_branch_policy}'
gh api repos/markd3ng/KIRARI/environments/kirari-site-production/deployment-branch-policies \
  --jq '[.branch_policies[] | {name,type}]'
gh api repos/markd3ng/KIRARI/environments/kirari-site-production/secrets \
  --jq '[.secrets[] | {name,created_at,updated_at}]'
gh api repos/markd3ng/KIRARI/environments/kirari-site-production/variables \
  --jq '[.variables[] | {name,created_at,updated_at}]'
gh api repos/markd3ng/KIRARI/environments/kirari-site-production/variables/VERCEL_PRODUCTION_ORG_ID \
  --jq 'if .value == "team_NsBZHGUVnyygP7veiROKLuUx" then "org_id=MATCH" else "org_id=MISMATCH" end'
gh api repos/markd3ng/KIRARI/environments/kirari-site-production/variables/VERCEL_PRODUCTION_PROJECT_ID \
  --jq 'if .value == "prj_QNMVdxTkPOad4ynN4fwFCYEST8Jk" then "project_id=MATCH" else "project_id=MISMATCH" end'
```

Verify the reviewer is exactly the `markd3ng` User, self-review remains
explicitly allowed, administrator bypass is false, the branch set is only
`main`, the variable-name listing contains exactly the two required names, and
the secret listing contains the required name without reading its value.
Missing or unreadable fields remain UNKNOWN.

## Vercel Trusted Sources

Required source claims remain issuer
`https://token.actions.githubusercontent.com`, audience
`https://github.com/markd3ng`, repository `markd3ng/KIRARI`, ref
`refs/heads/main`, workflow ref
`markd3ng/KIRARI/.github/workflows/site-production.yml@refs/heads/main`, and
Production only. No unrelated provider, repository, or Vercel project caller
is allowed. Trusted Sources readiness requires authenticated raw provider
readback in memory plus authoritative documentation for the provider's stored
semantics. In particular, no value for
`enableVercelCiSameRepository` is an Owner instruction: its semantics must be
verified before interpreting it. If raw readback or authoritative semantics is
unavailable, record `TRUSTED_SOURCES_VERIFIED=NO` and keep readiness blocked.

Do not retain the raw provider response. The current task has not verified
Trusted Sources and has not changed Vercel settings.

## Official Vercel references

- [Access tokens](https://vercel.com/docs/accounts/access-tokens): a Project
  token is limited to one project and denies other-project, user-level, and
  team-level resource requests; token creation requires choosing an expiry.
- [Access roles](https://vercel.com/docs/rbac/access-roles): Team Developer is
  available on Pro and Enterprise, cannot be assigned project-level roles, and
  manages project deployments/domains and non-production settings.
- [Extended permissions](https://vercel.com/docs/rbac/access-roles/extended-permissions):
  Full Production Deployment enables CLI Production deploy, rollback, and
  promotion of any deployment; other effective grants must be absent.
- [Access Groups](https://vercel.com/docs/rbac/access-groups): an Enterprise
  Developer can be elevated to project Admin by an Access Group; every group
  membership and project mapping must be checked.
- [Project-level roles](https://vercel.com/docs/rbac/access-roles/project-level-roles):
  Team Developer is equivalent to Project Developer; project-level Admin is a
  broader project role.

## Evidence ingestion into the reviewed workflow

The completed manifest path is `c1-concrete-credential-manifest.json`; its status
becomes CONCRETE only after all metadata is verified. The current template remains
INCOMPLETE_OWNER_SETUP_REQUIRED and fails validation. The separate decision
reference file is `c1-owner-decision-reference.json`, with issue_number 129 and
the new concrete comment ID. Before use, obtain fresh sanitized evidence from an authenticated provider
reader with `observed_at`, all seven `sources` keys, and exact `claims` matching
the approved manifest. A tracked JSON file claiming `authenticated:true` cannot
prove current provider roles or scope and is never trusted by the admission
wrapper. No complete authenticated provider reader exists in this execution;
admission defaults to unavailable and FAIL. After Owner setup supplies the
required sanitized evidence, independently review its supported authenticated
ingestion boundary before any credential use. The five-minute freshness limit
prevents stale metadata from granting readiness. Missing actual readback stays
UNKNOWN. No write-denial tests or token values are requested.

The concrete decision reader scans every issue-comment page without a timestamp filter. An edited decision or any
later or subsequently edited Owner comment on the same Issue invalidates that
decision and requires re-review; this includes prose revocation and avoids
interpreting it as inherited acceptance. Current readback failure also blocks.

