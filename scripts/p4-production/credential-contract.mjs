import { createHash } from "node:crypto";

export const C1_CREDENTIAL_MANIFEST_INCOMPLETE = "INCOMPLETE_OWNER_SETUP_REQUIRED";
export const C1_OBSERVATION_MAX_AGE_MS = 5 * 60 * 1000;

export const C1_TARGET = Object.freeze({
	team_id: "team_NsBZHGUVnyygP7veiROKLuUx",
	project_id: "prj_QNMVdxTkPOad4ynN4fwFCYEST8Jk",
	project: "kirari-main",
});

export const C1_REQUIRED_EXTENDED_PERMISSIONS = Object.freeze(["Full Production Deployment"]);

export const C1_REQUIRED_CAPABILITY_DISCLOSURES = Object.freeze([
	"Project deployment and management within kirari-main.",
	"Management of kirari-main project domains.",
	"Development and Preview environment settings within kirari-main.",
	"Production-branch deployment where configured.",
	"CLI Production deployment, rollback, and promotion of any accessible deployment in kirari-main, not only the approved immutable artifact.",
]);

export const C1_ENDPOINT_GRANULARITY = "UNKNOWN";
export const C1_ROLE_SCOPE_SEMANTICS = "INFERENCE_NOT_DOCUMENTED_ENDPOINT_BY_ENDPOINT";
export const C1_REVOCATION_PROCEDURE = "Vercel personal Account Settings > Account Tokens: revoke the named credential and confirm its metadata row is revoked or removed; never copy or disclose its value.";

const EVIDENCE_SOURCES = Object.freeze([
	"principal",
	"account_and_plan",
	"direct_and_effective_roles",
	"access_groups_including_directory_sync",
	"extended_permissions",
	"project_scope",
	"token_lifecycle",
]);

const MANIFEST_KEYS = ["schema_version", "status", "claims", "evidence"];
const CLAIM_KEYS = ["principal", "account", "team", "project", "roles", "extended_permissions", "token", "capabilities"];
const APPROVAL_KEYS = ["schema_version", "kind", "decision", "manifest_sha256", "expires_at", "owner", "comment_id", "issue_number", "comment_url", "authenticated", "revocation_status", "revocation_checked_at"];
const STRING_PLACEHOLDERS = new Set(["UNKNOWN", "PENDING", "TBD", "N/A", "NA", "NULL", "REQUIRED", "OWNER_SETUP_REQUIRED", "NOT_PROVIDED"]);

function isRecord(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function canonicalJson(value) {
	if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
	if (typeof value === "number" && Number.isFinite(value) && !Object.is(value, -0)) return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
	if (!isRecord(value)) throw new TypeError("value is not plain JSON data");
	return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

/** Canonical digest for the sanitized manifest only. Owner decisions stay detached. */
export function credentialManifestDigest(manifest) {
	return `sha256:${createHash("sha256").update(canonicalJson(manifest), "utf8").digest("hex")}`;
}

function exactKeys(value, expected, field, errors) {
	if (!isRecord(value)) {
		errors.push(`${field}: must be an object`);
		return false;
	}
	const actual = Object.keys(value).sort();
	const wanted = [...expected].sort();
	if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
		errors.push(`${field}: missing or unexpected fields`);
		return false;
	}
	return true;
}

function nonEmptyString(value, field, errors, max = 256) {
	if (typeof value !== "string" || value.trim().length === 0 || value.length > max || /[\u0000-\u001f\u007f]/.test(value) || STRING_PLACEHOLDERS.has(value.trim().toUpperCase())) {
		errors.push(`${field}: must be a non-empty sanitized string`);
		return false;
	}
	return true;
}

function canonicalUtcMillis(value) {
	if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)) return null;
	const millis = Date.parse(value);
	if (!Number.isFinite(millis)) return null;
	const normalized = new Date(millis).toISOString();
	return normalized === value || normalized.replace(/\.000Z$/, "Z") === value ? millis : null;
}

function hasTokenLikeValue(value) {
	if (typeof value === "string") {
		return /\b(?:vcp|vca)_[A-Za-z0-9_-]{12,}\b/i.test(value)
			|| /\bBearer\s+[A-Za-z0-9._~+\/-]{16,}={0,2}/i.test(value)
			|| /\bgithub_pat_[A-Za-z0-9_]{20,}\b/i.test(value)
			|| /\bgh[pousr]_[A-Za-z0-9]{20,}\b/i.test(value);
	}
	if (Array.isArray(value)) return value.some(hasTokenLikeValue);
	if (isRecord(value)) return Object.values(value).some(hasTokenLikeValue);
	return false;
}

