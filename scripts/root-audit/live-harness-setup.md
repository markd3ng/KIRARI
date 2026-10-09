# Disposable GitHub admission lab

This is an executable REST harness for an isolated lab, with separate Owner administration and App publishing credentials. It refuses `markd3ng/KIRARI` and production repository ID `1156039202`, including a renamed lab-shaped full name, before key access or HTTP. Its fixture approvals and green checks grant no KIRARI/R3 authority. Production publishing remains hard fail-closed; final admission remains `NOT_READY`, including after all lab assertions pass.

## Consolidated Owner setup checklist

Complete these steps locally after using the reviewed engineering source. No private key or token belongs in chat, the checkout, an artifact, a command argument, or a GitHub Actions secret for this lab.

1. Configure the separate **production dedicated App**, following [the production setup manifest](./github-app-manifest.json): Owner `markd3ng`, private App visibility, webhooks/OAuth/callbacks off, exactly Checks write and automatic Metadata read, selected installation on **only `markd3ng/KIRARI`**. Keep its private key in the Owner's secure local store outside all source trees, Actions, chat, logs and artifacts; create no Actions/repository/organization secret. Keep `KIRARI_R3_PUBLISHER_ENABLED` absent or false. Creating this App grants no check-publication, exception-consumption, enforcing-ruleset or merge authority. Future production Environment/key placement remains blocked on the protected trusted implementation, final admission and separate activation decision.
2. Prepare the production inspector's **nonsecret** JSON fields `id`, `clientId`, `installationId`, and `slug` from actual App settings. Set `KIRARI_APP_PRIVATE_KEY_FILE` to the protected absolute local key path, then run the fixed production metadata-only inspector command below with a new output path. It can read App/installation metadata, discover the complete selected installation using a metadata-only token, mint the exact KIRARI-scoped minimum-permission token, and revoke tokens; its transport cannot publish checks or mutate repository settings/content. A successful receipt proves only the observations it names, not PR credential isolation, check provenance, recovery or atomic merge admission. Its frozen custody ledger retains known tokens for retries and reports uncertain issuance explicitly.
3. Create a new disposable, non-fork repository in the Owner's personal account named `kirari-r3-disposable-lab-<unique-suffix>`, initialized with a harmless README. Leave merge commits enabled, disable GitHub Actions, and leave all repository/parent rulesets absent. Use a private repository when its account supports branch rulesets, or explicitly choose a public disposable repository. Public lab files and fixture comments contain only synthetic test data. GitHub documents plan/visibility availability in [About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets).
4. Create **two distinct lab-only GitHub Apps** owned by that same account. Give each exactly repository `Checks: read and write` and automatic `Metadata: read`; add no other repository, organization or account permissions. Disable webhooks and OAuth/user authorization; leave event subscriptions and callbacks empty. Install each using selected repositories, selecting **only the disposable lab**. Keep these separate from the KIRARI-only production App. The second App is necessary to prove rejection of a real wrong-publisher green check. [GitHub App permissions](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app).
5. Generate each lab App's RSA private key in the Owner-controlled App settings. Keep the key files outside all checkouts in a private local directory; files must be owned by the current user, ordinary files, and mode `0600` or tighter. Keys do not expire automatically; rotate/delete them after the lab as appropriate. The harness signs short JWTs in memory and never persists token/key contents. [Private key custody](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/managing-private-keys-for-github-apps), [JWT authentication](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app).
6. Obtain a separate, short-lived **Owner administration credential selected only on the lab**. A fine-grained Owner PAT may be used for fixture administration with `Administration: write`, `Contents: write`, `Pull requests: write`, and automatic `Metadata: read`. It is a disposable lab setup/recovery credential, never a publisher trust root. Pull requests permission covers the selected fixture comments; ruleset administration needs Administration write. App tokens retain only Checks write and Metadata read. [Comment permissions](https://docs.github.com/en/rest/issues/comments), [Ruleset permissions](https://docs.github.com/en/rest/repos/rules), [Merge permission](https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request).
7. Copy [the inert example](./live-harness-config.example.json) to a private local configuration file. Replace exact repository full name, numeric repository/Owner/App/installation IDs, App client IDs and slugs. Generate a fresh sixteen-character lowercase hexadecimal `runId`, record `ownerAuthorized: true`, and retain `disposable: true`. Default visibility is private; a public lab requires explicit `visibility: "public"`. Numeric values are proposals until authenticated identity readback succeeds. Do not reuse a run ID or put credentials in this JSON.
8. Load `KIRARI_LAB_OWNER_ADMIN_TOKEN` into the local process environment through the Owner's credential tooling. Set `KIRARI_LAB_APP_PRIVATE_KEY_PATH` and `KIRARI_LAB_WRONG_APP_PRIVATE_KEY_PATH` to the two absolute private key file paths. Do not enable shell tracing or print these values. Run from an Owner-local Node process; the CLI refuses GitHub Actions.
9. Run the lab command below with a new report path. Read every expected/observed case result, token revocation and cleanup state. Keep the sanitized report for independent review. Revoke the lab administration credential and remove lab Apps/resources after verification. No production Environment, production publisher opt-in, protection setting, check, exception or merge is configured by these steps. Any later engineering PR with a red required check still needs its own exact-HEAD Owner merge authorization; PR137's one-time exception cannot be reused.

Production public configuration shape (replace all placeholders with actual observations):

```json
{
  "id": 0,
  "clientId": "REPLACE_PRODUCTION_CLIENT_ID",
  "installationId": 0,
  "slug": "replace-production-app-slug"
}
```

```bash
node scripts/root-audit/app-custody-inspect.mjs /absolute/production-app-public.json /absolute/new-production-app-receipt.json
```

Lab run:

```bash
node scripts/root-audit/live-harness.mjs --config /absolute/owner-lab.json --report /absolute/new-lab-report.json
```

The CLI fixes the GitHub API origin and uses a bounded transport. Before a Checks token is issued, it authenticates App ID/client ID/Owner/slug and the selected installation, creates a **metadata-only discovery token** without a repository narrowing parameter, verifies that the complete installation inventory contains exactly the lab, and revokes that token with a 401 readback. It then mints only the exact lab repository's Checks write/Metadata read token, verifies its scope/expiry, and revokes it in `finally`. Installation tokens last at most one hour; the harness does not assume a fixed token length. [Installation token scopes and expiry](https://docs.github.com/en/rest/apps/apps#create-an-installation-access-token-for-an-app).

Every mint request has a custody receipt **before** HTTP starts. Token strings remain only in memory, including tokens returned before invalid permission/expiry validation or a failed discovery-token revoke. Final cleanup retries every known unverified token, deduplicated by App and token identity. If DELETE succeeded but its readback failed, a known-token retry accepts an already-revoked DELETE 401 and still independently verifies GET 401. Recovering token cleanup does not turn the earlier failed run into a PASS.

`tokenCustody` reports only scope, App/installation/repository IDs, permitted permission names, expiry and issuance/revocation status. Lost, malformed or missing mint responses leave `UNKNOWN_ISSUANCE`, `manualOwnerReconciliationRequired: true`, and incomplete credential cleanup. The Owner must reconcile installation credentials or establish actual expiry before reuse; a documented maximum token lifetime is not a verified unknown-token receipt. An App GET failure before minting reports `noMintAttempted`, not credential verification PASS. `cleanup.resourcesComplete` and `cleanup.credentialsComplete` remain separate, and composite cleanup requires both.

## Observations and limits

The harness creates twelve pairs of nonce-owned non-default branches, harmless commits, PRs and selected Owner fixture comments. It creates a disabled ruleset, verifies the complete payload, then enables it **only for the twelve exact lab base refs**. The rule requires the expected App's exact lab context, strict/up-to-date checks, zero approvals, no bypass, and blocks force pushes/deletion. Native merges use the exact expected head SHA and never a bypass flag. Default/main/master branches and unrelated resources are excluded. Authenticated effective-rule readback also detects inherited rules. [Rules REST semantics](https://docs.github.com/en/rest/repos/rules).

| Case | Application/lab observation | Native observation being tested |
|---|---|---|
| Valid decision | Technical PASS, fixture eligibility VALIDATED, production admission BLOCKED | Dedicated-App fixture green permits the disposable merge |
| Expired decision | DENIED, no green published | Missing required App check rejects merge |
| Revoked decision | DENIED after selected comment changes | Earlier green may still permit merge: limitation, `NOT_READY` |
| HEAD/base mutation | Both exact bindings DENIED | Required check missing on current head rejects merge |
| Missing App credentials | Rejected before App HTTP/key mint | Missing required check rejects merge |
| Incorrect App identity | Claimed identity mismatch denied; real second App publishes test green | Expected integration ID rejects wrong-App green |
| Replay | Another fixture's selected decision denied | Missing required check rejects merge |
| Stale successful check | Actual fixture expiry reached after a valid green | Cached green may still permit merge: limitation, `NOT_READY` |
| GitHub API outage | Controlled local client 503 injection denies inspection | Old green persists; this is not a fabricated GitHub service outage |
| Publisher outage | Real token revocation makes publisher write return 401 | Old green persists while publisher cannot invalidate it |
| Recovery after failure | Missing-check merge initially rejected | Independent Owner disables rule, lab recovery merge succeeds, full rule restored |
| Administrator lockout prevention | Failing App check rejects merge | Owner can disable/restore without that check; restored rule still rejects merge |

A PASS assertion for stale-green/outage cases proves the native weakness. It never means continuing expiry/revocation enforcement is ready. Unexpected native behavior, identity/configuration drift, unsupported rulesets, incomplete cleanup, unverified token revocation or any failed assertion makes the run incomplete. In the full harness report, `liveGitHubVerified` becomes true only after a complete successful run using the built-in real GitHub transport. HTTP tests/custom transports always remain synthetic.

Expiry and revocation cases require their exact semantic denial reason. An unrelated API failure or malformed PR/base/comment readback cannot substitute for those observations. The intentional client-outage case also requires the harness's own injected outage code. Unexpected inspection programming errors fail the case with a sanitized error instead of becoming outage evidence.

## Independent lab recovery

If a run stops with a lab rule still present, use the **same exact nonsecret configuration and run ID**, a fresh lab-only Owner administration credential, and these standalone commands. They require no App key/token, green check, review, merge or publisher service. They adopt only the one authenticated ruleset whose exact name, branch list, App/check identity, bypass policy and full parameters match this lab configuration. Unrelated or changed rulesets are refused.

```bash
node scripts/root-audit/live-harness-recovery.mjs --config /absolute/owner-lab.json --mode inspect --report /absolute/new-inspection.json
node scripts/root-audit/live-harness-recovery.mjs --config /absolute/owner-lab.json --mode disable --report /absolute/new-disable.json
node scripts/root-audit/live-harness-recovery.mjs --config /absolute/owner-lab.json --mode restore --report /absolute/new-restore.json
```

Disabling makes only this lab rule inert; restoring writes and reads back the entire reviewed lab payload and effective rules for all twelve bases. These commands do not close PRs, delete refs, merge, or touch production. A real `inspect` receipt establishes authenticated configuration observations only: `liveRecoveryOperationVerified` is false. A real disable/restore receipt may verify that one operation, while `liveRecoveryVerified` and `recoveryCycleVerified` remain false because a single operation does not prove the complete disable/restore recovery cycle. The full harness's failure, disable, native behavior, restore and renewed rejection observations provide the cycle evidence.

If a creation response was lost or malformed, `cleanup.pendingCreations` identifies the nonce-owned uncertain resources and `cleanup.complete` stays false. Reconcile them in the Owner's lab settings before any retry. Do not infer absence from a missing returned ID. If the rule no longer matches the reviewed payload, inspect and disable it directly in that disposable repository's Owner settings; the harness refuses to adopt an untrusted rule.

Normal cleanup independently verifies unchanged default-branch SHA, disables/deletes the owned rule with authenticated absence readback, closes fixture PRs with readback, deletes only run-owned refs with absence readback, and reports incomplete recovery instead of concealing uncertainty. Standalone Owner settings access prevents a failed required check from becoming a recovery dependency. No enforcing production rule may be applied: native atomic continuing authorization is still an unresolved platform gate.

## Engineering verification

```bash
node --test scripts/root-audit/tests/live-harness.test.mjs scripts/root-audit/tests/live-harness-semantic-denial.test.mjs scripts/root-audit/tests/live-harness-token-custody.test.mjs scripts/root-audit/tests/live-harness-recovery.test.mjs scripts/root-audit/tests/live-harness-ruleset.test.mjs
```

These execute the real HTTP transport/orchestrator against an isolated fake GitHub server, including RSA JWT verification, App scope discovery, real request bodies, native-result simulation, token revocation, unsafe target refusals and independent recovery. They are engineering evidence, not live App/protection evidence. The disabled production payload builder also preserves `appIdentityVerified: false`, separate proposed IDs and mandatory real receipts; a numeric ID and an inert payload never unlock activation.
