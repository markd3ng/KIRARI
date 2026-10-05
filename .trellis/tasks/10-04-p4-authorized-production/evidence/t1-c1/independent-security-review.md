# Independent T1 Vercel CLI security review

**Assessment complete with exposed residual risk. This is not concrete Owner approval, readiness, or Production authorization.** The concrete T1 decision remains pending. This first review binds a candidate whose exact Linux installed-tree/image identity is pending CI; refresh it after that exact artifact is captured.

Reviewer: Codex independent security stream /root/independent_security; UTC: 2026-10-05T15:42:42Z.
Review JSON raw-byte SHA-256: `sha256:82e8dfe40dc56729722b30b8cca3b1b013f85a317a0cc2deb8e99b1add0210f8`. Candidate manifest digest is excluded to avoid a circular hash.

## Candidate and unchanged audit

- Candidate: `Vercel CLI@62.2.0`, latest stable npm metadata selection.
- Exact lock SHA-256: `sha256:4c0a503511c7f2448f17dbedd5a72a5fbbd24114c400afcf29180e3e65a05f44`.
- Vercel tarball: `sha512-hwet6qXoOfZEc6waIx1VgI2nLl83wwuZZnFqKSsKJ47UFi9waEezPmAV7uNOx8Fq+6JTJIi+lRnxFXr9YFW3Eg==`; SHA-256 `sha256:68a81cdbc5f8dd0b5a63d41fc702d97d28d65c6d1b473cb2f55142eaabd5be26`.
- Signature/provenance/SBOM: VERIFIED_NPM_REGISTRY_SIGNATURE; INCONCLUSIVE_SIGSTORE_TUF_FETCH_FAILURE; ABSENT_NO_DIST_ATTESTATIONS_OR_GIT_HEAD; ABSENT_NO_PUBLISHED_CLI_SBOM.
- Full audit JSON SHA-256: `sha256:3e4e1f11164b2d0eb96d27ceeb21c56c0659b4190359c4907ae7e84b39e8bb34`; human inventory SHA-256: `sha256:4ee94106725c94f99b0ba8725b65d4b686375ad3350a9f06f285c863347a21b8`.
- Unchanged commands: `npm audit --prefix scripts/p4-production/tooling --audit-level moderate` and `npm audit --prefix scripts/p4-production/tooling --audit-level moderate --json`; both exit 1 and raw status stays **FAIL**. Counts: 0 info, 0 low, 8 moderate, 24 high, 1 critical; 33 npm vulnerable-package entries, 36 structured advisory objects, 105 total direct/inherited references. No suppression or ignored advisories.
- The machine report binds all exact npm audit via[] rows, including directness, paths, effects, affected ranges, fix data, and original via_reference.

## Per-advisory object review

