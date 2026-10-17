# Native Site Production

KIRARI uses the hosting provider's native deployment mechanism. GitHub Actions
validates source and produces optional portable artifacts, but does not duplicate
the provider's native release controller.

For Vercel, the path is feature branch → PR source checks and advisory OCR →
review/merge → `main` → native Git build → Production. Feature branches retain
native Preview deployments. CI does not upload or promote another Production
artifact, and advisory OCR success is not a deployment prerequisite.

## Build And Target

Use the repository root with `pnpm install --frozen-lockfile`, `pnpm build`, and
output `apps/site/dist`. Preserve the generated root `vercel.json` headers,
rewrites and cache policy. Do not change the root to `apps/site` merely to match
an Astro template: profile materialization and workspace dependencies originate
at the repository root. Verify the project's effective settings, including
Production Branch, ignored-build behavior and any dashboard overrides.

The KIRARI reference target is:

|Binding|Value|
|---|---|
|Repository|`markd3ng/KIRARI`|
|Team|`team_NsBZHGUVnyygP7veiROKLuUx`|
|Project|`prj_QNMVdxTkPOad4ynN4fwFCYEST8Jk` / `kirari-main`|
|Production branch|`main`|
|Canonical domain|`kirari-main.vercel.app`|

`kirari-test` is a different staging project. Re-read current identity and
settings before operational changes; this table is not live deployment evidence.

## Product Builds And Portable Artifacts

Core/Site immutable source pins, config-ref read-only CI, deterministic composition,
external Site export, provenance and safe input parsing remain product capabilities.
They can be checked without Production deployment credentials. Vercel's Git build
runs from source; it is not claimed to deploy the identical bytes of an earlier CI
package. Optional schema-2 Build Output exports bind provenance/output, not a
project or Preview/Production destination; they are packaging, not a second release
controller or approval receipt. Gateway adapters remain independent application
capabilities; static export must not imply unverified runtime Functions support.

## Production Acceptance

After an authorized cutover, record current provider project/team, Production
environment, Git commit SHA, deployment ID, successful automatic build/READY state,
and the canonical domain's actual serving deployment. Run Production browser smoke
for routes, content, assets, canonical metadata, robots/sitemap and relevant network
and security behavior. Include observation time and sanitized source links.

A local build, green main CI or READY Preview does not prove public Production
serving; P4 was accepted only after actual native deployment and browser
acceptance. Indexing remains opt-in and disabled by default. The #100
post-deploy workflow accepts the authenticated Vercel bot and approved project
ID, Production environment, `main` ref, commit and canonical alias, then confirms
the canonical HTML serves that commit before reading its sitemap. Vercel's
documented event omits Team ID; the workflow pins the already approved project
ID and adds no Vercel credential. IndexNow also requires Site config and a
GitHub Actions variable. Google remains disabled pending eligible content
approval. Builds and Preview never submit indexing requests.

### Read-Only Browser Checks

Install the locked browser tooling with `npm ci --prefix scripts/p3-browser` and
`npx --prefix scripts/p3-browser playwright install chromium`. Check local output:

```bash
node scripts/p3-browser/validate.mjs \
  --dist-root apps/site/dist --report /tmp/kirari-local-browser.json
```

Local fixtures resolve allowlisted Iconify requests from locked, installed icon
sets, reject unknown icons or request shapes, and record package fingerprints and
resolution counts with `externalTransport: NOT_CHECKED`; live `--base-url` checks
use the actual network and retain transport failures.

After cutover, check the actual Production origin using matching local output
to select the expected routes and features. Choose `--indexable true` or `false`
to match the intended robots policy; it does not send indexing notifications:

```bash
node scripts/p3-browser/validate.mjs \
  --dist-root /path/to/matching-output \
  --base-url https://kirari-main.vercel.app \
  --mode production --canonical-origin https://kirari-main.vercel.app \
  --indexable true --report /tmp/kirari-production-browser.json
```

The browser report checks observed page behavior. It explicitly records
`providerDeploymentIdentityVerified: false` and `byteEquality: NOT_CHECKED`;
verify provider project/environment/commit/domain separately. Native rebuilds
need not reproduce the bytes of earlier CI packages. The checker neither logs
in nor bypasses deployment protection; blocked access is not a successful smoke
test.

The candidate repository configuration enabling `main` may cause merge to deploy
Production automatically. Prepare the complete PR, verify native Git integration
and Production settings, identify this side effect and obtain one separate Owner
cutover decision covering merge and expected deployment. Stop before merge or
live Production settings changes. Detailed fresh cutover evidence belongs in the
active Trellis task and #99/#129, rather than a second approval database.

## Native Recovery

Use Vercel's native deployment history to identify an eligible prior Production
version. Verify project, environment, commit and affected domains before an
Owner-authorized recovery. Instant Rollback restores an existing build; it does
not update that build's environment variables. Hobby supports the immediately
previous deployment. Preview-only deployments are not rollback evidence.
[Vercel Instant Rollback documentation](https://vercel.com/docs/instant-rollback).

Rollback turns off automatic Production domain assignment, so subsequent main
pushes do not replace the restored site. Vercel's native **Undo Rollback**, which
promotes a selected deployment, restores automatic assignment. Confirm this state
before expecting new Git deployments to serve traffic.
[Vercel recovery instructions](https://vercel.com/docs/instant-rollback#undo-a-rollback).

Re-run identity/domain/browser checks after recovery. A Git revert followed by a
native rebuild/redeployment is a different recovery path; it does not promise old
artifact byte identity or restore third-party service state. If there is no verified
eligible prior Production deployment, report that limitation. Documentation and
local fixtures do not claim that a live rollback was performed.

## Retired Architecture

The custom manual Production/staging controller, per-release C1 manifests,
runtime Trusted Sources readback, cryptographic approval bindings, immutable upload,
stage/validate/promote and approved-record rollback are retired. Their source and
evidence remain traceable through [PR #142](https://github.com/markd3ng/KIRARI/pull/142),
Git history and the P4 Trellis task. Earlier local/simulation acceptance is not
native Production evidence; historical approvals are not reused for cutover.

Removal of repository consumers does not revoke live credentials or delete
provider configuration. Verified-unused operational cleanup requires its own
appropriate decision. Normal access control, safe secret handling, CSP, source
checks, signing or provenance with a concrete independent purpose remain valid.
Do not recreate a duplicate release controller without a new Owner architecture
choice. Provider-native Actions for a separately selected host such as GitHub
Pages are compatible with this rule.
