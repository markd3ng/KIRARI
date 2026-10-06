import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, readlinkSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

export const TOOLING_AUDIT_COMMAND = "npm audit --prefix scripts/p4-production/tooling --audit-level moderate";
export const TOOLING_AUDIT_JSON_COMMAND = `${TOOLING_AUDIT_COMMAND} --json`;
export const TOOLING_TREE_FINGERPRINT_ALGORITHM = "kirari-p4-installed-tree-v2";
export const TOOLING_CLI_PACKAGE = "vercel";
export const TOOLING_CLI_VERSION = "62.2.0";
export const TOOLING_INSTALL_COMMAND = "npm ci --prefix scripts/p4-production/tooling --registry=https://registry.npmjs.org";
export const TOOLING_ENTRYPOINT = "scripts/p4-production/tooling/node_modules/.bin/vercel";
export const TOOLING_RESOLVED_ENTRYPOINT = "scripts/p4-production/tooling/node_modules/vercel/dist/vc.js";
export const TOOLING_DEPLOY_ARGS = ["deploy", "--prebuilt", "--prod", "--skip-domain", "--yes"];
export const TOOLING_METADATA_FIELDS = ["githubCommitOrg", "githubCommitRef", "githubCommitRepo", "githubCommitSha", "githubDeployment", "githubOrg", "githubRepo"];
export const TOOLING_MATERIAL_SOURCE_PATHS = [
	".github/workflows/ci.yml",
	".github/workflows/site-production.yml",
	"package.json",
	"pnpm-lock.yaml",
	"pnpm-workspace.yaml",
	"scripts/p3-browser/package.json",
	"scripts/p3-browser/package-lock.json",
	"scripts/p4-production/run.mjs",
	"scripts/p4-production/runtime-adapter.mjs",
	"scripts/deploy-vercel-production.mjs",
	"scripts/p4-production/tooling-gate.mjs",
	"scripts/p4-production/tooling-install.mjs",
	"scripts/p4-production/npm-runtime.mjs",
	"scripts/p4-production/tooling-acceptance.mjs",
	"scripts/p4-production/owner-decision.mjs",
	"scripts/p4-production/credential-gate.mjs",
	"scripts/p4-production/credential-contract.mjs",
	".nvmrc",
	"scripts/p4-production/tooling/package.json",
	"scripts/p4-production/tooling/package-lock.json",
];

const SHA256 = /^sha256:[0-9a-f]{64}$/;
const REQUIRED_UNKNOWN_PATHS = [
	"complete startup/import reachability for each vulnerable package",
	"install lifecycle/postinstall persistence from the shared job workspace or process state into the later credential-bearing deploy step",
	"dynamic, fallback, and native-binary path reachability",
	"complete per-advisory reachability through prebuilt deploy command processing",
	"bundled CLI code attribution outside npm lockfile audit coverage",
	"whole-tree registry signature verification after Sigstore TUF fetch failure",
	"published CLI source/build provenance and complete package SBOM",
	"non-Node executable lookup through inherited credential-step PATH",
	"Node/npm runtime vulnerability coverage beyond the deployment-tool lock audit",
	"whole Node runtime content digest and source/build provenance are not attested",
];
const REQUIRED_INVALIDATION_TRIGGERS = [
	"new_or_changed_advisory_or_audit_inventory",
	"CLI_version_or_support_status_change",
	"package_lock_tarball_integrity_signature_or_installed_tree_change",
	"Node_or_npm_runtime_change",
	"runner_OS_architecture_image_or_version_change",
	"install_command_mode_lifecycle_or_credential_order_change",
	"CLI_entrypoint_flags_or_material_source_hash_change",
	"target_team_project_or_allowed_command_change",
	"independent_review_change_or_revocation",
	"owner_decision_expiry_or_revocation",
	"new_reachability_or_supply_chain_evidence",
	"C1_scope_or_capability_change",
];
const EXPECTED_POLICY_FRAMEWORK = {
	status: "APPROVED",
	issue_number: 130,
	proposal_comment_id: 5996717676,
	approval_comment_id: 5997088875,
	approval_comment_url: "https://github.com/markd3ng/KIRARI/issues/130#issuecomment-5997088875",
	scope: "T1 policy framework only; no concrete CLI or advisory approval",
};

function sorted(value) {
	if (Array.isArray(value)) return value.map(sorted);
	if (value && typeof value === "object") {
		return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]));
	}
	return value;
}

function canonicalJson(value) {
	return JSON.stringify(sorted(value));
}