function validateEvidence(evidence, errors) {
	if (!exactKeys(evidence, ["captured_at", "sources", "raw_provider_data_retained", "token_value_retained"], "evidence", errors)) return;
	if (canonicalUtcMillis(evidence.captured_at) === null) errors.push("evidence.captured_at: must be a canonical UTC timestamp");
	if (evidence.raw_provider_data_retained !== false) errors.push("evidence.raw_provider_data_retained: must be false");
	if (evidence.token_value_retained !== false) errors.push("evidence.token_value_retained: must be false");
	if (!exactKeys(evidence.sources, EVIDENCE_SOURCES, "evidence.sources", errors)) return;
	for (const source of EVIDENCE_SOURCES) nonEmptyString(evidence.sources[source], `evidence.sources.${source}`, errors, 512);
}

function validateClaims(claims, nowMs, errors) {
	if (!exactKeys(claims, CLAIM_KEYS, "claims", errors)) return;

	if (exactKeys(claims.principal, ["user_id", "username"], "claims.principal", errors)) {
		nonEmptyString(claims.principal.user_id, "claims.principal.user_id", errors);
		nonEmptyString(claims.principal.username, "claims.principal.username", errors);
	}
	if (exactKeys(claims.account, ["id", "slug", "type"], "claims.account", errors)) {
		nonEmptyString(claims.account.id, "claims.account.id", errors);
		nonEmptyString(claims.account.slug, "claims.account.slug", errors);
		if (claims.account.type !== "personal") errors.push("claims.account.type: must identify the personal account that issued the PAT");
	}
	if (exactKeys(claims.team, ["id", "slug", "plan"], "claims.team", errors)) {
		if (claims.team.id !== C1_TARGET.team_id) errors.push("claims.team.id: does not match the approved team");
		nonEmptyString(claims.team.slug, "claims.team.slug", errors);
		if (!["Pro", "Enterprise"].includes(claims.team.plan)) errors.push("claims.team.plan: must be verified Pro or Enterprise");
	}
	if (exactKeys(claims.project, ["id", "name"], "claims.project", errors)) {
		if (claims.project.id !== C1_TARGET.project_id) errors.push("claims.project.id: does not match the approved project");
		if (claims.project.name !== C1_TARGET.project) errors.push("claims.project.name: does not match the approved project");
	}

	if (exactKeys(claims.roles, ["direct_team_role", "effective_team_role", "effective_project_role", "direct_project_roles", "access_group_evidence_complete", "access_groups"], "claims.roles", errors)) {
		if (claims.roles.direct_team_role !== "Developer") errors.push("claims.roles.direct_team_role: must be Team Developer");
		if (claims.roles.effective_team_role !== "Developer") errors.push("claims.roles.effective_team_role: must be Team Developer without inherited elevation");
		if (claims.roles.effective_project_role !== "Project Developer") errors.push("claims.roles.effective_project_role: must be the documented Team Developer equivalent");
		if (!Array.isArray(claims.roles.direct_project_roles) || claims.roles.direct_project_roles.length !== 0) errors.push("claims.roles.direct_project_roles: must be verified empty");
		if (claims.roles.access_group_evidence_complete !== true) errors.push("claims.roles.access_group_evidence_complete: complete membership and role evidence is required");
		if (!Array.isArray(claims.roles.access_groups)) {
			errors.push("claims.roles.access_groups: complete access-group role list is required");
		} else {
			const groupIds = new Set();
			for (const [index, group] of claims.roles.access_groups.entries()) {
				const field = `claims.roles.access_groups[${index}]`;
				if (!exactKeys(group, ["group_id", "name", "membership_source", "target_project_role"], field, errors)) continue;
				nonEmptyString(group.group_id, `${field}.group_id`, errors);
				nonEmptyString(group.name, `${field}.name`, errors);
				if (groupIds.has(group.group_id)) errors.push(`${field}.group_id: duplicate access group`);
				groupIds.add(group.group_id);
				if (!["DIRECT", "DIRECTORY_SYNC"].includes(group.membership_source)) errors.push(`${field}.membership_source: unknown group membership source`);
				if (!["NONE", "Admin", "Project Developer", "Project Viewer"].includes(group.target_project_role)) errors.push(`${field}.target_project_role: unknown group-derived project role`);
				if (group.target_project_role === "Admin") errors.push(`${field}.target_project_role: group-derived Project Admin elevation is forbidden`);
			}
		}
	}

	if (exactKeys(claims.extended_permissions, ["evidence_complete", "effective"], "claims.extended_permissions", errors)) {
		if (claims.extended_permissions.evidence_complete !== true) errors.push("claims.extended_permissions.evidence_complete: complete effective-grant evidence is required");
		const permissions = claims.extended_permissions.effective;
		if (!Array.isArray(permissions) || permissions.length !== 1 || permissions[0] !== "Full Production Deployment") {
			errors.push("claims.extended_permissions.effective: must contain only Full Production Deployment");
		}
	}

	if (exactKeys(claims.token, ["type", "label", "principal_user_id", "scope", "created_at", "expires_at", "revocation_procedure"], "claims.token", errors)) {
		if (claims.token.type !== "personal_access_token") errors.push("claims.token.type: must be a Vercel personal access token");
		nonEmptyString(claims.token.label, "claims.token.label", errors);
		nonEmptyString(claims.token.principal_user_id, "claims.token.principal_user_id", errors);
		if (claims.token.principal_user_id !== claims.principal?.user_id) errors.push("claims.token.principal_user_id: token owner must match the evidenced principal");
		if (exactKeys(claims.token.scope, ["kind", "team_id", "project_ids"], "claims.token.scope", errors)) {
			if (claims.token.scope.kind !== "project") errors.push("claims.token.scope.kind: must be project-scoped");
			if (claims.token.scope.team_id !== C1_TARGET.team_id) errors.push("claims.token.scope.team_id: does not match the approved team");
			const projectIds = claims.token.scope.project_ids;
			if (!Array.isArray(projectIds) || projectIds.length !== 1 || projectIds[0] !== C1_TARGET.project_id) errors.push("claims.token.scope.project_ids: must contain exactly the approved project");
		}
		const createdAt = canonicalUtcMillis(claims.token.created_at);
		const expiresAt = canonicalUtcMillis(claims.token.expires_at);
		if (createdAt === null && claims.token.created_at !== "NOT_EXPOSED") errors.push("claims.token.created_at: provide the safely exposed UTC creation time or explicitly record NOT_EXPOSED");
		if (expiresAt === null) errors.push("claims.token.expires_at: finite UTC expiry is required");
		else if (expiresAt <= nowMs) errors.push("claims.token.expires_at: credential is expired");
		if (createdAt !== null && expiresAt !== null && expiresAt <= createdAt) errors.push("claims.token.expires_at: must be after token creation");
		if (claims.token.revocation_procedure !== C1_REVOCATION_PROCEDURE) errors.push("claims.token.revocation_procedure: required Owner revocation path is missing or changed");
	}

	if (exactKeys(claims.capabilities, ["same_project", "endpoint_granularity", "role_scope_semantics"], "claims.capabilities", errors)) {
		if (canonicalJson(claims.capabilities.same_project) !== canonicalJson(C1_REQUIRED_CAPABILITY_DISCLOSURES)) errors.push("claims.capabilities.same_project: complete approved capability disclosure is required");
		if (claims.capabilities.endpoint_granularity !== C1_ENDPOINT_GRANULARITY) errors.push("claims.capabilities.endpoint_granularity: endpoint-level rights must remain UNKNOWN");
		if (claims.capabilities.role_scope_semantics !== C1_ROLE_SCOPE_SEMANTICS) errors.push("claims.capabilities.role_scope_semantics: undocumented endpoint intersection must remain an inference");
	}
}

