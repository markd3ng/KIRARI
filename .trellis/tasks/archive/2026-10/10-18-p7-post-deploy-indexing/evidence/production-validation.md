# Production validation — 2026-10-19

## Native deployment

Read-only Vercel project/deployment readback confirmed:

- Team: `team_NsBZHGUVnyygP7veiROKLuUx`
- Project: `kirari-main` / `prj_QNMVdxTkPOad4ynN4fwFCYEST8Jk`
- Deployment: `dpl_3djZusVJrqUQmiMK9Q4mf7C21rme`, `READY`, target `production`
- Source: `markd3ng/KIRARI`, branch `main`, commit `7863ec7277b829e9be1bf9d48c91bf710010a1fe`
- Alias: `kirari-main.vercel.app`

## First dispatch attempt

Vercel emitted several deployment status contexts for projects connected to the
same repository within seconds of this merge. GitHub created repository-dispatch
runs `39212497263`, `39212497350`, `39212499755`, and `39212501616`. Runs
`39212497350` and `39212499755` were cancelled before jobs started under the
workflow's single global concurrency group. The other two completed their
event checks but rejected their payloads as outside the approved Production
contract. The deployment commit has no
`kirari/indexnow-production` status, so no IndexNow provider request was made.

This exposed that the global concurrency group could replace a pending event
for the approved project with an unrelated project event. PR #153 changed the
workflow to key concurrency by Vercel deployment ID so independent project
events are checked without cancelling one another.

The first direct Node fetch attempt failed with `EBADF` through the configured
proxy. After the corrected deployment, direct `curl` GETs succeeded for the
canonical page and key file. The post-deployment GitHub runner also performed
the authoritative no-cache canonical SHA read before submission.

## Corrected deployment and accepted provider run

- PR #153 merged as `74eb4ca54e5e53493a197d0a0b2764a8483e0ddb`; exact-head
  CI run `39212858415` and the four Vercel Preview checks passed. Exact-main
  CI run `39213319034` also passed.
- Vercel readback confirmed deployment
  `dpl_7GaJoMPxtd1nPWYHb9uFXJXoN5th` reached `READY` in `Production` for
  `markd3ng/KIRARI`, branch `main`, exact commit `74eb4ca54e5e53493a197d0a0b2764a8483e0ddb`,
  project `kirari-main` / `prj_QNMVdxTkPOad4ynN4fwFCYEST8Jk`, Team
  `team_NsBZHGUVnyygP7veiROKLuUx`, and alias `kirari-main.vercel.app`.
- Fresh live GET at 2026-10-19 07:03 UTC returned HTTP 200 for the canonical
  page; its canonical link and `kirari:build-commit` meta both identified the
  approved host and exact `74eb4ca...` commit. The public IndexNow verification
  file also returned HTTP 200 and its body matched the configured key.
- Authenticated post-deployment workflow run
  `39213450721` completed successfully. Its canonical no-cache commit check
  passed, and it submitted 114 same-origin Production sitemap URLs to IndexNow.
  The provider returned HTTP 202; GitHub commit status
  `kirari/indexnow-production` is `success` with description
  `IndexNow accepted the Production sitemap (HTTP 202).`
- All four dispatches associated with this deployment completed; the approved
  `kirari-main` event was accepted and the other project events were rejected
  by the exact Production contract. None were cancelled by concurrency.

HTTP 202 means IndexNow accepted the request while key validation is pending;
it does not prove that a search engine has crawled or indexed the submitted
URLs. Google Indexing API remained disabled. No Vercel credential, project
setting, or manual deployment was used.