function sha256(value) {
	return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sameJson(left, right) {
	return canonicalJson(left) === canonicalJson(right);
}

function rawText(value) {
	if (typeof value === "string") return value;
	if (Buffer.isBuffer(value)) return value.toString("utf8");
	if (value && typeof value.rawText === "string") return value.rawText;
	return null;
}

function auditReport(value) {
	const text = rawText(value);
	if (text === null) throw new Error("AUDIT_RAW_JSON_TEXT_REQUIRED");
	const report = JSON.parse(text);
	const vulnerabilityCounts = report?.metadata?.vulnerabilities;
	const dependencyCounts = report?.metadata?.dependencies;
	const countFields = ["info", "low", "moderate", "high", "critical", "total"];
	const dependencyFields = ["prod", "dev", "optional", "peer", "peerOptional", "total"];
	if (!report || typeof report !== "object" || report.auditReportVersion !== 2 || report.error || !report.vulnerabilities || typeof report.vulnerabilities !== "object" || !vulnerabilityCounts || !dependencyCounts ||
		!countFields.every((key) => Number.isSafeInteger(vulnerabilityCounts[key]) && vulnerabilityCounts[key] >= 0) ||
		!dependencyFields.every((key) => Number.isSafeInteger(dependencyCounts[key]) && dependencyCounts[key] >= 0) ||
		countFields.slice(0, -1).reduce((sum, key) => sum + vulnerabilityCounts[key], 0) !== vulnerabilityCounts.total) {
		throw new Error("AUDIT_REPORT_INCOMPLETE");
	}
	for (const [name, entry] of Object.entries(report.vulnerabilities)) {
		const fixIsValid = typeof entry?.fixAvailable === "boolean" || entry?.fixAvailable && typeof entry.fixAvailable === "object" && !Array.isArray(entry.fixAvailable) && typeof entry.fixAvailable.isSemVerMajor === "boolean" && (entry.fixAvailable.name === undefined || typeof entry.fixAvailable.name === "string") && (entry.fixAvailable.version === undefined || typeof entry.fixAvailable.version === "string");
		if (!entry || entry.name !== name || !["info", "low", "moderate", "high", "critical"].includes(entry.severity) || typeof entry.isDirect !== "boolean" || !Array.isArray(entry.via) || entry.via.length === 0 || !Array.isArray(entry.nodes) || entry.nodes.length === 0 || !entry.nodes.every((node) => typeof node === "string" && node.length > 0) || !Array.isArray(entry.effects) || !entry.effects.every((effect) => typeof effect === "string" && effect.length > 0) || typeof entry.range !== "string" || entry.range.length === 0 || !Object.hasOwn(entry, "fixAvailable") || !fixIsValid) {
			throw new Error("AUDIT_ADVISORY_RECORD_INCOMPLETE");
		}
		if (!entry.via.every((item) => typeof item === "string" && item.length > 0 || item && typeof item === "object" && !Array.isArray(item) && ["info", "low", "moderate", "high", "critical"].includes(item.severity) && (typeof item.url === "string" && item.url.length > 0 || Number.isSafeInteger(item.source) && item.source > 0) && (item.range === undefined || typeof item.range === "string"))) {
			throw new Error("AUDIT_ADVISORY_REFERENCE_INCOMPLETE");
		}
	}
	const observedVulnerabilityCounts = Object.fromEntries(["info", "low", "moderate", "high", "critical"].map((severity) => [severity, Object.values(report.vulnerabilities).filter((entry) => entry.severity === severity).length]));
	if (["info", "low", "moderate", "high", "critical"].some((severity) => observedVulnerabilityCounts[severity] !== vulnerabilityCounts[severity]) || Object.keys(report.vulnerabilities).length !== vulnerabilityCounts.total) {
		throw new Error("AUDIT_VULNERABILITY_COUNTS_INCONSISTENT");
	}
	return { text, report };
}

function advisoryId(via) {
	if (typeof via?.url === "string") {
		const tail = via.url.split(/[/?#]/).filter(Boolean).at(-1);
		if (tail) return tail;
	}
	return via?.source === undefined ? "ID_NOT_PUBLISHED_IN_AUDIT_OBJECT" : `npm-audit-source:${via.source}`;
}

function formattedJson(value) {
	return JSON.stringify(sorted(value), null, 2);
}

/** Builds a deterministic, readable inventory without dropping npm audit fields. */
export function createAdvisoryInventory(auditJson) {
	const { text, report } = auditReport(auditJson);
	const packageNames = Object.keys(report.vulnerabilities).sort();
	const counts = { ...report.metadata.vulnerabilities };
	const details = [];
	const advisoryRecords = [];
	for (const name of packageNames) {
		const entry = report.vulnerabilities[name];
		const via = Array.isArray(entry.via) ? entry.via : [];
		for (const reference of via) {
			const record = {
				package_name: name,
				is_direct: entry.isDirect,
				advisory_id: typeof reference === "string" ? "INHERITED_OR_TRANSITIVE_REFERENCE" : advisoryId(reference),
				severity: entry.severity,
				affected_range: entry.range,
				advisory_range: typeof reference === "string" ? "UNKNOWN_NOT_STRUCTURED_IN_NPM_AUDIT" : reference.range ?? "UNKNOWN_NOT_PUBLISHED_IN_AUDIT_OBJECT",
				paths: [...entry.nodes].sort(),
				effects: [...entry.effects].sort(),
				fix_available: entry.fixAvailable,
				via_reference: reference,
			};
			if (typeof reference === "string") record.via_dependency = reference;
			record.record_id = sha256(canonicalJson(record));
			advisoryRecords.push(record);
		}
		details.push({ name, entry });
	}
	const objectAdvisoryRecordCount = advisoryRecords.filter((record) => record.via_reference && typeof record.via_reference === "object").length;

	const lines = [
		"# Complete npm audit advisory inventory",
		"",
		"This file is generated from the retained raw `npm audit --audit-level moderate --json` report. Each package entry preserves all fields returned by npm, including every advisory object, dependency path, affected range, effect, and remediation proposal.",
		"",
		`- Raw npm audit report SHA-256: \`${sha256(text)}\``,
		`- npm audit report schema version: ${String(report.auditReportVersion ?? "UNKNOWN")}`,
		`- Vulnerable package entries: ${packageNames.length}`,
		`- Advisory objects in package entries: ${objectAdvisoryRecordCount}`,
		`- Total advisory and inherited/transitive references: ${advisoryRecords.length}`,
		`- npm reported vulnerability counts: ${formattedJson(counts)}`,
		`- npm reported dependency counts: ${formattedJson(report.metadata.dependencies ?? {})}`,
		"",
		"Counts are npm's package-level audit metadata; package entries and advisory objects are not counts of unique CVEs.",
		"",
	];

	for (const { name, entry } of details) {
		const nodes = Array.isArray(entry.nodes) ? [...entry.nodes].sort() : [];
		const effects = Array.isArray(entry.effects) ? [...entry.effects].sort() : [];
		lines.push(
			`## ${name}`,
			"",
			`- Severity: ${entry.severity ?? "UNKNOWN"}`,
			`- Affected package range: ${entry.range ?? "UNKNOWN"}`,
			`- Installed dependency path${nodes.length === 1 ? "" : "s"}: ${nodes.length ? nodes.map((node) => `\`${node}\``).join(", ") : "UNKNOWN"}`,
			`- Direct dependency: ${entry.isDirect === true ? "yes" : entry.isDirect === false ? "no" : "UNKNOWN"}`,
			`- Fixed-version/remediation proposal: ${entry.fixAvailable === undefined ? "UNKNOWN" : `\`${JSON.stringify(entry.fixAvailable)}\``}`,
			`- Affected dependents: ${effects.length ? effects.map((item) => `\`${item}\``).join(", ") : "none reported"}`,
			"- Advisory IDs and full npm package record:",
			"",
			"```json",
			formattedJson({
				advisory_ids: (Array.isArray(entry.via) ? entry.via : []).map((item) => typeof item === "string" ? { dependency: item, advisory_id: "INHERITED_OR_TRANSITIVE_REFERENCE" } : { advisory_id: advisoryId(item), ...item }),
				...entry,
			}),
			"```",
			"",
		);
	}

	const inventoryText = `${lines.join("\n")}\n`;
	return {
		text: inventoryText,
		sha256: sha256(inventoryText),
		packageEntryCount: packageNames.length,
		advisoryRecordCount: objectAdvisoryRecordCount,
		advisoryReferenceCount: advisoryRecords.length,
		advisoryRecords,
		counts,
		auditJsonSha256: sha256(text),
	};
}

/**
 * Fingerprints every installed entry by sorted relative path, type, permission
 * bits, file contents, and symlink target. Symlinks are recorded, never followed.
 */
export function fingerprintInstalledTree(nodeModulesRoot) {
	const root = resolve(nodeModulesRoot);
	const rootStat = lstatSync(root);
	if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error("TOOLING_TREE_ROOT_NOT_DIRECTORY");
	const entries = [];
	const visit = (directory) => {
		const names = readdirSync(directory).sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
		for (const name of names) {
			const path = join(directory, name);
			const stat = lstatSync(path);
			const relativePath = relative(root, path).split(sep).join("/");
			const entry = { path: relativePath, mode: stat.mode & 0o777 };
			if (stat.isDirectory()) {
				entry.type = "directory";
				entries.push(entry);
				visit(path);
			} else if (stat.isFile()) {
				entry.type = "file";
				entry.content_sha256 = sha256(readFileSync(path));
				entries.push(entry);
			} else if (stat.isSymbolicLink()) {
				entry.type = "symlink";
				entry.target = readlinkSync(path);
				entries.push(entry);
			} else {
				entry.type = "special";
				entry.rdev = stat.rdev;
				entries.push(entry);
			}
		}
	};
	visit(root);
	return sha256(canonicalJson({ algorithm: TOOLING_TREE_FINGERPRINT_ALGORITHM, root_mode: rootStat.mode & 0o777, entries }));
}

export function toolingManifestDigest(manifest) {
	return sha256(canonicalJson(manifest));
}

function isIsoUtc(value) {
	return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) && Number.isFinite(Date.parse(value));
}

