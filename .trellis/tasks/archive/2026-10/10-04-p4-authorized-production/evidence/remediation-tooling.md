# Deployment tooling remediation — Issue #130

Recorded 2026-10-05 against the current P4 remediation checkout.

**Decision:** P4_DEPLOYMENT_TOOL_REMEDIATION=BLOCKED_UPSTREAM. The required moderate npm audit gate still fails for the active CLI and latest stable official CLI and client. The latest clean official SDK does not document the prebuilt/no-build staged Production behavior required here. The clean native CLI package is explicitly experimental and ships compiled binaries that npm audit does not inspect. No candidate satisfies both the security gate and the complete documented deployment contract.

## Method and boundary

Candidate locks use exact direct package pins and npm lockfile version 3. Each lock was installed with npm ci and audited at the unchanged moderate threshold using Node 22.12.0 and npm 10.9.0, against https://registry.npmjs.org. The audit command was npm audit --audit-level=moderate --json --registry=https://registry.npmjs.org. No force, omit, allowlist, exception, or threshold change was used. Full lockfiles and machine-readable audit reports are retained under evidence/remediation-tooling-candidates/; the hashes and counts below bind this summary to those files.

The active 59.16.0 lock was freshly installed and audited as well as the latest-version candidates. Registry dist-tags were queried on 2026-10-05: vercel 62.2.0, @vercel/client 18.6.2, @vercel/sdk 1.28.38, and @vercel/vc-native 62.2.0.

| Exact official package | Lock SHA-256 (lock entries include root) | npm audit dependency counts: prod / dev / optional / peer / total | Findings: low / moderate / high / critical / total | Gate |
| --- | --- | --- | --- | --- |
| Active vercel 59.16.0 | ee2ad6a88171f42fabe9235e81b1cd966f98148e8066832bbd40968a24cb02d9 (388 entries) | 286 / 0 / 102 / 3 / 387 | 1 / 7 / 25 / 1 / 34 | FAIL |
| Latest stable vercel 62.2.0 | 227f5067665298dddb3c875fabd2b5a5a091972e44680aade25888a583a6f9ab (384 entries) | 280 / 0 / 104 / 3 / 383 | 0 / 8 / 24 / 1 / 33 | FAIL |
| Latest stable @vercel/client 18.6.2 | faf41f7d48c1bea34e02f524b76bf5f58ff3e9162a8370f68a769fb01945a61c (120 entries) | 115 / 0 / 5 / 0 / 119 | 0 / 0 / 9 / 0 / 9 | FAIL |
| Latest stable @vercel/sdk 1.28.38 | e9ee073c45c31f0f8453c09609359b54c24f3aea8f9b128a6f79268aad7a30e8 (3 entries) | 3 / 0 / 0 / 0 / 2 | 0 / 0 / 0 / 0 / 0 | PASS, behavior incomplete |
| Latest @vercel/vc-native 62.2.0 | d57cc5f020bd79480e147699a8814e89360b01fccee2cbe0684a91adce595332 (8 entries) | 2 / 0 / 6 / 0 / 7 | 0 / 0 / 0 / 0 / 0 | PASS, rejected as experimental binary |

The dependency-class and total counts above are copied from npm audit metadata. Lock entry counts are stated separately because npm's audit metadata totals do not always equal the sum of its dependency classes.

## Candidate behavior

The CLI remains the only candidate with the complete documented behavior. Vercel's current CLI documentation supports deploying an existing .vercel/output Build Output API tree with deploy --prebuilt, targeting Production while disabling automatic domain assignment with --prod --skip-domain, and promoting later with vercel promote. The latest 62.2.0 binary was installed from its exact lock and its version, deploy help, and promote help were inspected locally with VERCEL_TOKEN unset and telemetry disabled. Those options were present. Its 33 advisories still fail the required audit, so neither 62.2.0 nor active 59.16.0 can be adopted under the gate.

The official @vercel/client README describes it as Vercel's official Node.js deployment client. Its published declarations expose prebuilt, target, and autoAssignCustomDomains, and its implementation collects local files and submits the prebuilt query. This is a public package surface, but its locked dependency tree has nine high findings. It therefore cannot be adopted even before resolving whether the full prebuilt and deferred-promotion combination is documented as a supported contract.

The official @vercel/sdk is current and has a clean locked audit. Its deployment-creation reference documents uploaded file references, target: production, and metadata. It also says creation begins building immediately. The SDK/REST reference does not document the CLI Build Output API prebuilt input or a no-build deployment from .vercel/output. The request schema does not document a per-deployment control for staging Production without domain assignment; alias appears as response data and in descriptive text, not as a documented request control. The REST API's documented file-reference mechanism is not sufficient evidence that sending Build Output API files bypasses a platform build. Using that interpretation would rely on undocumented semantics, so this clean SDK is not a supported substitute for this workflow.

Vercel's official May 2026 announcement calls @vercel/vc-native an optional experimental native binary package. Its npm package tree audits clean, but npm audit does not analyze the compiled executable payload. The package is not a stable, fully audited replacement under the task's constraints.

Authentication is supported through the Vercel CLI token mechanism or the REST SDK bearer-token mechanism. No token was present in candidate CLI inspection, no credentials were injected, and no Vercel account operation was run. No package, lock, runtime adapter, or deployment implementation was changed in this stream.

## Conclusion and official sources

The documented CLI contract passes the functional requirements but fails the moderate audit. The clean SDK lacks documented prebuilt/no-build support and documented staged Production semantics. The client has the relevant public options but fails audit. The experimental binary is not a fully audited stable candidate. Consequently there is no supported, documented passing path, and the active lock stays unchanged. Issue #130 and PR #133 remain blocked on this upstream tooling result.

- [Vercel CLI deploy and prebuilt options](https://vercel.com/docs/cli/deploy)
- [Deploying a staged Production build with the CLI](https://vercel.com/docs/cli/deploying-from-cli)
- [Build Output API](https://vercel.com/docs/build-output-api)
- [Promoting a staged deployment](https://vercel.com/docs/deployments/promoting-a-deployment)
- [Official @vercel/client package README](https://www.npmjs.com/package/@vercel/client)
- [Vercel SDK reference](https://vercel.com/docs/rest-api/sdk)
- [SDK Create Deployment reference](https://vercel.com/docs/rest-api/sdk/deployments/create-a-new-deployment)
- [REST Create Deployment reference](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment)
- [Vercel announcement labeling native CLI binaries experimental](https://vercel.com/changelog/experimental-native-binaries-for-vercel-cli)
- [Vercel CLI deploy source](https://github.com/vercel/vercel/blob/main/packages/cli/src/commands/deploy/index.ts)
- [Official client declarations](https://github.com/vercel/vercel/blob/main/packages/client/src/types.ts)
- [Official client deployment implementation](https://github.com/vercel/vercel/blob/main/packages/client/src/create-deployment.ts)

P4_DEPLOYMENT_TOOL_REMEDIATION=BLOCKED_UPSTREAM
DEPLOYMENT_TOOLING_AUDIT=FAIL
