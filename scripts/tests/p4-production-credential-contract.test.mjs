import assert from "node:assert/strict";
import { test } from "node:test";
import { C1_HOBBY_MODEL, C1_REQUIRED_CAPABILITY_DISCLOSURES, C1_REVOCATION_PROCEDURE, C1_TARGET, credentialManifestDigest, validateCredentialContract } from "../p4-production/credential-contract.mjs";
import { C1_PROVIDER_SOURCES } from "../p4-production/credential-provider.mjs";

const nowMs = Date.parse("2026-10-12T04:00:00Z");
const fingerprint = `sha256:${"a".repeat(64)}`;
function fixture() {
	const manifest = {
		schema_version: 2, kind: "C1_CONCRETE_CREDENTIAL_MANIFEST", model: C1_HOBBY_MODEL, status: "CONCRETE",
		owner_approval: { status: "PENDING", comment_id: null, expires_at: null },
		claims: {
			principal: { user_id: "user_fixture", username: "fixture-principal" },
			team: { id: C1_TARGET.team_id, slug: "fixture-team", plan: "Hobby" },
			project: { id: C1_TARGET.project_id, name: C1_TARGET.project },
			token: { type: "personal_access_token", id: "fixture-token-id", label: "fixture-c1", fingerprint_sha256: fingerprint,
				scope: { kind: "project", team_id: C1_TARGET.team_id, project_ids: [C1_TARGET.project_id] },
				created_at: "2026-10-12T02:00:00Z", expires_at: "2026-10-14T02:00:00Z", revocation_procedure: C1_REVOCATION_PROCEDURE },
			capabilities: { same_project: [...C1_REQUIRED_CAPABILITY_DISCLOSURES], endpoint_granularity: "UNKNOWN", scope_semantics: "PROVIDER_PROJECT_SCOPED_PAT" },
		},
		evidence: { captured_at: "2026-10-12T03:00:00Z", sources: { principal: "Owner authenticated /v2/user", team_plan: "Owner authenticated /v2/teams/id", token_metadata: "Owner authenticated /v5/user/tokens/id", project_scope: "Owner authenticated Account Tokens UI selected exact project" }, raw_provider_data_retained: false, token_value_retained: false },
	};
	const project = { id: C1_TARGET.project_id, name: C1_TARGET.project, account_id: C1_TARGET.team_id };
	const observed = { authenticated: true, observed_at: new Date(nowMs).toISOString(), sources: { ...C1_PROVIDER_SOURCES }, credential_sha256: fingerprint, pagination_complete: true, projects: [{ ...project }], project };
	const ownerDecision = { schema_version: 1, kind: "C1_CONCRETE_CREDENTIAL_MANIFEST", decision: "APPROVED", manifest_sha256: credentialManifestDigest(manifest), expires_at: "2026-10-13T04:00:00Z", owner: "markd3ng", comment_id: 123, issue_number: 129, comment_url: "https://github.com/markd3ng/KIRARI/issues/129#issuecomment-123", authenticated: true, revocation_status: "CLEAR", revocation_checked_at: new Date(nowMs).toISOString() };
	return { manifest, observed, ownerDecision, nowMs };
}

test("Hobby C1 passes exact credential/target with setup metadata and fresh scoped project proof", () => {
	const result = validateCredentialContract(fixture());
	assert.equal(result.result, "PASS"); assert.deepEqual(result.reasons, []);
});