function currentTime(value) {
	if (value instanceof Date) return value.getTime();
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string") return Date.parse(value);
	return Date.now();
}

function parseReview(value) {
	if (typeof value === "string") return { text: value, review: JSON.parse(value) };
	if (Buffer.isBuffer(value)) {
		const text = value.toString("utf8");
		return { text, review: JSON.parse(text) };
	}
	if (value && typeof value.rawText === "string") return { text: value.rawText, review: JSON.parse(value.rawText) };
	if (value && typeof value === "object") return { text: canonicalJson(value), review: value };
	return null;
}

function fail(list, code) {
	if (!list.includes(code)) list.push(code);
}

function exactSection(manifest, observed, section, failures, fields = null) {
	const expected = manifest?.[section];
	const actual = observed?.[section];
	if (!expected || !actual || typeof expected !== "object" || typeof actual !== "object") {
		fail(failures, `OBSERVED_${section.toUpperCase()}_MISSING`);
		return;
	}
	if (fields) {
		const pick = (value) => Object.fromEntries(fields.map((field) => [field, value[field]]));
		if (!sameJson(pick(expected), pick(actual))) fail(failures, `${section.toUpperCase()}_MISMATCH`);
	} else if (!sameJson(expected, actual)) {
		fail(failures, `${section.toUpperCase()}_MISMATCH`);
	}
}

