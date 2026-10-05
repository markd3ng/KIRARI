import assert from "node:assert/strict";
import { test } from "node:test";
import {
	C1_REQUIRED_CAPABILITY_DISCLOSURES,
	C1_REVOCATION_PROCEDURE,
	C1_TARGET,
	credentialManifestDigest,
	validateCredentialContract,
} from "../p4-production/credential-contract.mjs";

const nowMs = Date.parse("2026-10-05T16:00:00Z");
const observedSources = {
	principal: "authenticated Vercel current-user and Account Tokens readback",
	account_and_plan: "authenticated Vercel account and team plan readback",
	direct_and_effective_roles: "authenticated Vercel team member role readback",
	access_groups_including_directory_sync: "authenticated Vercel Manage Access and Access Groups readback",
	extended_permissions: "authenticated Vercel effective permissions readback",
	project_scope: "authenticated Vercel Account Tokens scope metadata",
	token_lifecycle: "authenticated Vercel Account Tokens creation and expiry metadata",
};

function makeManifest() {
	return {
		schema_version: 1,
		status: "CONCRETE",
		claims: {
			principal: { user_id: "user_c1fixture", username: "deploy-principal" },
			account: { id: "account_fixture", slug: "deploy-principal", type: "personal" },
			team: { id: C1_TARGET.team_id, slug: "kirari-team", plan: "Pro" },
			project: { id: C1_TARGET.project_id, name: C1_TARGET.project },
			roles: {
				direct_team_role: "Developer",
				effective_team_role: "Developer",
				effective_project_role: "Project Developer",
				direct_project_roles: [],
				access_group_evidence_complete: true,
				access_groups: [],
			},
			extended_permissions: {
				evidence_complete: true,
				effective: ["Full Production Deployment"],
			},
			token: {
				type: "personal_access_token",
				label: "kirari-p4-production-c1",
				principal_user_id: "user_c1fixture",
				scope: { kind: "project", team_id: C1_TARGET.team_id, project_ids: [C1_TARGET.project_id] },
				created_at: "2026-10-05T14:00:00Z",
				expires_at: "2026-10-07T14:00:00Z",
				revocation_procedure: C1_REVOCATION_PROCEDURE,
			},
			capabilities: {
				same_project: [...C1_REQUIRED_CAPABILITY_DISCLOSURES],
				endpoint_granularity: "UNKNOWN",
				role_scope_semantics: "INFERENCE_NOT_DOCUMENTED_ENDPOINT_BY_ENDPOINT",
			},
		},
		evidence: {
			captured_at: "2026-10-05T15:55:00Z",
			sources: { ...observedSources },
			raw_provider_data_retained: false,
			token_value_retained: false,
		},
	};
}

function makeObserved(manifest) {
	return {
		authenticated: true,
		observed_at: "2026-10-05T15:59:00Z",
		sources: { ...observedSources },
		claims: structuredClone(manifest.claims),
	};
}

function makeOwnerDecision(manifest, overrides = {}) {
	return {
		schema_version: 1,
		kind: "C1_CONCRETE_CREDENTIAL_MANIFEST",
		decision: "APPROVED",
		manifest_sha256: credentialManifestDigest(manifest),
		expires_at: "2026-10-06T16:00:00Z",
		owner: "markd3ng",
		comment_id: 5997000001,
		issue_number: 129,
		comment_url: "https://github.com/markd3ng/KIRARI/issues/129#issuecomment-5997000001",
		authenticated: true,
		revocation_status: "CLEAR",
		revocation_checked_at: new Date(nowMs).toISOString(),
		...overrides,
	};
}

function reorderObjectKeys(value) {
	if (Array.isArray(value)) return value.map(reorderObjectKeys);
	if (value !== null && typeof value === "object") {
		return Object.fromEntries(Object.entries(value).sort(([left], [right]) => right.localeCompare(left)).map(([key, nested]) => [key, reorderObjectKeys(nested)]));
	}
	return value;
}

function evaluate({ manifest = makeManifest(), observed, ownerDecision, now = nowMs } = {}) {
	return validateCredentialContract({
		manifest,
		observed: observed ?? makeObserved(manifest),
		ownerDecision: ownerDecision ?? makeOwnerDecision(manifest),
		nowMs: now,
	});
}

test("C1 accepts only a complete exact-project Developer plus Full Production Deployment manifest with fresh matching evidence and detached Owner decision", () => {
	const manifest = makeManifest();
	const result = evaluate({ manifest });
	assert.equal(result.result, "PASS");
	assert.match(result.manifest_digest, /^sha256:[a-f0-9]{64}$/);
	assert.deepEqual(result.reasons, []);
	assert.equal(JSON.stringify(result).includes("vcp_"), false);
});

test("C1 records unavailable token creation time explicitly without weakening the required expiry", () => {
	const manifest = makeManifest();
	manifest.claims.token.created_at = "NOT_EXPOSED";
	manifest.evidence.sources.token_lifecycle = "Authenticated Account Tokens row omits creation time; finite expiry is present";
	const result = evaluate({ manifest });
	assert.equal(result.result, "PASS");
	manifest.claims.token.expires_at = "NOT_EXPOSED";
	const missingExpiry = evaluate({ manifest });
	assert.equal(missingExpiry.result, "FAIL");
	assert.match(missingExpiry.reasons.join(" "), /finite UTC expiry/);
});

