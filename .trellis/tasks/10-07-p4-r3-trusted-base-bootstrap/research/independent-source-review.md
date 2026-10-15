# Independent source review — native Git correction

What this change does: It restores Vercel native Git deployment eligibility and removes the competing Actions upload, admission and promotion controllers. It preserves source quality checks, portable Core/Site output verification, ordinary browser checks and opt-in indexing boundaries.

Verdict: PASS for the reviewed engineering source. No concrete blocking or non-blocking defects found. This is not merge, cutover or Production authorization.

## Independence and scope

Reviewer authored the earlier consumer research only, not the implementation. Reviewed the active task PRD/design, the consumer graph and current source diff against main `c6db5da47d1b5d853a38032e1b676fb0cf2c013a`, including untracked new source/tests. Expected load is a developer/CI static-build and validation tool, not a public multi-tenant service. No auth stores, secret values, provider/GitHub APIs or deployment operations were read or changed.

## Findings

None requiring action. In particular:

- Generator and generated root config remove only the main-disable policy. Astro root build/output, routing and security headers remain intact. QA accepts native deployment defaults and denies the old per-branch disable map.
- All three release workflows and their controller trees are removed. The current remaining workflow source has no deployment token consumers, upload/stage/promote/rollback commands or old controller imports. Old source names remain only in explicit negative architecture tests. Historical Trellis evidence is not a live dependency.
- The neutral browser utility extraction repairs the unconditional browser helper import chain, so local fixture/build validation no longer loads retired P4 authorization. Production-mode CLI output explicitly reports providerDeploymentIdentityVerified=false and byteEquality=NOT_CHECKED. Local routed fixture byte equality is labelled local and does not claim a provider deployment.
- Request routing acquires no credentials, removes inherited provider bypass headers, manually limits redirects, strips browser Authorization/Cookie on external hops and blocks unexpected origins. Static comparison follows only same-origin redirects and rejects digest/size mismatch. Symlink and archive/path substitution safety remains tested.
- Schema-2 exports contain no deployment destination. The GitHub artifact transport SHA/branch is checked separately from selected immutable Core SHA; config/manual builds can therefore select a different Core without falsely identifying workflow source as Core. Upstream archive hashes and byte-for-byte composition/config equivalence remain checked.
- CI retains the original engineering type/build/QA/release/profile/edge/composition checks, browser fixtures, advisory OCR and informational unsuppressed audit. The removed CLI/C1 gate is no longer hidden inside the browser job. Regression negatives reject duplicate deploy commands, including direct --prod/--prebuilt forms, while allowing vercel build --prod, independent provenance and read-only deployment inspection.
- Docs preserve the distinction between source CI/local fixtures and actual project/environment/commit/domain/browser Production proof. Indexing remains opt-in/default-off and needs a later actual-deployment signal gate. Source cleanup does not imply live credential revocation. Native provider rebuilds do not claim earlier CI artifact byte identity.

## Independent checks performed

- 33 focused Node tests passed; zero failed or skipped: native-deployment-architecture, browser-request-routing, static-site-validation, site-package-output, site-artifact and ci-composed-artifact-contract suites.
- Generated Vercel config parity check passed.
- git diff --check passed.
- Searched active workflow/scripts/application/docs/spec source for retired controller paths: only architecture-negative fixtures remained.

The workers' broader 47 Node / 19 Chromium results are context, not represented as independently rerun here. Root full quality checks are separate evidence.

## Limits

Live Vercel Git/root/ignored-build/dashboard settings, actual automatic deployment, serving-domain identity and live recovery are not verified by this source review. The added neutral browser CLI documentation has now passed a narrow follow-up below. Future cutover/task metadata/evidence changes do not inherit this source review automatically. Any change to a hashed reviewed source file requires review of that delta before exact-head binding.

## Reviewed path identity

SHA-256 values below bind reviewed on-disk bytes. Deleted paths record baseline Git blob IDs and absence, not content in the candidate. Historical task evidence and root metadata additions are excluded.

