# Approved immutable Site production

RM-05 / [Issue #99](https://github.com/markd3ng/KIRARI/issues/99) owns this path.
The build, Preview staging, and Production approval are separate operations.
Merging a PR does not deploy Production: generated `vercel.json` retains
`git.deploymentEnabled.main = false`.

## Release inputs

Select a retained Site package from a successful owner-dispatched main CI run.
Record the exact run ID, attempt, source SHA, package artifact ID and archive
SHA-256, upstream composition artifact ID/digest, Core SHA and Site SHA.
The production workflow rechecks GitHub metadata, downloads both archives,
verifies their digests, safely extracts them, and recomputes package and
composition provenance. The source main SHA may precede the production
workflow's reviewed main SHA; it must be a verified ancestor.

The P3 package's embedded Preview target describes how it was packaged. It is
preserved byte for byte. Production authorization independently binds the
actual Vercel team, project, exact configured Production domain set, canonical origin,
current deployment and operation. Changing those values requires a new
approval. Production does not rerun Astro, postbuild, indexing or Site code.

Before requesting authorization, read the current project, production domains
and deployment. The immutable HTML canonicals and robots sitemap must match
the selected production canonical origin. A package using `https://example.com`
cannot be released to a different canonical origin. Select a newly reviewed
CI artifact with the correct Site settings; never edit the downloaded package.

Only the authoritative, paginated Project Domains endpoint supplies the configured
Production domains. Explicit Preview/custom-environment records are excluded;
unexpected configured Production domains, duplicate records, project substitution
and redirects reject the operation. The canonical origin must remain in that exact set.

Vercel's [generated URLs](https://vercel.com/docs/deployments/generated-urls)
are separate from configured domains. The project/team Production URL and the
main branch URL are constructed from the digest-approved C1 project/team slug,
not guessed from aliases or accepted by a broad `.vercel.app` suffix. Their
project identity, optional team identity, lack of redirects and expected
current/new Production deployment binding are checked before writes and after
promotion/rollback. They never enter `target.domains`, canonical indexing policy
or the configured-domain release record. Do not delete them to satisfy an
authorization comparison. Other branch URLs in the same provider namespace
remain Preview observations only; custom hosts, lookalikes, foreign namespaces
and foreign branch aliases on the Production deployment reject validation.
Unsupported provider URL truncation fails closed rather than guessing ownership.

## Authorization boundary

`.github/workflows/site-production.yml` accepts only a manual dispatch from
current reviewed main by the repository owner and the same triggering actor.
It rejects reruns. A short-lived proposal binds the exact inputs to a fresh
nonce and exact target-specific approval phrase. Workflow concurrency
serializes operations. A retained immutable authorization claim consumes the
proposal before Production credentials become available, including when the
later operation fails. A consumed or expired proposal requires fresh approval.

The dedicated GitHub Environment is `kirari-site-production`. The workflow
requires a server-verified required-reviewer rule with exactly one reviewer:
the repository owner as a `User`. Teams, additional users, and another sole
reviewer are rejected because GitHub accepts any one listed reviewer. The
environment must explicitly report `can_admins_bypass: false`; missing or true
is rejected. The reviewer rule must explicitly report `prevent_self_review: false`
so that the sole authorized owner dispatcher can approve the protected job.
Its deployment policy must allow only the `main` branch, and a
policy reported as a tag is rejected. The C1 Hobby contract uses an expiring personal access token scoped to exactly
project `prj_QNMVdxTkPOad4ynN4fwFCYEST8Jk` in team
`team_NsBZHGUVnyygP7veiROKLuUx`. It does not require unavailable paid-plan
Developer roles, Access Groups or extended permissions. The schema2 manifest
uses model `C1_HOBBY_PROJECT_SCOPED_PAT`; previous C1 manifests and decisions
cannot approve it.

An authenticated Owner setup read supplies the principal, Hobby team identity,
token ID/name/creation/finite expiry and exact project-scope selection. The token
API exposes lifecycle metadata but its published response schema omits project
scope, so scope selection uses the authenticated Account Tokens UI. Do not infer
project scope from a team scope entry or a403. Bind the exact secret by its
SHA256 fingerprint, retain no value/prefix/suffix, and obtain a new finite,
digest-bound Owner comment on Issue129. The signed setup manifest is distinct
from fresh runtime proof; static authentication flags are not provider reads.

The scoped PAT runtime reader calls only unfiltered `GET /v10/projects` and
`GET /v9/projects/<exact-id>` without team/search/project filters. Complete
bounded pagination must expose exactly kirari-main in the approved team, and
its fresh readback/fingerprint must match the approved credential. Provider
failures, incomplete or malformed data, stale proof, changed secret, expired
lifetime or edited/revoked Owner decision fail closed. Scoped PATs cannot read
user/team/token resources; do not require those setup endpoints at runtime.

A project-scoped PAT has broader same-project rights, potentially including
settings, Production/Preview variables and domains as well as deploy/promote/
rollback of other artifacts. It is not an endpoint least-privilege credential,
and the workflow does not sandbox a compromised token-bearing process. The
manifest and new Owner decision must disclose/accept these limits. Provider
project scoping, exact credential binding and runtime visibility checks confine
the cross-project boundary; independent artifact/target authorization confines
the reviewed workflow's writes.

Configure the dedicated
`VERCEL_PRODUCTION_TOKEN` environment secret and environment variables
`VERCEL_PRODUCTION_ORG_ID` / `VERCEL_PRODUCTION_PROJECT_ID` there. The production
workflow does not reference Preview's `VERCEL_TOKEN` secret. Keep the production
secret absent from repository, organization and other environment scopes;
ordinary CI, PRs, config builds and Preview staging must not receive it.
Before issuing a live approval, the owner must verify secret metadata in each
scope without reading or recording the value. GitHub's workflow token cannot
attest secret scope; Environment protection alone does not prove credential
isolation. Unverified scope makes engineering readiness INCOMPLETE.
Provisioning or changing production secrets/settings requires
separate owner authorization. Missing or unverified protection and credentials
fail closed.

Protected deployment validation uses a fresh GitHub OIDC token. Vercel Trusted
Sources must match the exact repository, main ref, production workflow ref and
Production target. Keep Any workflow disabled. The token is attached only to
the exact approved HTTPS deployment origin and is never recorded in evidence
or forwarded to external origins. Public production domains are validated
without giving external services deployment credentials.

The authenticated raw project readback must explicitly report
`enableVercelCiSameRepository: false`, one GitHub OIDC rule with exact audience,
repository, main ref, Production workflow ref and Production destination, and no
additional project rules. The current [Vercel SDK schema](https://github.com/vercel/sdk/blob/main/docs/models/getprojecttrustedsources.md)
uses an `oidcProviders` issuer-to-rule-array map and optional `projects`.
An omitted `projects` within that present current policy means no additional
stored project rules; legacy external-source containers still require explicit
empty project rules. The normalizer rejects shadowed/ambiguous containers,
extra providers (including empty rules), issuer overrides, unknown policy fields,
broad destination presets and missing CI trust controls. Absent CI trust defaults
to enabled at the provider and does not qualify. Added project/customized
self-access rules fail closed. The current SDK documents the same-repository
CI control and its enabled default. A literal repository value is not
authenticated provider proof or authorization to change the actual setting.

A missing/null whole Trusted Sources field means **unavailable readback**, not
proof that the policy is absent. Keep project-scoped PAT reads, Owner/control-plane
raw REST/dashboard reads and MCP summaries distinct: the MCP project response
may omit the policy and combine configured domains with generated aliases.
The C1 identity reader also deliberately projects project identity; its PASS
does not attest raw Trusted Sources field visibility. Do not broaden the PAT.

Runtime re-reads the complete raw project policy before each write. Neither a
saved snapshot/`authenticated` flag nor `updatedAt`/ETag substitutes for that read;
no verified provider revision semantics or snapshot fallback is implemented.
The existing 15-minute exact authorization/replay checks remain unchanged.
If fresh Owner and scoped-PAT reads cannot expose the required policy, remain
blocked and obtain separately authorized exact Owner setup/readback. See
the [current remediation evidence](../.trellis/tasks/10-04-p4-authorized-production/evidence/target-trust-20261013/README.md).
Authenticated actual readback and authoritative semantic interpretation both
remain required. Preserve documented implicit same-project access.
Do not infer the stored rules from a connector projection that omits them.
If the server serializes default self-access as configured rules, retain the
authenticated readback for review before extending the validator; do not
guess an accepted rule shape or bypass the check.

## Upload, validation and promotion

The selected Build Output API v3 files are uploaded as staged Production using
the pinned Vercel CLI's documented `--prebuilt --prod --skip-domain` behavior.
This creates a Production deployment without reassigning production domains.
Validate READY state, team/project identity, deployment host, exact output
bytes, routes, assets, navigation, real HTTP 404, browser errors and the approved
network policy before promotion. Production indexing checks require the
approved canonical/robots policy; Preview's required `noindex` is not reused
as a Production success condition.

CI and the production workflow retain standard deployment-tool audits as
informational reports: `npm audit --prefix scripts/p4-production/tooling
--audit-level moderate` and full `npm audit --prefix scripts/p4-production/tooling
--json`, including raw output, service errors and actual exit statuses. An upstream
advisory does not require a T1 exception or determine engineering CI success.
The Owner retired the T1 dependency approval engine and R3 Trust Root/App/final
admission requirements on 2026-10-10. No advisories are suppressed.

Locked CLI installation, the actual Node/npm/CLI identity, unchanged installed
bytes and reviewed source, isolated temporary HOME, disabled native fallback
and credential-free installation remain strict. CI runs local Production Chromium
before the CLI install and identity check. Findings cannot skip the browser proof.

The separate C1 boundary remains: the protected C1 read step maps the isolated
Production token only after credential-free tooling installation and prepared
exact Owner authorization. It performs authenticated project scope/identity
readback and emits only safe IDs, time, fingerprint and manifest digest. No
Production operation starts without a PASS; the operation and each write
recheck C1. Actual setup metadata, a concrete manifest and new detached Owner
decision remain pending, so engineering mocks are not live credential readiness.
See [Hobby setup and capability evidence](../.trellis/tasks/10-04-p4-authorized-production/evidence/c1-hobby-20261012/owner-setup.md).
Explicit artifact/target/operation authorization, protected Environment and exact
Trusted Sources readback remain required before any Production operation.

The documented existing-deployment promotion API assigns production traffic
without rebuilding. Re-read the expected current production state immediately
before this write, then verify every affected domain points at the exact READY
deployment and validate Production again. A health failure cannot produce a
successful release record. No IndexNow or Google Indexing API notification is
part of P4.

The bounded `kirari-p4-production-<run>-<attempt>` evidence artifact contains
`production-record.json`, browser/output validation and exact provenance.
It also retains the exact downloaded ZIPs at `retained/site-package.zip` and
`retained/composition.zip` for 90 days. Their original archive digests remain
bound in the release record. Retention is finite: an expired release evidence
artifact is ineligible for rollback through this workflow.
Records include source/package/composition identities, Core/Site SHAs, byte and
normalized output digests, target/deployment/domains, workflow SHA/run, actor
and time. Evidence excludes tokens, raw API responses, arbitrary console logs
and secret-bearing request URLs.

## Rollback

"Last approved" means a prior successful owner-authorized main Production
workflow with a retained immutable evidence artifact. A candidate is bound by
its producer run/attempt/workflow SHA, artifact ID/archive digest, release
record digest and deployment ID. Verify the downloaded evidence archive and
the exact `production-record.json` member, then recheck package/Core/Site/output
provenance and the live READY Production deployment. A legacy Git deployment
or Vercel rollback flag alone is not sufficient approval evidence.
The retained release archive supplies package bytes after the original CI
artifact expires; the source run/attempt and reviewed main ancestry are still
rechecked. A new deployment always requires unexpired original CI artifacts.

Rollback restores the existing approved immutable deployment and verifies
domain assignment and Production health. It does not rebuild a moving branch.
The same approval binds a known previous record when permitting automatic
recovery after a failed promotion. Without a proven previous record, a first
release must report that limitation; it cannot relabel a legacy deployment as
approved. Failed post-rollback verification remains FAILED/INCOMPLETE.

Local simulations use injected API adapters and make no production requests.
Report simulation and live execution separately. Issue #99 accepts a reviewed
simulation record, while Phase completion still requires explicitly authorized
Production provenance/health evidence and an independent Phase Exit Audit.

## Documented platform semantics

- [Prebuilt deployment and skip-domain flags](https://vercel.com/docs/cli/deploy)
- [Staged Production from the CLI](https://vercel.com/docs/cli/deploying-from-cli)
- [Production promotion behavior](https://vercel.com/docs/deployments/promoting-a-deployment)
- [Point production traffic to an existing deployment](https://vercel.com/docs/rest-api/projects/point-production-traffic-to-a-given-deployment)
- [Instant rollback eligibility](https://vercel.com/docs/instant-rollback)

Promoting a Preview via some platform flows can rebuild. This workflow stages
a Production deployment from the exact reviewed prebuilt files first.