test("canonical digest ignores object-key order but changes with any C1 claim", () => {
	const manifest = makeManifest();
	const reordered = reorderObjectKeys(manifest);
	assert.match(credentialManifestDigest(manifest), /^sha256:[a-f0-9]{64}$/);
	assert.notEqual(credentialManifestDigest(manifest), credentialManifestDigest({ ...manifest, status: "INCOMPLETE_OWNER_SETUP_REQUIRED" }));
	assert.notEqual(credentialManifestDigest(manifest), credentialManifestDigest({ ...manifest, claims: { ...manifest.claims, token: { ...manifest.claims.token, scope: { ...manifest.claims.token.scope, project_ids: ["prj_other"] } } } }));
	assert.equal(credentialManifestDigest(manifest), credentialManifestDigest(reordered));
});

test("incomplete owner setup cannot pass even with synthetic observed data and an approval-shaped object", () => {
	const manifest = makeManifest();
	manifest.status = "INCOMPLETE_OWNER_SETUP_REQUIRED";
	assert.match(evaluate({ manifest }).reasons.join(" "), /INCOMPLETE_OWNER_SETUP_REQUIRED/);
});

for (const [name, change, expected] of [
	["wrong project ID", (claims) => { claims.project.id = "prj_wrong"; }, /claims\.project\.id/],
	["wrong project name", (claims) => { claims.project.name = "another-project"; }, /claims\.project\.name/],
	["wrong team", (claims) => { claims.team.id = "team_wrong"; }, /claims\.team\.id/],
	["multi-project PAT", (claims) => { claims.token.scope.project_ids.push("prj_other"); }, /exactly the approved project/],
	["team-scoped PAT", (claims) => { claims.token.scope.kind = "team"; }, /project-scoped/],
	["full-account PAT", (claims) => { claims.token.scope.kind = "full-account"; }, /project-scoped/],
	["unknown PAT scope", (claims) => { claims.token.scope.kind = "UNKNOWN"; }, /project-scoped/],
	["wrong scope team", (claims) => { claims.token.scope.team_id = "team_wrong"; }, /scope\.team_id/],
	["Owner team role", (claims) => { claims.roles.direct_team_role = "Owner"; }, /direct_team_role/],
	["Member team role", (claims) => { claims.roles.direct_team_role = "Member"; }, /direct_team_role/],
	["Admin team role", (claims) => { claims.roles.direct_team_role = "Admin"; }, /direct_team_role/],
	["Member effective role", (claims) => { claims.roles.effective_team_role = "Member"; }, /effective_team_role/],
	["Project Admin effective role", (claims) => { claims.roles.effective_project_role = "Project Admin"; }, /effective_project_role/],
	["direct project elevation", (claims) => { claims.roles.direct_project_roles = ["Admin"]; }, /direct_project_roles/],
	["direct Project Admin", (claims) => { claims.roles.direct_project_roles = ["Project Admin"]; }, /direct_project_roles/],
	["group-derived Admin", (claims) => { claims.roles.access_groups = [{ group_id: "ag_1", name: "Admin group", membership_source: "DIRECT", target_project_role: "Admin" }]; }, /group-derived Project Admin/],
	["unknown group role", (claims) => { claims.roles.access_groups = [{ group_id: "ag_1", name: "unknown group", membership_source: "DIRECT", target_project_role: "Unmapped role" }]; }, /unknown group-derived project role/],
	["unknown group source", (claims) => { claims.roles.access_groups = [{ group_id: "ag_1", name: "group", membership_source: "UNKNOWN", target_project_role: "NONE" }]; }, /unknown group membership source/],
	["incomplete group evidence", (claims) => { claims.roles.access_group_evidence_complete = false; }, /complete membership/],
	["missing group evidence field", (claims) => { delete claims.roles.access_groups; }, /missing or unexpected fields/],
	["extra extended permission", (claims) => { claims.extended_permissions.effective.push("Environment Variable Manager"); }, /only Full Production Deployment/],
	["missing extended permission evidence", (claims) => { claims.extended_permissions.evidence_complete = false; }, /complete effective-grant evidence/],
	["missing plan", (claims) => { claims.team.plan = null; }, /team\.plan/],
	["unsupported plan", (claims) => { claims.team.plan = "Hobby"; }, /team\.plan/],
	["missing principal identity", (claims) => { claims.principal.user_id = ""; }, /principal\.user_id/],
	["placeholder principal identity", (claims) => { claims.principal.user_id = "UNKNOWN"; }, /principal\.user_id/],
	["placeholder account identity", (claims) => { claims.account.id = "PENDING"; }, /account\.id/],
	["token from a different principal", (claims) => { claims.token.principal_user_id = "user_other"; }, /token owner must match/],
	["missing token expiry", (claims) => { claims.token.expires_at = null; }, /finite UTC expiry/],
	["expired token", (claims) => { claims.token.expires_at = "2026-10-05T15:59:59Z"; }, /credential is expired/],
	["unbounded token expiry", (claims) => { claims.token.expires_at = "never"; }, /finite UTC expiry/],
	["missing token creation metadata", (claims) => { claims.token.created_at = null; }, /explicitly record NOT_EXPOSED/],
	["wrong account type", (claims) => { claims.account.type = "team"; }, /personal account/],
	["missing same-project capability disclosure", (claims) => { claims.capabilities.same_project.pop(); }, /complete approved capability disclosure/],
	["endpoint certainty invented", (claims) => { claims.capabilities.endpoint_granularity = "DENIED"; }, /must remain UNKNOWN/],
	["endpoint scope semantics asserted as fact", (claims) => { claims.capabilities.role_scope_semantics = "PROVEN"; }, /must remain an inference/],
]) {
	test(`C1 rejects ${name}`, () => {
		const manifest = makeManifest();
		change(manifest.claims);
		const result = evaluate({ manifest });
		assert.equal(result.result, "FAIL");
		assert.match(result.reasons.join("\n"), expected);
	});
}