function ownerDecisionIsValid({ ownerApproval, digest, proposedExpiry, now }) {
	if (!ownerApproval || ownerApproval.authenticated !== true || ownerApproval.owner !== "markd3ng" || ownerApproval.issue_number !== 130 || ownerApproval.kind !== "T1_CONCRETE_TOOLING_MANIFEST" || ownerApproval.decision !== "APPROVED") return false;
	if (ownerApproval.manifest_sha256 !== digest || ownerApproval.revoked === true) return false;
	if (ownerApproval.revocation_status !== "CLEAR" || !isIsoUtc(ownerApproval.revocation_checked_at)) return false;
	const revocationCheckedAt = Date.parse(ownerApproval.revocation_checked_at);
	if (revocationCheckedAt > now || now - revocationCheckedAt > 5 * 60_000) return false;
	if (ownerApproval.comment_id === undefined || ownerApproval.comment_id === null || String(ownerApproval.comment_id).length === 0) return false;
	if (typeof ownerApproval.comment_url !== "string" || !ownerApproval.comment_url.startsWith("https://github.com/markd3ng/KIRARI/issues/130#issuecomment-")) return false;
	if (!isIsoUtc(ownerApproval.expires_at) || !isIsoUtc(proposedExpiry)) return false;
	const expires = Date.parse(ownerApproval.expires_at);
	return expires <= Date.parse(proposedExpiry) && now < expires;
}

