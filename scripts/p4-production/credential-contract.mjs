import { createHash } from "node:crypto";

export const C1_CREDENTIAL_MANIFEST_INCOMPLETE = "INCOMPLETE_OWNER_SETUP_REQUIRED";
export const C1_OBSERVATION_MAX_AGE_MS = 5 * 60 * 1000;

export const C1_TARGET = Object.freeze({
	team_id: "team_NsBZHGUVnyygP7veiROKLuUx",
	project_id: "prj_QNMVdxTkPOad4ynN4fwFCYEST8Jk",
	project: "kirari-main",
});

export const C1_HOBBY_MODEL = "C1_HOBBY_PROJECT_SCOPED_PAT";

export const C1_REQUIRED_CAPABILITY_DISCLOSURES = Object.freeze([
	"The PAT can read and write resources belonging to kirari-main; endpoint-level permission granularity is UNKNOWN.",
	"Same-project access can include settings, Production and Preview environment variables, aliases and domains.",
	"Same-project Production deploy, promote and rollback are not limited by the PAT to the approved artifact or this GitHub workflow.",
	"Workflow confinement does not sandbox a compromised credential-bearing process; provider project scope is the cross-project boundary.",
]);
export const C1_ENDPOINT_GRANULARITY = "UNKNOWN";
export const C1_SCOPE_SEMANTICS = "PROVIDER_PROJECT_SCOPED_PAT";
export const C1_REVOCATION_PROCEDURE = "Vercel personal Account Settings > Account Tokens: revoke the named credential and confirm its metadata row is revoked or removed; never copy or disclose its value.";

const EVIDENCE_SOURCES = ["principal", "team_plan", "token_metadata", "project_scope"];
const MANIFEST_KEYS = ["schema_version", "kind", "model", "status", "claims", "evidence", "owner_approval"];
const CLAIM_KEYS = ["principal", "team", "project", "token", "capabilities"];
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

function validateEvidence(evidence, nowMs, errors) {
	if (!exactKeys(evidence, ["captured_at", "sources", "raw_provider_data_retained", "token_value_retained"], "evidence", errors)) return;
	const captured = canonicalUtcMillis(evidence.captured_at);
	if (captured === null || captured > nowMs) errors.push("evidence.captured_at: authenticated setup time is invalid");
	if (evidence.raw_provider_data_retained !== false || evidence.token_value_retained !== false) errors.push("evidence: only sanitized metadata may be retained");
	if (exactKeys(evidence.sources, EVIDENCE_SOURCES, "evidence.sources", errors)) {
		for (const source of EVIDENCE_SOURCES) nonEmptyString(evidence.sources[source], `evidence.sources.${source}`, errors, 512);
	}
}

function validateClaims(claims, nowMs, errors) {
	if (!exactKeys(claims, CLAIM_KEYS, "claims", errors)) return;
	if (exactKeys(claims.principal, ["user_id", "username"], "claims.principal", errors)) {
		nonEmptyString(claims.principal.user_id, "claims.principal.user_id", errors);
		nonEmptyString(claims.principal.username, "claims.principal.username", errors);
	}
	if (exactKeys(claims.team, ["id", "slug", "plan"], "claims.team", errors)) {
		if (claims.team.id !== C1_TARGET.team_id) errors.push("claims.team.id: does not match the approved team");
		nonEmptyString(claims.team.slug, "claims.team.slug", errors);
		if (claims.team.plan !== "Hobby") errors.push("claims.team.plan: this contract requires the verified Hobby target");
	}
	if (exactKeys(claims.project, ["id", "name"], "claims.project", errors)
		&& (claims.project.id !== C1_TARGET.project_id || claims.project.name !== C1_TARGET.project)) errors.push("claims.project: does not match the approved project");
	if (exactKeys(claims.token, ["type", "id", "label", "fingerprint_sha256", "scope", "created_at", "expires_at", "revocation_procedure"], "claims.token", errors)) {
		if (claims.token.type !== "personal_access_token") errors.push("claims.token.type: a personal access token is required");
		nonEmptyString(claims.token.id, "claims.token.id", errors);
		nonEmptyString(claims.token.label, "claims.token.label", errors);
		if (!/^sha256:[a-f0-9]{64}$/.test(claims.token.fingerprint_sha256 ?? "")) errors.push("claims.token.fingerprint_sha256: exact credential binding is required");
		if (exactKeys(claims.token.scope, ["kind", "team_id", "project_ids"], "claims.token.scope", errors)) {
			if (claims.token.scope.kind !== "project" || claims.token.scope.team_id !== C1_TARGET.team_id
				|| !Array.isArray(claims.token.scope.project_ids) || claims.token.scope.project_ids.length !== 1
				|| claims.token.scope.project_ids[0] !== C1_TARGET.project_id) errors.push("claims.token.scope: only the exact approved project is permitted");
		}
		const created = canonicalUtcMillis(claims.token.created_at);
		const expires = canonicalUtcMillis(claims.token.expires_at);
		if (created === null || created > nowMs) errors.push("claims.token.created_at: authenticated creation time is required");
		if (expires === null || expires <= nowMs || (created !== null && expires <= created)) errors.push("claims.token.expires_at: finite unexpired credential lifetime is required");
		if (claims.token.revocation_procedure !== C1_REVOCATION_PROCEDURE) errors.push("claims.token.revocation_procedure: required Owner revocation path is missing or changed");
	}
	if (exactKeys(claims.capabilities, ["same_project", "endpoint_granularity", "scope_semantics"], "claims.capabilities", errors)) {
		if (!Array.isArray(claims.capabilities.same_project) || canonicalJson(claims.capabilities.same_project) !== canonicalJson(C1_REQUIRED_CAPABILITY_DISCLOSURES)) errors.push("claims.capabilities.same_project: complete Hobby capability disclosure is required");
		if (claims.capabilities.endpoint_granularity !== C1_ENDPOINT_GRANULARITY || claims.capabilities.scope_semantics !== C1_SCOPE_SEMANTICS) errors.push("claims.capabilities: provider project scope is not endpoint least privilege");
	}
}

