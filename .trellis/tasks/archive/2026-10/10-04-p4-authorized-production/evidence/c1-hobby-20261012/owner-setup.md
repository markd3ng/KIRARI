# Hobby C1 Owner setup — prepared, not authorized/executed

First gate is a new exact merge decision for the remediation PR. Only after that merge proceed through separately authorized Owner UI setup, fresh sanitized C1 manifest, new digest-bound Issue129 Owner approval and exact artifact/target Production authorization. The engineering request authorizes none of the current PAT/Environment/Production operations. No plan upgrade is required.

## Minimal UI actions after the separate setup gate

1. GitHub KIRARI Settings > Environments: create `kirari-site-production`. Configure exactly one required User reviewer, repository Owner `markd3ng`; disable administrator bypass; permit self-review; use a custom branch policy with only branch `main`, not tags. Preserve the reviewed workflow and main Git deployment guard.
2. Vercel personal Account Settings > Account Tokens: select the Hobby team `team_NsBZHGUVnyygP7veiROKLuUx` (`martyjstogner-2766s-projects`), drill into its projects and select only `kirari-main` / `prj_QNMVdxTkPOad4ynN4fwFCYEST8Jk`. Do not select Full Account or All Projects. Use a distinct label and finite expiry.
3. Copy the once-shown value directly into the dedicated GitHub Environment secret `VERCEL_PRODUCTION_TOKEN`. Set Environment vars `VERCEL_PRODUCTION_ORG_ID=team_NsBZHGUVnyygP7veiROKLuUx` and `VERCEL_PRODUCTION_PROJECT_ID=prj_QNMVdxTkPOad4ynN4fwFCYEST8Jk`. Keep the secret absent from repository, organization and other environments. Never paste its value into chat, Issues, files, screenshots, process arguments, commands/history, logs or evidence.
4. While the value is available through a protected local environment, compute only its SHA256 fingerprint with the reviewed `credentialFingerprint(process.env.VERCEL_TOKEN)` export. Record that digest, never the value/prefix/suffix. Do not use an unrelated CLI login as the deployment PAT. Remove the local environment mapping after the setup validation.

## Authenticated setup metadata

Use the Owner/provider authenticated control plane, not the scoped deployment PAT, for `GET /v2/user`, `GET /v2/teams/<team-id>` and `GET /v6/user/tokens` / `GET /v5/user/tokens/<chosen-token-id>`. Retain only principal stable ID/username, exact team ID/slug/Hobby plan, chosen token ID/label/UTC creation and finite expiry. Reject a leaked/revoked or expired token. If those reads are unavailable, stay INCOMPLETE; do not fabricate identity or expiry and do not broaden the scoped token.

The published AuthToken response has user/team scopes but no project-scope field. Record the exact project selection from the authenticated Account Tokens UI as a separate scope source. A team scope entry, token name or403 is not project-scope proof. Bind this setup evidence and the exact credential fingerprint in the schema2 concrete manifest. This is a detached Owner-attested setup record, not a claim the deployment token can introspect itself.

Current template is `../t1-c1/c1-concrete-credential-manifest.json`: schema2, model `C1_HOBBY_PROJECT_SCOPED_PAT`, status INCOMPLETE_OWNER_SETUP_REQUIRED, approval PENDING, missing token/principal/lifecycle/scope evidence. Fill from actual authenticated reads, set status CONCRETE only after independent verification, preserve complete same-project capability disclosures. Token scope does not restrict writes to the approved artifact, workflow, domains, settings or variables; the Owner must separately decide that disclosed risk.

Runtime authenticates the exact credential via unfiltered, bounded complete `GET /v10/projects` and exact `GET /v9/projects/<id>`. It must see only the target and matching team/name; a filtered list or broad substitute credential cannot qualify. Proof max age is5minutes. Revocation/expiry naturally causes provider rejection; finite bound expiry is independently checked. Token fingerprint changes invalidate the decision. No deliberate writes are permission probes.

## New detached decision — Issue129 only

Compute `credentialManifestDigest` for the fully verified CONCRETE manifest. The existing authenticated decision reader requires the entire unedited Owner comment to be this JSON:

```json
{
  "schema_version": 1,
  "kind": "C1_CONCRETE_CREDENTIAL_MANIFEST",
  "decision": "APPROVED",
  "manifest_sha256": "sha256:<actual-complete-manifest-digest>",
  "expires_at": "<finite-UTC-time-no-later-than-token-expiry>"
}
```

This example is NOT an approval or a ready-to-post decision. `owner-decision-draft.json` is explicitly NOT_READY and unposted. Never approve the incomplete template digest. Old C1 policy/approval does not transfer. After the human actually posts the new decision, the separately reviewed reference must point to that exact Issue129 comment; a pending reference cannot authorize runtime.

Any comment edit, deletion/minimization, wrong author/Issue/digest, later Owner statement or revocation, expired decision, incomplete scan or authenticated API error invalidates admission. Existing strict replay/main/artifact/target/15-minute Production authorization, claim, credential-free install, staged validation, explicit promote, alias/health and retained rollback requirements remain.

Trusted Sources and provider Git settings still need their own authenticated readback under the existing deployment contract. The C1 remediation does not certify those settings or an approved rollback record. Do not dispatch `site-production.yml`, select the current candidate, promote, edit aliases/domains, release/tag, close99 or start P5/Gateway.