function reviewIsValid({ reviewInput, manifest, inventory, rawAuditSha256, failures }) {
	const expected = manifest?.independent_review;
	if (!expected || !SHA256.test(expected.sha256 ?? "")) {
		fail(failures, "INDEPENDENT_REVIEW_MISSING");
		return;
	}
	let parsed;
	try { parsed = parseReview(reviewInput); } catch { parsed = null; }
	if (!parsed) {
		fail(failures, "INDEPENDENT_REVIEW_MISSING");
		return;
	}
	if (sha256(parsed.text) !== expected.sha256) fail(failures, "INDEPENDENT_REVIEW_HASH_MISMATCH");
	const review = parsed.review;
	if (review?.schema_version !== 1 || review?.review_complete !== true || review?.reviewer_independent !== true) fail(failures, "INDEPENDENT_REVIEW_INCOMPLETE");
	if (typeof review?.reviewer_identity !== "string" || review.reviewer_identity.trim().length === 0 || !isIsoUtc(review?.reviewed_at)) fail(failures, "INDEPENDENT_REVIEW_ATTRIBUTION_MISSING");
	if (!new Set(["PASS", "REVIEWED_WITH_EXPOSED_RESIDUAL_RISK"]).has(review?.result)) fail(failures, "INDEPENDENT_REVIEW_RESULT_INVALID");
	if (review?.audit_json_sha256 !== rawAuditSha256 || review?.inventory_sha256 !== inventory.sha256) fail(failures, "INDEPENDENT_REVIEW_AUDIT_BINDING_MISMATCH");
	const candidate = manifest?.candidate ?? {};
	const reviewedCandidate = review?.candidate ?? {};
	for (const key of ["cli_package", "cli_version", "package_lock_sha256", "tarball_integrity", "tarball_sha256"]) {
		if (reviewedCandidate[key] !== candidate[key]) fail(failures, "INDEPENDENT_REVIEW_CANDIDATE_MISMATCH");
	}
	if (!sameJson(review?.runtime, manifest?.runtime) || !sameJson(review?.install, manifest?.install) || !sameJson(review?.execution, manifest?.execution) || !sameJson(review?.target, manifest?.target)) fail(failures, "INDEPENDENT_REVIEW_SCOPE_MISMATCH");
	if (review?.installed_tree_sha256 !== manifest?.installed_tree?.sha256 || review?.installed_tree_platform_scope !== manifest?.installed_tree?.platform_scope) fail(failures, "INDEPENDENT_REVIEW_TREE_BINDING_MISMATCH");
	if (review?.unknown_paths_treated_as_exposed !== true) fail(failures, "INDEPENDENT_REVIEW_UNKNOWN_PATHS_NOT_EXPOSED");
	if (!Array.isArray(review?.unknown_paths) || !REQUIRED_UNKNOWN_PATHS.every((path) => review.unknown_paths.includes(path))) fail(failures, "INDEPENDENT_REVIEW_UNKNOWN_PATH_INVENTORY_INCOMPLETE");
	if (review?.reviewed_package_entries !== inventory.packageEntryCount || review?.reviewed_advisory_objects !== inventory.advisoryRecordCount || review?.reviewed_advisory_references !== inventory.advisoryReferenceCount) fail(failures, "INDEPENDENT_REVIEW_ADVISORY_COVERAGE_INCOMPLETE");
	const reviewRows = review?.advisory_reviews ?? review?.advisory_challenges;
	if (!Array.isArray(reviewRows) || reviewRows.length !== inventory.advisoryRecords.length) {
		fail(failures, "INDEPENDENT_REVIEW_ADVISORY_MATRIX_INCOMPLETE");
	} else {
		const expectedRecords = new Map(inventory.advisoryRecords.map((record) => [record.record_id, record]));
		const seen = new Set();
		for (const row of reviewRows) {
			if (!row || typeof row !== "object" || typeof row.record_id !== "string" || seen.has(row.record_id)) {
				fail(failures, "INDEPENDENT_REVIEW_ADVISORY_MATRIX_INVALID");
				continue;
			}
			seen.add(row.record_id);
			const sourceRecord = expectedRecords.get(row.record_id);
			if (!sourceRecord) {
				fail(failures, "INDEPENDENT_REVIEW_ADVISORY_MATRIX_SUBSTITUTED");
				continue;
			}
			const boundFields = ["record_id", "package_name", "is_direct", "advisory_id", "severity", "affected_range", "advisory_range", "paths", "effects", "fix_available", "via_reference"];
			if (typeof sourceRecord.via_dependency === "string") boundFields.push("via_dependency");
			const bound = Object.fromEntries(boundFields.map((field) => [field, row[field]]));
			if (!sameJson(bound, sourceRecord)) fail(failures, "INDEPENDENT_REVIEW_ADVISORY_MATRIX_BINDING_MISMATCH");
			const analysisKey = sourceRecord.via_dependency ?? sourceRecord.advisory_id;
			if (typeof row.analysis !== "string" || row.analysis.trim().length < 40 || !row.analysis.includes(sourceRecord.package_name) || !row.analysis.includes(analysisKey)) fail(failures, "INDEPENDENT_REVIEW_ADVISORY_ANALYSIS_MISSING");
			if (!["EXPOSED", "UNKNOWN_EXPOSED", "NOT_REACHABLE_WITH_EVIDENCE"].includes(row.reachability)) fail(failures, "INDEPENDENT_REVIEW_ADVISORY_REACHABILITY_MISSING");
			if (row.reachability === "NOT_REACHABLE_WITH_EVIDENCE" && (!Array.isArray(row.reachability_evidence) || row.reachability_evidence.length === 0 || !row.reachability_evidence.every((item) => item && typeof item.source === "string" && item.source.length > 0 && SHA256.test(item.source_sha256 ?? "") && typeof item.finding === "string" && item.finding.length > 0))) fail(failures, "INDEPENDENT_REVIEW_REACHABILITY_EVIDENCE_MISSING");
		}
		if (seen.size !== expectedRecords.size) fail(failures, "INDEPENDENT_REVIEW_ADVISORY_MATRIX_OMITTED_FINDING");
	}
	const assessments = review?.assessments;
	const requiredAssessments = ["install_time_execution", "startup_import_execution", "fixed_deploy_command", "local_artifact_and_config_parsing", "network_response_parsing", "archive_extraction", "fallback_and_dynamic_paths", "credential_before_and_after_mapping", "c1_blast_radius"];
	if (!assessments || !requiredAssessments.every((name) => typeof assessments[name] === "string" && assessments[name].length > 0)) fail(failures, "INDEPENDENT_REVIEW_ASSESSMENTS_INCOMPLETE");
}