function validateObserved({ observed, manifest, nowMs, errors }) {
	if (!exactKeys(observed, ["authenticated", "observed_at", "sources", "credential_sha256", "pagination_complete", "projects", "project"], "observed", errors)) return;
	if (observed.authenticated !== true) errors.push("observed.authenticated: fresh authenticated readback is required");
	const captured = canonicalUtcMillis(observed.observed_at);
	if (captured === null || captured > nowMs + 30_000 || nowMs - captured > C1_OBSERVATION_MAX_AGE_MS) errors.push("observed.observed_at: provider evidence is stale or invalid");
	if (exactKeys(observed.sources, ["project_list", "project"], "observed.sources", errors)
		&& (observed.sources.project_list !== "https://api.vercel.com/v10/projects"
			|| observed.sources.project !== `https://api.vercel.com/v9/projects/${C1_TARGET.project_id}`)) errors.push("observed.sources: exact unfiltered provider endpoints are required");
	if (observed.credential_sha256 !== manifest?.claims?.token?.fingerprint_sha256) errors.push("observed.credential_sha256: deployed credential differs from the approved credential");
	if (observed.pagination_complete !== true || !Array.isArray(observed.projects) || observed.projects.length !== 1) errors.push("observed.projects: complete visibility of exactly one project is required");
	for (const [label, project] of [["observed.project", observed.project], ...((Array.isArray(observed.projects) ? observed.projects : []).map((project, index) => [`observed.projects[${index}]`, project]))]) {
		if (exactKeys(project, ["id", "name", "account_id"], label, errors)
			&& (project.id !== C1_TARGET.project_id || project.name !== C1_TARGET.project || project.account_id !== C1_TARGET.team_id)) errors.push(`${label}: exact team/project identity does not match`);
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
 * by the authenticated scoped-PAT project reader; user/team/token metadata
 * belongs to the separately Owner-approved setup manifest, not runtime reads.
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
		if (manifest.schema_version !== 2) errors.push("manifest.schema_version: unsupported schema");
		if (manifest.model !== C1_HOBBY_MODEL) errors.push("manifest.model: the exact Hobby model is required");
		if (manifest.kind !== "C1_CONCRETE_CREDENTIAL_MANIFEST") errors.push("manifest.kind: exact C1 manifest kind is required");
		if (exactKeys(manifest.owner_approval, ["status", "comment_id", "expires_at"], "manifest.owner_approval", errors) && (manifest.owner_approval.status !== "PENDING" || manifest.owner_approval.comment_id !== null || manifest.owner_approval.expires_at !== null)) errors.push("manifest.owner_approval: must remain PENDING; authenticated approval stays detached");
		if (manifest.status !== "CONCRETE") errors.push(`manifest.status: ${C1_CREDENTIAL_MANIFEST_INCOMPLETE}`);
		validateClaims(manifest.claims, nowMs, errors);
		validateEvidence(manifest.evidence, nowMs, errors);
		if (hasTokenLikeValue(manifest) || hasTokenLikeValue(observed)) errors.push("C1 evidence: token-like credential material is forbidden");
	}
	validateObserved({ observed, manifest, nowMs, errors });
	validateOwnerDecision(ownerDecision, manifestDigest, manifest?.claims, nowMs, errors);
	return {
		result: errors.length === 0 ? "PASS" : "FAIL",
		manifest_digest: manifestDigest,
		reasons: [...new Set(errors)],
	};
}