| Path | Candidate identity |
|---|---|
| `.github/workflows/c1-readiness.yml` | `DELETED; baseline blob 35a8895f2f5d071c751d0efa7758d869d37bff31` |
| `.github/workflows/ci.yml` | `sha256:61e00d48a1dd1138da1ca6018d56be17a1877d594a051660aedd6399c56d6176` |
| `.github/workflows/site-production.yml` | `DELETED; baseline blob b5626655e90c3b2d09140f2391e56aa96d32728b` |
| `.github/workflows/site-staging.yml` | `DELETED; baseline blob 802df1e066a013853e753b38ecbdc79f616bad3e` |
| `.gitignore` | `sha256:cc6db39ff085ad06876903b4c710def7bdd3787f3e0a4a2ff0f2cd0e69d7d393` |
| `.trellis/spec/guides/repository-workflow.md` | `sha256:8bb8084f7af67919872c9f426cbd51b08a403516636e62fad8457342f040b1a7` |
| `.trellis/spec/site/frontend/quality-guidelines.md` | `sha256:4414365ebaf99678cdf196339cd8526f95f2878195e3f6c3ea7cba99deef92d6` |
| `AGENTS.md` | `sha256:0b13a92c61c26ed93ea56207124a8ccb2161394761bf3c6896629e3f0d263238` |
| `CONTRIBUTING.md` | `sha256:8526fe470e608d7d9eb6acd2f4bb0aad4f52f919b90b7584f5ef10dbd1ced449` |
| `DEPLOY.md` | `sha256:b7c3ae44c283e46bf08a72cb5449500d7274807c66f2b7cdceb50c81692d4a54` |
| `README.md` | `sha256:7c4ff75d54f56170fab7105ed539a1b98f751732f46363bdbe0e8b9aa688d2ff` |
| `README_CN.md` | `sha256:5fecdcf989d7ff2aed249f0f44026d6f04813b659f443e53824abd6d6c617ab6` |
| `SECURITY_MODEL.md` | `sha256:e41df8a2dfa9ae69ea7b2d123b6864700e881f9e68d0997147c042b15bc625cc` |
| `apps/site/scripts/qa-regression-check.mjs` | `sha256:7c0e7f916ac1aceb92edbad759f3dc03bc929a5f8420a388f6363b13ac29630a` |
| `apps/site/scripts/security-policy.mjs` | `sha256:0d9c2f7fae5943ccdcf9e35bb9390ffd32c207bf4025ec75c416826ea8ec72fe` |
| `docs/EXTERNAL_SITE_BUILD.md` | `sha256:73a7c08bd50c69fb5cb3f12944b0d3c168236e951cdd65c2c9dfef8ef3dfef1b` |
| `docs/SITE_PRODUCTION.md` | `sha256:c1cbd4378d2c408b7c137b881ec7d69773b91034d04ae13b7f138501d5342ed1` |
| `docs/VERCEL.md` | `sha256:88ec47f28702e1f0c49249a9e4d1962431afd4f0e60fed5b7d49f904f209cc53` |
| `scripts/deploy-vercel-preview.mjs` | `DELETED; baseline blob 93c3c4dfcc9c3d2917df837dad1276904e8f98f8` |
| `scripts/deploy-vercel-production.mjs` | `DELETED; baseline blob 3e9e3d82c282298c34dbeaa5dc86365084d43f79` |
| `scripts/p3-browser/browser-health.mjs` | `sha256:41940b1958e7a09ed84283bf9d4f71da8efa505ce7bc7a36d2f22e570889e285` |
| `scripts/p3-browser/create-staging-record.mjs` | `DELETED; baseline blob 3bd47a5c263dbcb89174aa5a93a069db64701fae` |
| `scripts/p3-browser/github-oidc.mjs` | `DELETED; baseline blob a46a6c35699989442745208169aea17051617bf3` |
| `scripts/p3-browser/page-policy.mjs` | `sha256:ed52fe8a3c1543166dc316f025a7673fc1d5097d99300860bc8dff0afdeabd0f` |
| `scripts/p3-browser/production-browser-helpers.mjs` | `DELETED; baseline blob 12fcec5d69d1dba62640219b08c08ead4180c16e` |
| `scripts/p3-browser/production-fixture.mjs` | `DELETED; baseline blob 7db044f30a98989437818345eb66835829af7552` |
| `scripts/p3-browser/request-routing.mjs` | `sha256:06a6cb231f310745992b776ffbeba02fdf7bb0cacc2103406bc05a1831b38a47` |
| `scripts/p3-browser/site-fixture.mjs` | `sha256:7ef1a2251b4d48f301aac00d1432a0a4660b681d0dcdabfe349b21e035db3483` |
| `scripts/p3-browser/validate.mjs` | `sha256:97afc23f615bb7bb448a79c72a8ed0f27e974cd4d477d98f0c9f9e0309391753` |
| `scripts/p4-production/alias-policy.mjs` | `DELETED; baseline blob 08809b01a3459f4d1ca72d986e8e09343d0ad4ec` |
| `scripts/p4-production/credential-contract.mjs` | `DELETED; baseline blob cdba13507f3e6f70c645bfbcdbfce60255a88699` |
| `scripts/p4-production/credential-gate.mjs` | `DELETED; baseline blob aab8147225e8b225c6dd06b77777124c0fea89d2` |
| `scripts/p4-production/credential-provider.mjs` | `DELETED; baseline blob 27cf59fae7a2eb271d539ef658b22b0c219fd070` |
| `scripts/p4-production/evidence.mjs` | `DELETED; baseline blob 65a485b5625616da56c178ad609e91e25dea9a59` |
| `scripts/p4-production/npm-runtime.mjs` | `DELETED; baseline blob d87fc4d961c9752e759cfb9d7649a6d7ebb9c757` |
| `scripts/p4-production/owner-decision.mjs` | `DELETED; baseline blob cf06da4ec8095a8a29d77b1735d9083510f3e268` |
| `scripts/p4-production/preflight.mjs` | `DELETED; baseline blob 191e160010ebaad2f519dfff4e37416afc8a828a` |
| `scripts/p4-production/production-validation.mjs` | `DELETED; baseline blob c61f54da6aff2d7c64474ea2c854eb5d781f070a` |
| `scripts/p4-production/rollback.mjs` | `DELETED; baseline blob 0b8031d6477529a7414acf6c2b17d9b8ab06fda0` |
| `scripts/p4-production/run.mjs` | `DELETED; baseline blob 0bdfebbac6c8db16be7119887e1251e08467847b` |
| `scripts/p4-production/runtime-adapter.mjs` | `DELETED; baseline blob 7581008fc97039309c4570b41b9183d5d4e97eeb` |
| `scripts/p4-production/tooling-gate.mjs` | `DELETED; baseline blob f1124a4e7d87c8a624015eb84db7312605dd55a2` |
| `scripts/p4-production/tooling-identity.mjs` | `DELETED; baseline blob acce31db544c2bcf17f969b430366de742ab5a62` |
| `scripts/p4-production/tooling-install.mjs` | `DELETED; baseline blob 8bbe826e3427f6aa640c134e13548b4ea16a22d1` |
| `scripts/p4-production/tooling/package-lock.json` | `DELETED; baseline blob bbb9bbaf849d0cc37511896138596ee7fd37adab` |
| `scripts/p4-production/tooling/package.json` | `DELETED; baseline blob 9790de05629d021a6c07ab7382ee7d67b1be72ef` |
| `scripts/p4-production/trusted-sources.mjs` | `DELETED; baseline blob d1039b95760ed429d698d2e010035de49f724b59` |
| `scripts/package-vercel-site.mjs` | `sha256:1be49c7c85ab901916ab8d84b600fb7df4895d810b84a427751023a249de27c1` |
| `scripts/production-authorization.mjs` | `DELETED; baseline blob 74ec81d2a2586efb2943bd882b5bbddd4a788974` |
| `scripts/site-artifact.mjs` | `sha256:13b5e903ceb9a282bcd40b0a4b72bcc1b77b8e46fecb15937010e6620a187fbd` |
| `scripts/static-site-validation.mjs` | `sha256:b3c6faef521d46a6e6fd2cb7b131a825a74f174f9ceb418c7fa46b92d796d83a` |
| `scripts/tests/browser-request-routing.test.mjs` | `sha256:3703e1d62402f3d436e0b648d7c5e2941f8b6f9c658eb591af53ed35dfc2fdc8` |
| `scripts/tests/ci-composed-artifact-contract.test.mjs` | `sha256:433df5107c2642c55c8de7213509ecfacc8259b708357acc404063da45a672df` |
| `scripts/tests/composed-build.test.mjs` | `sha256:d814673ee26fcd69ff20c28ff593fb163e69e5b61d7480cb586474dfff620c62` |
| `scripts/tests/helpers/site-artifact-fixture.mjs` | `sha256:768a47ade8e3fc673980b2dfbb727667e09c5ece0d485db1a91575fdec555485` |
| `scripts/tests/native-deployment-architecture.test.mjs` | `sha256:18dfaadbc87c2c64340ed4726cac2053b5e8bd5cb9691ca1a9cbc3cbb5bbef23` |
| `scripts/tests/p3-browser-oidc.test.mjs` | `DELETED; baseline blob e52d04ef33a184b1fcaec75fb5faf399d7262558` |
| `scripts/tests/p3-staging-workflow-contract.test.mjs` | `DELETED; baseline blob c2cafd3b58ceec4781d36e46de73b0f00cfe8821` |
| `scripts/tests/p4-alias-policy.test.mjs` | `DELETED; baseline blob 4896fea998b5b618d05e3a3937f5bc40a5b2fbf4` |
| `scripts/tests/p4-c1-readiness-workflow.test.mjs` | `DELETED; baseline blob 343a4559e825ad9052a301bf887f78459b64d30e` |
| `scripts/tests/p4-credential-provider.test.mjs` | `DELETED; baseline blob 0879ad27e212c4668ae301464c86ccc433d581c0` |
| `scripts/tests/p4-owner-decision.test.mjs` | `DELETED; baseline blob 298ed8d6fdb7d12d821f323a5287ccfd1340a339` |
| `scripts/tests/p4-production-browser-fixture.test.mjs` | `DELETED; baseline blob 13c2aeb937f4acceb90ec6c40a409f952ce48c1f` |
| `scripts/tests/p4-production-credential-contract.test.mjs` | `DELETED; baseline blob 867a912e21716580770aceea770fd9960e956632` |
| `scripts/tests/p4-production-preflight.test.mjs` | `DELETED; baseline blob ad1507b437e4f8bebad7abafcbde945035b56c70` |
| `scripts/tests/p4-production-validation.test.mjs` | `DELETED; baseline blob dc477e0f990a64df6501e701d16838a371d7921f` |
| `scripts/tests/p4-production-workflow.test.mjs` | `DELETED; baseline blob 28ca4a8d578b48c49dc8a9f4459e168e0d3a014e` |
| `scripts/tests/p4-rollback.test.mjs` | `DELETED; baseline blob 368ea27ff041ed1b3fd7167ad0cee10a11d69785` |
| `scripts/tests/p4-runtime-adapter.test.mjs` | `DELETED; baseline blob a1caf7f807e44ce9d3e6e6d33c831b2440b994d7` |
| `scripts/tests/p4-runtime.test.mjs` | `DELETED; baseline blob 18b8b6be801d61336e1c2b40a8dcd532d44481bd` |
| `scripts/tests/p4-tooling-gate.test.mjs` | `DELETED; baseline blob 40d4cc7aba9d91e396b698b41003efdeccac04fe` |
| `scripts/tests/p4-trusted-sources.test.mjs` | `DELETED; baseline blob 8f082f3016eb1edeacaacfd32bfc0af11caf112b` |
| `scripts/tests/production-authorization.test.mjs` | `DELETED; baseline blob 738199536e7ae4868e7c8999d93bcfc1358c411b` |
| `scripts/tests/site-artifact.test.mjs` | `sha256:7402e6c9027a5c96e5d3f8bc8a6c6b2b706395f12e50e9afb46cd8a277f0d8e9` |
| `scripts/tests/site-browser-fixture.test.mjs` | `sha256:13b6f14ddd0b37eb746837fda1bb90efab6e3a53455ad8b93508093a886ff18f` |
| `scripts/tests/site-package-output.test.mjs` | `sha256:bb0aa4cf9472bee1fc24e05dcf2a074c092bef62a5d04c283eaa1b8e1dfa6f72` |
| `scripts/tests/static-site-validation.test.mjs` | `sha256:7c9982b82d5d49acde3a0eff882d32432c7adc70b0bcda2f7c8c253f4046bac5` |
| `scripts/tests/vercel-preview-deployment.test.mjs` | `DELETED; baseline blob 0a541064010d03c4605a6d81ee8f00ffc4b485ad` |
| `scripts/tests/vercel-production-artifact.test.mjs` | `DELETED; baseline blob 73b8b2f301dd1a6d2f1cd3c33d9123b87a77c330` |
| `scripts/verify-site-package.mjs` | `sha256:0ab3f7f1a57a0a6e26bfd8d12ed26afd723412e2a15c4c27cebe96e89a2047a5` |
| `vercel.json` | `sha256:2a9cb822f9ed5345d21b0e4961cd4f4051d78a435f07f0fcfe53a01a5da6e1e3` |