for (const [name, change, reason] of [
	["schema1 and its previous decision", x => { x.manifest.schema_version = 1; }, "schema"],
	["old model", x => { x.manifest.model = "C1_ENTERPRISE_RBAC"; }, "model"],
	["wrong project", x => { x.manifest.claims.project.id = "prj_wrong"; }, "claims.project"],
	["wrong team", x => { x.observed.project.account_id = "team_wrong"; }, "observed.project"],
	["wrong name", x => { x.observed.projects[0].name = "kirari-dev"; }, "observed.projects"],
	["unrelated visible project", x => { x.observed.projects.push({ id: "prj_other", name: "other", account_id: C1_TARGET.team_id }); }, "observed.projects"],
	["broad token scope", x => { x.manifest.claims.token.scope.kind = "team"; }, "claims.token.scope"],
	["multi-project ids with project scope", x => { x.manifest.claims.token.scope.project_ids.push("prj_other"); }, "claims.token.scope: only the exact approved project is permitted"],
	["different credential even with only one project", x => { x.observed.credential_sha256 = `sha256:${"b".repeat(64)}`; }, "credential_sha256"],
	["unauthenticated readback", x => { x.observed.authenticated = false; }, "authenticated"],
	["stale proof", x => { x.observed.observed_at = "2026-10-12T03:54:59Z"; }, "observed_at"],
	["future proof", x => { x.observed.observed_at = "2026-10-12T04:01:00Z"; }, "observed_at"],
	["incomplete pagination", x => { x.observed.pagination_complete = false; }, "observed.projects"],
	["malformed provider identity", x => { x.observed.project = null; }, "observed.project"],
	["filtered provider endpoint", x => { x.observed.sources.project_list += "?search=kirari-main"; }, "sources"],
	["expired credential", x => { x.manifest.claims.token.expires_at = "2026-10-12T03:59:59Z"; }, "expires_at"],
	["unbounded credential", x => { x.manifest.claims.token.expires_at = null; }, "expires_at"],
	["unproven creation time", x => { x.manifest.claims.token.created_at = "NOT_EXPOSED"; }, "created_at"],
	["incomplete setup", x => { x.manifest.status = "INCOMPLETE_OWNER_SETUP_REQUIRED"; }, "manifest.status"],
	["missing setup source", x => { x.manifest.evidence.sources.project_scope = null; }, "project_scope"],
	["raw provider retention", x => { x.manifest.evidence.raw_provider_data_retained = true; }, "sanitized"],
	["missing capability disclosure", x => { x.manifest.claims.capabilities.same_project.pop(); }, "capabilities"],
	["invented RBAC", x => { x.manifest.claims.roles = { effective_team_role: "Developer" }; }, "claims"],
	["token-like manifest value", x => { x.manifest.claims.token.label = "vcp_SYNTHETIC_TEST_VALUE_NOT_A_REAL_TOKEN"; }, "token-like"],
	["token-like evidence value", x => { x.observed.sources.project = "Bearer SYNTHETIC_TEST_VALUE_NOT_A_REAL_TOKEN"; }, "token-like"],
	["embedded approval", x => { x.manifest.owner_approval.status = "APPROVED"; }, "owner_approval"],
	["missing Owner decision", x => { x.ownerDecision = null; }, "ownerDecision"],
	["wrong Owner digest", x => { x.ownerDecision.manifest_sha256 = `sha256:${"0".repeat(64)}`; }, "manifest_sha256"],
	["expired Owner decision", x => { x.ownerDecision.expires_at = "2026-10-12T03:59:59Z"; }, "expired"],
	["Owner decision beyond credential lifetime", x => { x.ownerDecision.expires_at = "2026-10-15T04:00:00Z"; }, "outlive"],
	["revoked Owner decision", x => { x.ownerDecision.revocation_status = "REVOKED"; }, "revocation"],
	["stale revocation scan", x => { x.ownerDecision.revocation_checked_at = "2026-10-12T03:54:59Z"; }, "ownerDecision: current authenticated revocation scan is required"],
	["unknown revocation status", x => { x.ownerDecision.revocation_status = "UNKNOWN"; }, "ownerDecision: current authenticated revocation scan is required"],
	["unauthenticated Owner approval", x => { x.ownerDecision.authenticated = false; }, "Owner"],
	["wrong Issue", x => { x.ownerDecision.issue_number = 130; }, "129"],
]) test(`Hobby C1 rejects ${name}`, () => {
	const x = fixture(); change(x);
	if (name !== "wrong Owner digest" && x.ownerDecision) x.ownerDecision.manifest_sha256 = credentialManifestDigest(x.manifest);
	const result = validateCredentialContract(x);
	assert.equal(result.result, "FAIL"); assert.match(result.reasons.join(" "), new RegExp(reason));
	assert.equal(JSON.stringify(result).includes("SYNTHETIC_TEST_VALUE"), false);
});

test("canonical manifest digest ignores object-key order but binds every claim", () => {
	const x = fixture(); const first = credentialManifestDigest(x.manifest);
	const reversed = Object.fromEntries(Object.entries(x.manifest).reverse());
	assert.equal(credentialManifestDigest(reversed), first);
	x.manifest.claims.token.label += "-changed"; assert.notEqual(credentialManifestDigest(x.manifest), first);
});