/** Evaluates an exact T1 candidate while preserving npm's raw result verbatim. */
export function evaluateToolingAcceptance({ auditExitCode, auditJson, manifest, ownerApproval, independentReview, observed, now } = {}) {
	const failures = [];
	const rawAuditResult = Number.isInteger(auditExitCode) ? (auditExitCode === 0 ? "PASS" : "FAIL") : "FAIL";
	if (!Number.isInteger(auditExitCode) || auditExitCode < 0) fail(failures, "RAW_AUDIT_EXIT_CODE_MISSING");
	if (Number.isInteger(auditExitCode) && auditExitCode > 1) fail(failures, "RAW_AUDIT_OPERATIONAL_ERROR");
	if (!manifest || manifest.schema_version !== 1 || manifest.kind !== "T1_CONCRETE_TOOLING_MANIFEST") fail(failures, "CONCRETE_T1_MANIFEST_MISSING_OR_INVALID");
	if (manifest?.status !== "PENDING_OWNER_DECISION") fail(failures, "CONCRETE_T1_MANIFEST_STATUS_INVALID");
	if (manifest?.owner_approval?.status !== "PENDING") fail(failures, "OWNER_APPROVAL_MUST_REMAIN_SEPARATE");
	if (!sameJson(manifest?.policy_framework, EXPECTED_POLICY_FRAMEWORK)) fail(failures, "T1_POLICY_FRAMEWORK_APPROVAL_NOT_RECORDED");
	if (manifest?.candidate?.cli_package !== TOOLING_CLI_PACKAGE || manifest?.candidate?.cli_version !== TOOLING_CLI_VERSION) fail(failures, "CLI_IDENTITY_INVALID");
	if (!SHA256.test(manifest?.runtime?.npm_cli_sha256 ?? "")) fail(failures, "NPM_CLI_RUNTIME_IDENTITY_MISSING");
	if (!SHA256.test(manifest?.runtime?.npm_tree_sha256 ?? "")) fail(failures, "NPM_RUNTIME_TREE_IDENTITY_MISSING");
	if (!SHA256.test(manifest?.candidate?.package_lock_sha256 ?? "")) fail(failures, "LOCK_HASH_MISSING");
	if (!SHA256.test(manifest?.candidate?.tarball_sha256 ?? "") || !/^sha512-[A-Za-z0-9+/=]+$/.test(manifest?.candidate?.tarball_integrity ?? "")) fail(failures, "TARBALL_INTEGRITY_MISSING");
	if (manifest?.candidate?.registry_signature_status !== "VERIFIED_NPM_REGISTRY_SIGNATURE" || manifest?.candidate?.whole_tree_signature_status !== "INCONCLUSIVE_SIGSTORE_TUF_FETCH_FAILURE" || manifest?.candidate?.publisher_provenance_status !== "ABSENT_NO_DIST_ATTESTATIONS_OR_GIT_HEAD" || manifest?.candidate?.sbom_status !== "ABSENT_NO_PUBLISHED_CLI_SBOM") fail(failures, "SUPPLY_CHAIN_COVERAGE_STATUS_MISSING_OR_CHANGED");
	if (!manifest?.execution?.entrypoint || !manifest?.execution?.resolved_entrypoint || !SHA256.test(manifest?.execution?.material_source_sha256 ?? "")) fail(failures, "MATERIAL_COMMAND_PATH_BINDING_MISSING");
	if (manifest?.execution?.entrypoint !== TOOLING_ENTRYPOINT || manifest?.execution?.resolved_entrypoint !== TOOLING_RESOLVED_ENTRYPOINT || !sameJson(manifest?.execution?.args, TOOLING_DEPLOY_ARGS) || !sameJson(manifest?.execution?.metadata_fields, TOOLING_METADATA_FIELDS) || manifest?.execution?.material_source_sha256 !== manifest?.execution?.material_source_hashes?.["scripts/deploy-vercel-production.mjs"]) fail(failures, "MATERIAL_COMMAND_PATH_BINDING_MISMATCH");
	if (!manifest?.execution?.material_source_hashes || !sameJson(Object.keys(manifest.execution.material_source_hashes).sort(), [...TOOLING_MATERIAL_SOURCE_PATHS].sort()) || !TOOLING_MATERIAL_SOURCE_PATHS.every((path) => SHA256.test(manifest.execution.material_source_hashes[path] ?? ""))) fail(failures, "MATERIAL_SOURCE_HASH_SET_INCOMPLETE");
	if (manifest?.execution?.temporary_home !== true || manifest?.execution?.auto_update_disabled !== true || manifest?.execution?.native_fallback_disabled !== true) fail(failures, "CLI_EXECUTION_CONTROLS_MISSING");
	if (manifest?.execution?.env_flags?.VERCEL_CLI_USE_NATIVE_BINARY !== "0" || manifest?.execution?.env_flags?.NO_UPDATE_NOTIFIER !== "1") fail(failures, "CLI_EXECUTION_FLAGS_INVALID");
	if (!sameJson(manifest?.install, { command: TOOLING_INSTALL_COMMAND, mode: "npm ci", lifecycle_scripts: "enabled", credential_absent: true, minimal_environment: true, temporary_home: true })) fail(failures, "TOOLING_INSTALL_CONTRACT_INVALID");
	if (manifest?.target?.team_id !== "team_NsBZHGUVnyygP7veiROKLuUx" || manifest?.target?.project_id !== "prj_QNMVdxTkPOad4ynN4fwFCYEST8Jk" || manifest?.target?.project !== "kirari-main") fail(failures, "PRODUCTION_TARGET_INVALID");
	if (manifest?.installed_tree?.fingerprint_algorithm !== TOOLING_TREE_FINGERPRINT_ALGORITHM || !SHA256.test(manifest?.installed_tree?.sha256 ?? "") || !manifest?.installed_tree?.platform_scope) fail(failures, "INSTALLED_TREE_IDENTITY_MISSING");
	if (manifest?.risk?.unknown_paths_exposed !== true || !Array.isArray(manifest?.risk?.unknown_paths) || manifest.risk.unknown_paths.length === 0 || !REQUIRED_UNKNOWN_PATHS.every((path) => manifest.risk.unknown_paths.includes(path))) fail(failures, "UNKNOWN_PATHS_NOT_EXPOSED");
	if (typeof manifest?.risk?.aggregate_residual_risk !== "string" || manifest.risk.aggregate_residual_risk.trim().length < 80 || typeof manifest?.risk?.t1_c1_coupled_risk !== "string" || manifest.risk.t1_c1_coupled_risk.trim().length < 40) fail(failures, "AGGREGATE_RESIDUAL_RISK_ANALYSIS_MISSING");
	if (!Array.isArray(manifest?.invalidation_triggers) || !REQUIRED_INVALIDATION_TRIGGERS.every((trigger) => manifest.invalidation_triggers.includes(trigger))) fail(failures, "INVALIDATION_TRIGGERS_INCOMPLETE");
	if (!isIsoUtc(manifest?.proposed_expiry)) fail(failures, "MANIFEST_EXPIRY_MISSING_OR_INVALID");
	if (typeof manifest?.proposed_expiry_rationale !== "string" || manifest.proposed_expiry_rationale.trim().length < 40) fail(failures, "MANIFEST_EXPIRY_RATIONALE_MISSING");
	const nowMs = currentTime(now);
	if (!Number.isFinite(nowMs) || isIsoUtc(manifest?.proposed_expiry) && nowMs >= Date.parse(manifest.proposed_expiry)) fail(failures, "MANIFEST_EXPIRED");

	let inventory = null;
	let auditSha256 = null;
	try {
		const parsed = auditReport(auditJson);
		auditSha256 = sha256(parsed.text);
		inventory = createAdvisoryInventory(parsed.text);
		const qualifyingCount = parsed.report.metadata.vulnerabilities.moderate + parsed.report.metadata.vulnerabilities.high + parsed.report.metadata.vulnerabilities.critical;
		if ((auditExitCode === 0 && qualifyingCount > 0) || (auditExitCode === 1 && qualifyingCount === 0)) fail(failures, "RAW_AUDIT_EXIT_CODE_INCONSISTENT_WITH_THRESHOLD_COUNTS");
	} catch {
		fail(failures, "COMPLETE_RAW_AUDIT_JSON_MISSING_OR_INVALID");
	}
	if (manifest?.audit?.raw_result !== rawAuditResult) fail(failures, "RAW_AUDIT_RESULT_MISMATCH");
	if (inventory) {
		if (manifest?.audit?.audit_json_sha256 !== auditSha256) fail(failures, "AUDIT_JSON_HASH_MISMATCH");
		if (manifest?.audit?.inventory_sha256 !== inventory.sha256) fail(failures, "ADVISORY_INVENTORY_HASH_MISMATCH");
		if (manifest?.audit?.package_entry_count !== inventory.packageEntryCount || manifest?.audit?.advisory_record_count !== inventory.advisoryRecordCount || manifest?.audit?.advisory_reference_count !== inventory.advisoryReferenceCount) fail(failures, "ADVISORY_INVENTORY_COUNT_MISMATCH");
		if (!sameJson(manifest?.audit?.counts, inventory.counts)) fail(failures, "AUDIT_COUNTS_MISMATCH");
	}

	if (!observed || typeof observed !== "object") {
		fail(failures, "ACTUAL_TOOLING_OBSERVATION_MISSING");
	} else {
		exactSection(manifest, observed, "candidate", failures, ["cli_package", "cli_version", "package_lock_sha256", "tarball_integrity", "tarball_sha256"]);
		exactSection(manifest, observed, "runtime", failures);
		exactSection(manifest, observed, "install", failures);
		exactSection(manifest, observed, "execution", failures);
		exactSection(manifest, observed, "target", failures);
		exactSection(manifest, observed, "installed_tree", failures, ["sha256", "fingerprint_algorithm", "platform_scope"]);
		const audit = observed.audit;
		if (!audit || typeof audit !== "object") {
			fail(failures, "AUDIT_EXECUTION_EVIDENCE_MISSING");
		} else {
			if (audit.plain_command !== TOOLING_AUDIT_COMMAND || audit.json_command !== TOOLING_AUDIT_JSON_COMMAND) fail(failures, "AUDIT_COMMAND_CHANGED_OR_SUPPRESSED");
			if (audit.plain_executed !== true || audit.json_executed !== true) fail(failures, "AUDIT_COMMAND_SKIPPED_OR_FAILED_TO_START");
			if (audit.plain_exit_code !== auditExitCode || audit.json_exit_code !== auditExitCode || manifest?.audit?.plain_exit_code !== audit.plain_exit_code || manifest?.audit?.json_exit_code !== audit.json_exit_code) fail(failures, "AUDIT_EXIT_CODE_MISMATCH");
			if (audit.suppressed === true || audit.ignored_advisories === true || audit.omitted_packages === true) fail(failures, "AUDIT_SUPPRESSION_DETECTED");
		}
	}

	if (inventory) reviewIsValid({ reviewInput: independentReview, manifest, inventory, rawAuditSha256: auditSha256, failures });
	else fail(failures, "INDEPENDENT_REVIEW_AUDIT_INCOMPLETE");
	const digest = manifest ? toolingManifestDigest(manifest) : null;
	if (!ownerDecisionIsValid({ ownerApproval, digest, proposedExpiry: manifest?.proposed_expiry, now: nowMs })) fail(failures, "CONCRETE_OWNER_APPROVAL_MISSING_EXPIRED_OR_MISMATCHED");

	return {
		rawAuditResult,
		p4AcceptanceResult: failures.length === 0 ? "PASS" : "FAIL",
		manifestSha256: manifest ? toolingManifestDigest(manifest) : null,
		auditSha256,
		inventorySha256: inventory?.sha256 ?? null,
		counts: inventory?.counts ?? null,
		failureCodes: failures,
	};
}

export function getToolingUnknownPaths() {
	return [...REQUIRED_UNKNOWN_PATHS];
}

export function getToolingInvalidationTriggers() {
	return [...REQUIRED_INVALIDATION_TRIGGERS];
}