| `scripts/p3-browser/fixture-icons.mjs` | `sha256:8be0d16fd7cbbf9778a87e634aa38c062946c23eba17807507c0f53161d19201` |

Reviewed at 2026-10-15T01:48:50.371291+00:00.

## Narrow follow-up — browser CLI and historical planning annotations

PASS; no concrete findings. `docs/SITE_PRODUCTION.md` examples match the current validator arguments: locked Playwright install, matching local output, explicit live HTTPS origin/canonical and indexing choice. The text correctly separates observed browser behavior from provider identity and byte identity, names NOT_CHECKED, and makes blocked access fail rather than suggesting auth bypass. The example true value is explicitly a choice matching intended policy, not a change to default indexing or a notification command.

Old task planning now has a prominent superseded/historical banner directing execution to the current task. The legacy task title/scope identify it as retired; both old/current task states stay in_progress with completedAt=null, so retirement is not reported as P4 completion. The current retirement document is explicitly history. Old evidence was retained rather than represented as fresh acceptance. This follow-up did not re-run unchanged runtime tests or verify provider state.

| Additional reviewed planning path | SHA-256 |
|---|---|
| `.trellis/tasks/10-04-p4-authorized-production/task.json` | `sha256:6a50c8db6e81b2efcf8cdeda1b704116bf07845d1a26c427ea52a5bd20fa7711` |
| `.trellis/tasks/10-04-p4-authorized-production/prd.md` | `sha256:1cd0f1ffe9ea6b671711c6b52bea2c5aff92f486728e56db3442ac2567133450` |
| `.trellis/tasks/10-04-p4-authorized-production/design.md` | `sha256:206665f97a404a61cc06277df06725d5183aa62f0115088aa1cff6de18a92686` |
| `.trellis/tasks/10-04-p4-authorized-production/implement.md` | `sha256:691b90acd0deef276942c70e5f66ed0027f75a3ae61677dc987f71dea6baf4ba` |
| `.trellis/tasks/10-07-p4-r3-trusted-base-bootstrap/retirement.md` | `sha256:985abefcde0565d708f83c93573d5f77af65e1c98b4b51cb0e2933405e8c5675` |