function validateObserved({ observed, manifest, nowMs, errors }) {
	if (!exactKeys(observed, ["authenticated", "observed_at", "sources", "claims"], "observed", errors)) return;
	if (observed.authenticated !== true) errors.push("observed.authenticated: fresh authenticated readback is required");
	const observedAt = canonicalUtcMillis(observed.observed_at);
	if (observedAt === null) errors.push("observed.observed_at: canonical UTC timestamp is required");
	else if (observedAt > nowMs + 30_000 || nowMs - observedAt > C1_OBSERVATION_MAX_AGE_MS) errors.push("observed.observed_at: authenticated role/scope evidence is stale or from the future");
	if (exactKeys(observed.sources, EVIDENCE_SOURCES, "observed.sources", errors)) {
		for (const source of EVIDENCE_SOURCES) nonEmptyString(observed.sources[source], `observed.sources.${source}`, errors, 512);
	}
	if (isRecord(manifest?.claims) && isRecord(observed.claims)) {
		try {
			if (canonicalJson(observed.claims) !== canonicalJson(manifest.claims)) errors.push("observed.claims: fresh sanitized metadata does not exactly match the approved manifest");
		} catch {
			errors.push("observed.claims: must contain only plain JSON metadata");
		}
	} else {
		errors.push("observed.claims: complete sanitized role/scope metadata is required");
	}
}

