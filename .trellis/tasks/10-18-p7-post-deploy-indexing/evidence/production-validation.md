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
runs `39212497350`, `39212499755`, and `39212501616`. The first two were
cancelled before jobs started under the workflow's single global concurrency
group. The surviving run completed its event check but rejected its payload as
outside the approved Production contract. The deployment commit has no
`kirari/indexnow-production` status, so no IndexNow provider request was made.

This exposed that the global concurrency group could replace a pending event
for the approved project with an unrelated project event. The workflow now keys
concurrency by the Vercel deployment ID, allowing independent project events to
be checked without cancelling one another. A fresh native deployment and
successful workflow run are still required to prove the provider request.

The local execution environment could not independently fetch the public site
(network error `EBADF` through its configured proxy). The post-deployment
GitHub runner performs the authoritative no-cache canonical SHA read before
any submission; that check has not yet passed for this deployment.