Follow-up reviewed at 2026-10-15T01:52:43.824194+00:00.

## Final frozen browser reliability delta

PASS, no concrete findings. Diagnosed local Iconify fallback timeouts are handled by a local-only deterministic resolver backed by existing locked application icon packages. Exact allowed origins, known prefix/path, single icons query, GET, valid bounded names, installed icon existence and alias-parent recursion are checked. Unsupported/missing icons fail rather than creating placeholder success. Package versions and source-data hashes are recorded. The fixture resolver is not selected for --base-url, so live smoke still fetches actual external services and reports transport failures. Sanitized network diagnostics retain only origin/path/resource type and bounded error classification, not request headers or raw exception text.

The source/docs hash rows above now bind this frozen delta. Independently reran routing suite: 8/8 PASS, zero skips. Independently reran REQUIRE_SITE_BROWSER=true site-browser-fixture suite after the final source/test freeze: 4/4 PASS, zero skips (26.1 seconds), including actual Chromium positive/noindex cases, real expected icon resolution, missing-icon/dynamic canonical/navigation/asset/console/external negatives, local CLI and rejected old admission arguments. These four Node tests invoke several browser cases; this report does not relabel that as the workers' broader fixture count. Earlier 33-test snapshot is superseded only for these changed file hashes; unchanged-source conclusions remain valid.

