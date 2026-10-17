# Production deployment CLI dependency audit

The production staging path remains on the pinned official `vercel` CLI 59.16.0. The lockfile was installed frozen with Node 22.12.0/npm 10.9.0; every resolved tarball host is `registry.npmjs.org`. The CLI reports its locked version correctly and its deploy help documents `--prebuilt`, `--prod`, `--skip-domain`, and repeatable `--meta` values. The help command printed the expected output but returned exit code 2; that result is recorded as observed.

The exact locked dependency audit remains red: `npm audit --audit-level=moderate --json --registry=https://registry.npmjs.org` exited 1 with 1 low, 7 moderate, 25 high, and 1 critical finding across 387 audited dependencies. `npm ci` completed, but reported the same 34 findings. The earlier isolated candidate audits were also red:

| Official package pin | Low | Moderate | High | Critical | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| `vercel@59.16.0` (fresh tracked-lock run) | 1 | 7 | 25 | 1 | 34 |
| `vercel@54.17.3` | 1 | 2 | 36 | 1 | 40 |
| `vercel@50.41.0` | 1 | 3 | 36 | 1 | 41 |
| `vercel@62.2.0` | 0 | 8 | 24 | 1 | 33 |

The fresh 59.16.0 result is 34, while an earlier root snapshot reported 37 findings (28 high). This evidence keeps the fresh exact-lock result and preserves the discrepancy rather than changing the lock or audit output to match either count.

The official `@vercel/client@18.6.2` package is a supported smaller alternative: its published declarations expose `prebuilt`, `target`, and `autoAssignCustomDomains`; its source collects/uploads the local prebuilt tree and sends deployment options to the deployment endpoint. Its isolated lock covers 119 dependencies and still fails the required audit with 9 high findings. It is not adopted as a way to bypass the audit gate.

Vercel's public Build Output and CLI documentation support deploying prebuilt `.vercel/output` and staging production with domain assignment disabled. The public REST reference documents `/v13/deployments`, file references, production target, and metadata, but does not document the `prebuilt=1` query or `autoAssignCustomDomains=false` controls used by the client/CLI implementation. The raw REST path is therefore not a safe drop-in substitute for the supported client/CLI flow.

For the pinned CLI source, `--skip-domain` maps to `autoAssignCustomDomains=false`; `--prebuilt` is passed through the local-file deployment path. `VERCEL_TOKEN` is read from the environment, and the CLI sets token auth with `skipWrite=true`. The local help/version invocations ran with `VERCEL_TOKEN` unset, an isolated global config/cache, and `VERCEL_TELEMETRY_DISABLED=1`. No deployment or account mutation was run.

The task is blocked for merge on this unresolved audit result. Keep the moderate audit enabled and leave the production PR unmerged until the official locked CLI tree passes or a supported official replacement has an acceptable audit result.

Official references: [Build Output API](https://vercel.com/docs/build-output-api), [Build Output configuration](https://vercel.com/docs/build-output-api/configuration), [Vercel CLI deploy](https://vercel.com/docs/cli/deploy), [staged production via CLI](https://vercel.com/docs/cli/deploying-from-cli), [REST create-deployment reference](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment), [official `@vercel/client` package](https://www.npmjs.com/package/@vercel/client), [official CLI source](https://github.com/vercel/vercel/blob/main/packages/cli/src/commands/deploy/index.ts), [official client types](https://github.com/vercel/vercel/blob/main/packages/client/src/types.ts), and [official client source](https://github.com/vercel/vercel/blob/main/packages/client/src/create-deployment.ts).