All 36 structured objects link to primary GitHub Advisory Database records. Matching lock instances appear where the advisory range applies. Every object remains UNKNOWN_EXPOSED because the installed CLI route has not been exhaustively traced to prove all vulnerable code unreachable. The machine report also covers all 69 inherited/transitive references.
| Advisory | Package | Severity | Advisory range | Matching path/version | Assessment |
|---|---|---|---|---|---|
| [GHSA-x8mw-p69m-v3mx](https://github.com/advisories/GHSA-x8mw-p69m-v3mx) | @fastify/busboy | high | `>=1.0.0 <3.2.1` | `node_modules/@fastify/busboy@2.1.1` | UNKNOWN_EXPOSED |
| [GHSA-2g4f-4pwh-qvx6](https://github.com/advisories/GHSA-2g4f-4pwh-qvx6) | ajv | moderate | `>=7.0.0-alpha.0 <8.18.0` | `node_modules/ajv@8.6.3` | UNKNOWN_EXPOSED |
| [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | braces | high | `<=3.0.3` | `node_modules/braces@3.0.3` | UNKNOWN_EXPOSED |
| [GHSA-h67p-54hq-rp68](https://github.com/advisories/GHSA-h67p-54hq-rp68) | js-yaml | high | `>=4.0.0 <=4.1.1` | `node_modules/js-yaml@4.1.1` | UNKNOWN_EXPOSED |
| [GHSA-52cp-r559-cp3m](https://github.com/advisories/GHSA-52cp-r559-cp3m) | js-yaml | high | `>=4.0.0 <4.3.0` | `node_modules/js-yaml@4.1.1` | UNKNOWN_EXPOSED |
| [GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj) | js-yaml | high | `>=4.0.0 <4.3.1` | `node_modules/js-yaml@4.1.1` | UNKNOWN_EXPOSED |
| [GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh) | js-yaml | high | `>=4.0.0 <4.3.2` | `node_modules/js-yaml@4.1.1` | UNKNOWN_EXPOSED |
| [GHSA-3ppc-4f35-3m26](https://github.com/advisories/GHSA-3ppc-4f35-3m26) | minimatch | high | `>=10.0.0 <10.2.1` | `node_modules/minimatch@10.1.1` | UNKNOWN_EXPOSED |
| [GHSA-7r86-cg39-jmmj](https://github.com/advisories/GHSA-7r86-cg39-jmmj) | minimatch | high | `>=10.0.0 <10.2.3` | `node_modules/minimatch@10.1.1` | UNKNOWN_EXPOSED |
| [GHSA-23c5-xmqv-rm74](https://github.com/advisories/GHSA-23c5-xmqv-rm74) | minimatch | high | `>=10.0.0 <10.2.3` | `node_modules/minimatch@10.1.1` | UNKNOWN_EXPOSED |
| [GHSA-9wv6-86v2-598j](https://github.com/advisories/GHSA-9wv6-86v2-598j) | path-to-regexp | high | `>=4.0.0 <6.3.0` | `node_modules/@vercel/node/node_modules/path-to-regexp@6.1.0`<br>`node_modules/@vercel/remix-builder/node_modules/path-to-regexp@6.1.0` | UNKNOWN_EXPOSED |
| [GHSA-j3q9-mxjg-w52f](https://github.com/advisories/GHSA-j3q9-mxjg-w52f) | path-to-regexp | high | `>=8.0.0 <8.4.0` | `node_modules/path-to-regexp@8.3.0` | UNKNOWN_EXPOSED |
| [GHSA-27v5-c462-wpq7](https://github.com/advisories/GHSA-27v5-c462-wpq7) | path-to-regexp | high | `>=8.0.0 <8.4.0` | `node_modules/path-to-regexp@8.3.0` | UNKNOWN_EXPOSED |
| [GHSA-v3rj-xjv7-4jmq](https://github.com/advisories/GHSA-v3rj-xjv7-4jmq) | smol-toml | high | `<1.6.1` | `node_modules/smol-toml@1.5.2` | UNKNOWN_EXPOSED |
| [GHSA-7w5x-hrqm-74c2](https://github.com/advisories/GHSA-7w5x-hrqm-74c2) | smol-toml | high | `<=1.7.0` | `node_modules/smol-toml@1.5.2` | UNKNOWN_EXPOSED |
| [GHSA-vmf3-w455-68vh](https://github.com/advisories/GHSA-vmf3-w455-68vh) | tar | critical | `<=7.5.15` | `node_modules/tar@7.5.11` | UNKNOWN_EXPOSED |
| [GHSA-w8wr-v893-vjvp](https://github.com/advisories/GHSA-w8wr-v893-vjvp) | tar | critical | `<=7.5.17` | `node_modules/tar@7.5.11` | UNKNOWN_EXPOSED |
| [GHSA-23hp-3jrh-7fpw](https://github.com/advisories/GHSA-23hp-3jrh-7fpw) | tar | critical | `<=7.5.18` | `node_modules/tar@7.5.11` | UNKNOWN_EXPOSED |
| [GHSA-8x88-c5mf-7j5w](https://github.com/advisories/GHSA-8x88-c5mf-7j5w) | tar | critical | `<=7.5.17` | `node_modules/tar@7.5.11` | UNKNOWN_EXPOSED |
| [GHSA-gvwx-54wh-qm9j](https://github.com/advisories/GHSA-gvwx-54wh-qm9j) | tar | critical | `<=7.5.16` | `node_modules/tar@7.5.11` | UNKNOWN_EXPOSED |
| [GHSA-r292-9mhp-454m](https://github.com/advisories/GHSA-r292-9mhp-454m) | tar | critical | `<=7.5.20` | `node_modules/tar@7.5.11` | UNKNOWN_EXPOSED |
| [GHSA-c76h-2ccp-4975](https://github.com/advisories/GHSA-c76h-2ccp-4975) | undici | high | `>=4.5.0 <5.28.5` | `node_modules/@vercel/node/node_modules/undici@5.28.4` | UNKNOWN_EXPOSED |
| [GHSA-g9mf-h72j-4rw9](https://github.com/advisories/GHSA-g9mf-h72j-4rw9) | undici | high | `<6.23.0` | `node_modules/@vercel/node/node_modules/undici@5.28.4`<br>`node_modules/undici@5.29.0` | UNKNOWN_EXPOSED |
| [GHSA-cxrh-j4jr-qwg3](https://github.com/advisories/GHSA-cxrh-j4jr-qwg3) | undici | high | `<5.29.0` | `node_modules/@vercel/node/node_modules/undici@5.28.4` | UNKNOWN_EXPOSED |
| [GHSA-2mjp-6q6p-2qxm](https://github.com/advisories/GHSA-2mjp-6q6p-2qxm) | undici | high | `<6.24.0` | `node_modules/@vercel/node/node_modules/undici@5.28.4`<br>`node_modules/undici@5.29.0` | UNKNOWN_EXPOSED |
| [GHSA-vrm6-8vpv-qv8q](https://github.com/advisories/GHSA-vrm6-8vpv-qv8q) | undici | high | `<6.24.0` | `node_modules/@vercel/node/node_modules/undici@5.28.4`<br>`node_modules/undici@5.29.0` | UNKNOWN_EXPOSED |
| [GHSA-v9p9-hfj2-hcw8](https://github.com/advisories/GHSA-v9p9-hfj2-hcw8) | undici | high | `<6.24.0` | `node_modules/@vercel/node/node_modules/undici@5.28.4`<br>`node_modules/undici@5.29.0` | UNKNOWN_EXPOSED |
| [GHSA-4992-7rv2-5pvq](https://github.com/advisories/GHSA-4992-7rv2-5pvq) | undici | high | `<6.24.0` | `node_modules/@vercel/node/node_modules/undici@5.28.4`<br>`node_modules/undici@5.29.0` | UNKNOWN_EXPOSED |
| [GHSA-p88m-4jfj-68fv](https://github.com/advisories/GHSA-p88m-4jfj-68fv) | undici | high | `<6.27.0` | `node_modules/@vercel/node/node_modules/undici@5.28.4`<br>`node_modules/undici@5.29.0` | UNKNOWN_EXPOSED |
| [GHSA-vxpw-j846-p89q](https://github.com/advisories/GHSA-vxpw-j846-p89q) | undici | high | `<6.27.0` | `node_modules/@vercel/node/node_modules/undici@5.28.4`<br>`node_modules/undici@5.29.0` | UNKNOWN_EXPOSED |
| [GHSA-g8m3-5g58-fq7m](https://github.com/advisories/GHSA-g8m3-5g58-fq7m) | undici | high | `<6.27.0` | `node_modules/@vercel/node/node_modules/undici@5.28.4`<br>`node_modules/undici@5.29.0` | UNKNOWN_EXPOSED |
| [GHSA-8xcm-r25x-g524](https://github.com/advisories/GHSA-8xcm-r25x-g524) | undici | high | `<6.28.0` | `node_modules/@vercel/node/node_modules/undici@5.28.4`<br>`node_modules/undici@5.29.0` | UNKNOWN_EXPOSED |
| [GHSA-m8rv-5g2x-5cg5](https://github.com/advisories/GHSA-m8rv-5g2x-5cg5) | undici | high | `<6.28.0` | `node_modules/@vercel/node/node_modules/undici@5.28.4`<br>`node_modules/undici@5.29.0` | UNKNOWN_EXPOSED |
| [GHSA-v3r7-h72x-cjcm](https://github.com/advisories/GHSA-v3r7-h72x-cjcm) | undici | high | `<6.28.0` | `node_modules/@vercel/node/node_modules/undici@5.28.4`<br>`node_modules/undici@5.29.0` | UNKNOWN_EXPOSED |
| [GHSA-35p6-xmwp-9g52](https://github.com/advisories/GHSA-35p6-xmwp-9g52) | undici | high | `<6.27.0` | `node_modules/@vercel/node/node_modules/undici@5.28.4`<br>`node_modules/undici@5.29.0` | UNKNOWN_EXPOSED |
| [GHSA-r53p-7pc4-xj5r](https://github.com/advisories/GHSA-r53p-7pc4-xj5r) | undici | high | `<6.28.1` | `node_modules/@vercel/node/node_modules/undici@5.28.4`<br>`node_modules/undici@5.29.0` | UNKNOWN_EXPOSED |

npm fixAvailable generally proposes {"name":"vercel","version":"54.17.3","isSemVerMajor":true}, a breaking Vercel downgrade rather than a demonstrated nonbreaking fix for 62.2.0.

## Exact runtime path and aggregate reachability

The candidate binds entrypoint scripts/p4-production/tooling/node_modules/.bin/vercel resolving to scripts/p4-production/tooling/node_modules/vercel/dist/vc.js, fixed args prefix ["deploy","--prebuilt","--prod","--skip-domain","--yes"], and sorted metadata keys ["githubCommitOrg","githubCommitRef","githubCommitRepo","githubCommitSha","githubDeployment","githubOrg","githubRepo"]. The runtime creates a fresh temporary project, copies verified immutable Build Output to .vercel/output, writes project.json, uses isolated HOME and an allowlisted environment, disables auto-update/native fallback, and omits --archive. These controls narrow inputs and behavior but do not prove startup/import code, dynamic fallback, artifact/config parsing, network response parsing, or every archive path unreachable. Vercel documents --prebuilt as deploying .vercel/output and --skip-domain as staging without automatic domain assignment; neither documents a vulnerability reachability guarantee. [Prebuilt deployment](https://vercel.com/docs/cli/deploying-from-cli), [deploy command](https://vercel.com/docs/cli/deploy).

Aggregate lock paths challenged include:
- `vercel@62.2.0 -> undici@5.29.0 -> @fastify/busboy@2.1.1 (multipart parser advisory)`
- `vercel@62.2.0 -> @vercel/node@18.0.0 -> undici@5.28.4 (HTTP/fetch-related advisories)`
- `vercel@62.2.0 -> @vercel/static-config@3.4.4 -> ajv@8.6.3 (schema-validation/ReDoS advisory)`
- `vercel@62.2.0 -> @vercel/backends/@vercel/node/@vercel/remix-builder -> path-to-regexp (installed vulnerable 8.3.0 and nested 6.1.0; advisory ranges apply to different nodes)`
- `vercel@62.2.0 -> @vercel/node -> ts-morph@12.0.0 -> @ts-morph/common@0.11.1 -> fast-glob@3.3.3 -> micromatch@4.0.8 -> braces@3.0.3`
- `vercel@62.2.0 -> @vercel/python-analysis@0.14.0 -> js-yaml@4.1.1 / minimatch@10.1.1 / smol-toml@1.5.2`
- `vercel@62.2.0 -> @vercel/container@13.0.0 -> tar@7.5.11 and smol-toml@1.5.2`
- `vercel@62.2.0 bundles js-yaml@3.13.1 outside npm lock-level audit coverage.`

The CLI bundle includes js-yaml@3.13.1 outside lock-level npm audit. GHSA-5p4m-2wfm-xmqj describes affected 3.x and 4.x; npm separately reports locked js-yaml 4.1.1. The fresh stage omits repository root YAML/TOML config, but broad bundled code and exact parser reachability are not proven absent. [GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj).

## Install and credential boundary

Pinned CLI install is `npm ci --prefix scripts/p4-production/tooling --registry=https://registry.npmjs.org` using npm ci, with lifecycle scripts enabled, no Vercel credential, reduced npm-child environment, and temporary HOME. npm documents lifecycle scripts for npm ci. The helper withholds GH_TOKEN, VERCEL_TOKEN, GITHUB_ENV, and GITHUB_PATH from that npm child. This reduces direct install-time access, but is not a sandbox. GitHub documents same-job steps execute on the same runner and share workspace/filesystem. Earlier pnpm, browser npm, and Playwright installs also execute in the same job. Workspace/node_modules mutation or a same-user process persisting until the later operation step maps VERCEL_TOKEN remains UNKNOWN_EXPOSED. [npm lifecycle scripts](https://docs.npmjs.com/cli/v10/using-npm/scripts/?v=true), [GitHub same-runner steps](https://docs.github.com/en/actions/get-started/understand-github-actions), [GitHub workflow command files](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands).

The token-bearing CLI child is allowlisted, but receives Vercel token and target IDs. C1 scope is one project, yet proposed capabilities include same-project deploy, promotion, rollback, domains, project, and environment-variable management. It is not restricted to these exact CLI flags; endpoint-level denial and actual scope/grants are pending.

## Supply-chain limitations

The manually verified npm ECDSA signature binds package name/version/integrity for vercel@62.2.0; it does not cover the complete dependency tree or establish code safety. No successful whole-tree npm audit signatures result is retained after the TUF fetch failure; metadata has no provenance attestation/gitHead and no complete SBOM is present. npm states registry signatures cover package identity/integrity and provenance links source/build but does not guarantee benign code. [Signature scope](https://docs.npmjs.com/about-registry-signatures/), [signature verification](https://docs.npmjs.com/verifying-registry-signatures/), [provenance limits](https://docs.npmjs.com/generating-provenance-statements/).

The installed-tree digest binds sorted path/type/mode/file content/symlink targets, but is not a code-safety or provenance attestation. Exact Linux tree and mutable Ubuntu image version remain pending in this version.

## Independent result

Reviewed 33 package entries, 36 structured objects, and all 105 direct/inherited references. Result is REVIEWED_WITH_EXPOSED_RESIDUAL_RISK: review complete, unresolved paths explicitly exposed. Raw npm audit remains FAIL. T1 concrete approval remains PENDING; C1 role/scope/expiry evidence and separate approval are pending. No Production readiness or authorization is established.