## Narrow metadata read (not runtime source certification)

Read current cutover.md, task.json, PRD/design/implement.md and research/quality-verification.md. No concrete issues: operational reads are distinguished from legacy deployment/history; omitted ignored-build fields require dashboard confirmation; branch protection is not claimed; merge/deployment authorization remains separate; local icon transport and native rebuild byte limits are explicit. Quality reporting names overlap, missing actionlint, informational audit findings and failed initial browser diagnosis without claiming native Production acceptance. P4 remains in_progress/completedAt=null. Root may finish engineering checkbox/PR/evidence metadata later; those subsequent metadata values do not inherit this snapshot automatically. No provider or GitHub mutation was performed by the reviewer.

Frozen browser delta reviewed at 2026-10-15T02:01:22.573470+00:00.

Staging follow-up: root removed one redundant blank line at EOF in scripts/static-site-validation.mjs after staged diff --check detected it. This is whitespace-only (old bytes equal new bytes plus one newline); functional reviewed content is unchanged. Table identity is updated to the final staged bytes. Staged whitespace validation passes.

## Advisory OCR follow-up — frozen test-only delta

PASS. Independently triaged all eight medium inline and all 22 low summary comments from run38668940211/1; see advisory-ocr-triage.md. No confirmed runtime/security defects. Confirmed two test coverage gaps have been corrected: all ten retained CI suites are asserted, and deployment REST mutation detection now handles implicit body/form writes and flags before/after endpoint, including attached short flags. Positive GET inspection, log descriptions, source-only vercel build --prod and independent provenance remain allowed. Independently ran the two affected suites after final freeze: 8/8 PASS, zero skips. Hash rows above bind these final two test files. Runtime source did not change; no heavy rebuild or provider operation was necessary for test-only corrections. Initial PR head12cb0c2 exact review is extended by these frozen test bytes; root must record the resulting final commit/CI before exact-head acceptance.

Advisory follow-up reviewed at 2026-10-15T02:26:18.738986+00:00.
