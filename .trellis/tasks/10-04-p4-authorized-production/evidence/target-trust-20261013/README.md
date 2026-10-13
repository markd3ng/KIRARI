# Target/domain and Trusted Sources remediation

Baseline main497e258fbdea911f0710d19585c76d8888117543. This is an unmerged engineering change; no Production authorization or provider mutation.

The configured Production-domain endpoint returns only kirari-main.vercel.app. The two additional observed aliases are provider-generated project/team and main branch URLs, as documented in [Vercel generated URLs](https://vercel.com/docs/deployments/generated-urls). Deleting them is unnecessary and would mutate provider traffic. The old combined comparison falsely treated them as added configured domains. The new model derives configured domains only from that authoritative endpoint and separately validates aliases with the exact C1-approved project/team slug, expected main branch and deployment binding. Unrelated own-namespace Preview branch rows grant no Production access. Custom domains, foreign project/team/branch-on-Production, redirects, malformed hosts, duplicate aliases and deployment substitution reject.

## Four authentication/readback surfaces

| Surface | Actual observation | What it proves |
|---|---|---|
| Project-scoped Production PAT | Protected main C1 run38342158272 PASS; full identity/fingerprint/unfiltered project pagination | Exactly one approved project. Its reviewed identity projection deliberately omits other raw fields; raw Trusted Sources visibility is **not proven** by that output. |
| Owner/control-plane browser, actual team OWNER | Fresh raw `/v9/projects/<id>?teamId=<id>`200 and dashboard `/v1/dashboard/projects/kirari-main?teamId=<id>`200, neither includes trustedSources/trusted_sources | Unavailable on these paths; not proof configuration is absent. No reusable Owner credential retained. |
| Vercel MCP get_project | Summarized result includes3 domains/aliases and omits trust policy | Lossy projection; neither exact configured-domain set nor authoritative policy proof. |
| Current official raw REST schema | [GetProjectTrustedSources](https://github.com/vercel/sdk/blob/main/docs/models/getprojecttrustedsources.md): boolean CI control, optional projects and issuer-to-rule-array oidcProviders | Supported normalization shape. [CI defaults to enabled if not stored](https://github.com/vercel/sdk/blob/main/src/models/getprojectresponsebody.ts); a missing control cannot qualify. |

Official schema sources were fetched live and their Git blob SHAs retained locally. Normalization supports the current provider map and existing legacy shapes, rejects shadowed fields/issuer overrides/extra empty provider entries, and preserves exact GitHub audience/repository/ref/workflow and Production-only destination. Current omitted projects on a present raw supported policy normalize to no additional stored rules; missing whole policy never qualifies. Live current normalization is still FAIL_CLOSED because the raw field is unavailable.

## Freshness and proof boundary

Every actual Production write remains behind current C1, main/Owner/replay/15-minute authorization and a fresh raw provider project read. No updatedAt/ETag semantics have been verified for Trusted Sources, so neither is used. No historical P3 proof, permanent exception, saved authenticated flag or static snapshot fallback is accepted. A secure Owner snapshot cannot be created from a response that omits the policy. We have not established that the project-scoped PAT is inherently unable to retrieve a configured policy; therefore no speculative credential broadening or Owner-credential runtime path was added.

## Smallest remaining Owner action

After separately reviewing/merging this exact engineering PR, separately authorize an Owner-only setup/readback of the exact target's existing reviewed Trusted Sources policy. This instruction does not authorize saving it. The inert `expected-owner-policy.json` records the exact required values: one GitHub issuer; audience https://github.com/markd3ng; repository markd3ng/KIRARI; ref refs/heads/main; workflow_ref markd3ng/KIRARI/.github/workflows/site-production.yml@refs/heads/main; destination only production; explicit same-repository CI=false; no additional project rules or sources.

Use Owner Deployment Protection > Trusted Sources, with raw claims where the guided form does not expose workflow_ref, or the documented Owner project-settings API. Obtain a fresh full authenticated raw policy read, then compare normalized policy and test the existing scoped PAT's raw read path. Do not create a token, broaden its scope, delete aliases or relax Deployment Protection. If a valid saved policy still cannot be read with the scoped PAT, that authenticated result becomes the basis for a separately reviewed short-lived Owner snapshot proof design; no bypass is active in this PR.

First release with rollback_record=null remains supported, with NO_APPROVED_RETAINED_PREVIOUS_RELEASE and FIRST_RELEASE_HAS_NO_KIRARI_MANAGED_PREVIOUS_ARTIFACT_ROLLBACK. The legacy deployment is not an approved KIRARI rollback release. No consumable Production proposal is generated in this remediation.