function validateOwnerDecision(ownerDecision, digest, claims, nowMs, errors) {
	if (!exactKeys(ownerDecision, APPROVAL_KEYS, "ownerDecision", errors)) return;
	const revocationCheckedAt = canonicalUtcMillis(ownerDecision.revocation_checked_at);
	if (ownerDecision.revocation_status !== "CLEAR" || revocationCheckedAt === null || revocationCheckedAt > nowMs || nowMs - revocationCheckedAt > C1_OBSERVATION_MAX_AGE_MS) errors.push("ownerDecision: current authenticated revocation scan is required");
	if (ownerDecision.schema_version !== 1 || ownerDecision.kind !== "C1_CONCRETE_CREDENTIAL_MANIFEST" || ownerDecision.decision !== "APPROVED") errors.push("ownerDecision: authenticated C1 concrete-manifest approval is required");
	if (ownerDecision.authenticated !== true || ownerDecision.owner !== "markd3ng" || ownerDecision.issue_number !== 129) errors.push("ownerDecision: must be the authenticated decision by Owner markd3ng on Issue #129");
	if (!Number.isSafeInteger(ownerDecision.comment_id) || ownerDecision.comment_id <= 0) errors.push("ownerDecision.comment_id: authoritative GitHub comment identity is required");
	const expectedUrl = Number.isSafeInteger(ownerDecision.comment_id) ? `https://github.com/markd3ng/KIRARI/issues/129#issuecomment-${ownerDecision.comment_id}` : null;
	if (ownerDecision.comment_url !== expectedUrl) errors.push("ownerDecision.comment_url: does not identify the authoritative Issue #129 comment");
	if (ownerDecision.manifest_sha256 !== digest) errors.push("ownerDecision.manifest_sha256: does not bind the exact canonical manifest digest");
	const expiresAt = canonicalUtcMillis(ownerDecision.expires_at);
	if (expiresAt === null) errors.push("ownerDecision.expires_at: finite UTC expiry is required");
	else if (expiresAt <= nowMs) errors.push("ownerDecision.expires_at: concrete Owner approval is expired");
	const tokenExpiresAt = canonicalUtcMillis(claims?.token?.expires_at);
	if (expiresAt !== null && tokenExpiresAt !== null && expiresAt > tokenExpiresAt) errors.push("ownerDecision.expires_at: Owner approval cannot outlive the credential");
}

/**
 * Validate C1 before any credential-bearing runtime step. `ownerDecision` must
 * be the return value of the authenticated readConcreteOwnerDecision helper;
 * this function checks that detached result and its exact manifest binding but
 * does not authenticate GitHub itself. `observed` must be freshly assembled
 * from authenticated, sanitized Vercel role/scope readbacks by the caller.
 */
export function validateCredentialContract({ manifest, observed, ownerDecision, nowMs = Date.now() } = {}) {
	const errors = [];
	let manifestDigest = null;
	try {
		manifestDigest = credentialManifestDigest(manifest);
	} catch {
		errors.push("manifest: must contain only plain JSON data");
	}
	if (!isRecord(manifest)) {
		errors.push("manifest: required concrete C1 manifest is missing");
	} else {
		if (!exactKeys(manifest, MANIFEST_KEYS, "manifest", errors)) {
			// Continue validating known fields so failures remain useful and bounded.
		}
		if (manifest.schema_version !== 1) errors.push("manifest.schema_version: unsupported schema");
		if (manifest.status !== "CONCRETE") errors.push(`manifest.status: ${C1_CREDENTIAL_MANIFEST_INCOMPLETE}`);
		validateClaims(manifest.claims, nowMs, errors);
		validateEvidence(manifest.evidence, errors);
		if (hasTokenLikeValue(manifest)) errors.push("manifest: token-like credential material is forbidden");
	}
	validateObserved({ observed, manifest, nowMs, errors });
	validateOwnerDecision(ownerDecision, manifestDigest, manifest?.claims, nowMs, errors);
	return {
		result: errors.length === 0 ? "PASS" : "FAIL",
		manifest_digest: manifestDigest,
		reasons: [...new Set(errors)],
	};
}
