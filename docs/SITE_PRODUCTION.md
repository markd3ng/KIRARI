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
actual Vercel team, project, complete affected domain set, canonical origin,
current deployment and operation. Changing those values requires a new
approval. Production does not rerun Astro, postbuild, indexing or Site code.

Before requesting authorization, read the current project, production domains
and deployment. The immutable HTML canonicals and robots sitemap must match
the selected production canonical origin. A package using `https://example.com`
cannot be released to a different canonical origin. Select a newly reviewed
CI artifact with the correct Site settings; never edit the downloaded package.

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
policy reported as a tag is rejected. Configure a dedicated least-required
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

The authenticated project readback must also explicitly report
`enableVercelCiSameRepository: false` and an empty `trustedSources.projects`
collection. Added Vercel project rules, customized self-access rules, and
missing or unrecognized values fail closed. This preserves the platform's
documented default self-access while refusing additional configured callers.
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

Both CI and the production workflow audit the pinned CLI dependency lock at
moderate severity before credentials are mapped. A failed audit blocks merge
and deployment; do not suppress it with a general dependency exception. Live
readiness also requires authenticated project readback of the exact Trusted
Sources shape checked by the runtime. An omitted or unknown field fails closed.

CI runs the audited local Production Chromium fixture before the independent
deployment-tool install and audit. This retains browser evidence even when the
tooling gate fails; the failed audit still fails the job and blocks merge.
The protected Production workflow audits tooling before mapping credentials.

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