test("C1 rejects missing or substituted detached Owner approval", () => {
	const manifest = makeManifest();
	const observed = makeObserved(manifest);
	assert.match(validateCredentialContract({ manifest, observed, nowMs }).reasons.join(" "), /ownerDecision/);
	assert.match(evaluate({ manifest, ownerDecision: makeOwnerDecision(manifest, { manifest_sha256: `sha256:${"0".repeat(64)}` }) }).reasons.join(" "), /does not bind/);
	assert.match(evaluate({ manifest, ownerDecision: makeOwnerDecision(manifest, { issue_number: 130 }) }).reasons.join(" "), /Issue #129/);
	assert.match(evaluate({ manifest, ownerDecision: makeOwnerDecision(manifest, { owner: "other-user" }) }).reasons.join(" "), /Owner markd3ng/);
	assert.match(evaluate({ manifest, ownerDecision: makeOwnerDecision(manifest, { authenticated: false }) }).reasons.join(" "), /authenticated decision/);
	assert.match(evaluate({ manifest, ownerDecision: makeOwnerDecision(manifest, { expires_at: "2026-10-05T15:00:00Z" }) }).reasons.join(" "), /approval is expired/);
	assert.match(evaluate({ manifest, ownerDecision: makeOwnerDecision(manifest, { approved: true }) }).reasons.join(" "), /missing or unexpected fields/);
});

test("C1 rejects unknown or pending identity and evidence placeholders", () => {
	const manifest = makeManifest();
	manifest.evidence.sources.principal = "UNKNOWN";
	assert.match(evaluate({ manifest }).reasons.join(" "), /evidence\.sources\.principal/);
	const observed = makeObserved(manifest);
	observed.sources.direct_and_effective_roles = "PENDING";
	assert.match(evaluate({ manifest, observed }).reasons.join(" "), /observed\.sources\.direct_and_effective_roles/);
});

test("C1 rejects stale, unauthenticated, or changed use-time readback", () => {
	const manifest = makeManifest();
	const observed = makeObserved(manifest);
	assert.match(evaluate({ manifest, observed: { ...observed, authenticated: false } }).reasons.join(" "), /authenticated readback/);
	assert.match(evaluate({ manifest, observed: { ...observed, observed_at: "2026-10-05T15:50:00Z" } }).reasons.join(" "), /stale or from the future/);
	const changedClaims = structuredClone(observed);
	changedClaims.claims.roles.direct_team_role = "Owner";
	assert.match(evaluate({ manifest, observed: changedClaims }).reasons.join(" "), /does not exactly match/);
	const missingSources = structuredClone(observed);
	delete missingSources.sources.access_groups_including_directory_sync;
	assert.match(evaluate({ manifest, observed: missingSources }).reasons.join(" "), /observed\.sources: missing or unexpected fields/);
});

test("C1 rejects secret-bearing or schema-extended metadata", () => {
	const manifest = makeManifest();
	manifest.claims.token.value = "vcp_sensitivecredentialmaterial123456";
	assert.match(evaluate({ manifest }).reasons.join(" "), /token: missing or unexpected fields/);
	assert.match(evaluate({ manifest }).reasons.join(" "), /token-like credential material/);
});

test("Owner approval may not outlive the credential", () => {
	const manifest = makeManifest();
	const ownerDecision = makeOwnerDecision(manifest, { expires_at: "2026-10-08T00:00:00Z" });
	assert.match(evaluate({ manifest, ownerDecision }).reasons.join(" "), /cannot outlive the credential/);
});


test("C1 rejects missing or stale current revocation scan", () => {
	const manifest = makeManifest();
	for (const overrides of [{revocation_status:"UNKNOWN"},{revocation_checked_at:"2026-10-05T00:00:00Z"}]) {
		assert.equal(evaluate({manifest,ownerDecision:makeOwnerDecision(manifest,overrides)}).result,"FAIL");
	}
});
