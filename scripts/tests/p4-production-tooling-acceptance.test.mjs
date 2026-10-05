import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
	createAdvisoryInventory,
	evaluateToolingAcceptance,
	fingerprintInstalledTree,
	getToolingInvalidationTriggers,
	TOOLING_MATERIAL_SOURCE_PATHS,
	TOOLING_TREE_FINGERPRINT_ALGORITHM,
	getToolingUnknownPaths,
	toolingManifestDigest,
} from "../p4-production/tooling-acceptance.mjs";

const digest = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const target = { team_id: "team_NsBZHGUVnyygP7veiROKLuUx", project_id: "prj_QNMVdxTkPOad4ynN4fwFCYEST8Jk", project: "kirari-main" };
const metadataFields = ["githubCommitOrg", "githubCommitRef", "githubCommitRepo", "githubCommitSha", "githubDeployment", "githubOrg", "githubRepo"];
const unknownPaths = getToolingUnknownPaths();
const expiry = "2026-10-07T15:31:37Z";
const now = "2026-10-06T15:31:37Z";
const policyFramework = {
	status: "APPROVED",
	issue_number: 130,
	proposal_comment_id: 5996717676,
	approval_comment_id: 5997088875,
	approval_comment_url: "https://github.com/markd3ng/KIRARI/issues/130#issuecomment-5997088875",
	scope: "T1 policy framework only; no concrete CLI or advisory approval",
};

function auditFixture(overrides = {}) {
	const vulnerabilities = {
		"@fastify/busboy": {
			name: "@fastify/busboy",
			severity: "high",
			isDirect: false,
			via: [{ source: 1240982, name: "@fastify/busboy", dependency: "@fastify/busboy", title: "Multipart parser denial of service", url: "https://github.com/advisories/GHSA-x8mw-p69m-v3mx", severity: "high", range: ">=1.0.0 <3.2.1" }],
			effects: ["undici"],
			range: "1.0.0 - 3.2.0",
			nodes: ["node_modules/@fastify/busboy"],
			fixAvailable: { name: "vercel", version: "54.17.3", isSemVerMajor: true },
		},
	};
	return JSON.stringify({
		auditReportVersion: 2,
		vulnerabilities: { ...vulnerabilities, ...(overrides.vulnerabilities ?? {}) },
		metadata: {
			vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0, total: 1, ...(overrides.counts ?? {}) },
			dependencies: { prod: 1, dev: 0, optional: 0, peer: 0, peerOptional: 0, total: 1 },
		},
	});
}

function cleanAuditFixture() {
	return JSON.stringify({
		auditReportVersion: 2,
		vulnerabilities: {},
		metadata: {
			vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 },
			dependencies: { prod: 0, dev: 0, optional: 0, peer: 0, peerOptional: 0, total: 0 },
		},
	});
}

function setup({ auditJson = auditFixture(), lockSha = digest("lock"), treeSha = digest("installed tree") } = {}) {
	const inventory = createAdvisoryInventory(auditJson);
	const candidate = {
		cli_package: "vercel",
		cli_version: "62.2.0",
		package_lock_sha256: lockSha,
		tarball_integrity: "sha512-hwet6qXoOfZEc6waIx1VgI2nLl83wwuZZnFqKSsKJ47UFi9waEezPmAV7uNOx8Fq+6JTJIi+lRnxFXr9YFW3Eg==",
		tarball_sha256: digest("tarball"),
	};
	const runtime = { node_version: "v22.12.0", npm_version: "10.9.0", npm_cli_sha256: digest("npm cli runtime"), npm_tree_sha256: digest("npm runtime tree"), runner: { os: "Linux", arch: "x64", image: "ubuntu-24.04", image_version: "20260927.320.1", os_release: "Ubuntu 24.04.5" } };
	const install = { command: "npm ci --prefix scripts/p4-production/tooling --registry=https://registry.npmjs.org", mode: "npm ci", lifecycle_scripts: "enabled", credential_absent: true, minimal_environment: true, temporary_home: true };
	const execution = {
		entrypoint: "scripts/p4-production/tooling/node_modules/.bin/vercel",
		resolved_entrypoint: "scripts/p4-production/tooling/node_modules/vercel/dist/vc.js",
		args: ["deploy", "--prebuilt", "--prod", "--skip-domain", "--yes"],
		metadata_fields: metadataFields,
		temporary_home: true,
		auto_update_disabled: true,
		native_fallback_disabled: true,
		env_flags: { VERCEL_CLI_USE_NATIVE_BINARY: "0", NO_UPDATE_NOTIFIER: "1" },
		material_source_sha256: digest("scripts/deploy-vercel-production.mjs"),
		material_source_hashes: Object.fromEntries(TOOLING_MATERIAL_SOURCE_PATHS.map((path) => [path, digest(path)])),
	};
	const installedTree = { sha256: treeSha, platform_scope: "Linux/x64", fingerprint_algorithm: TOOLING_TREE_FINGERPRINT_ALGORITHM };
	const audit = {
		plain_command: "npm audit --prefix scripts/p4-production/tooling --audit-level moderate",
		json_command: "npm audit --prefix scripts/p4-production/tooling --audit-level moderate --json",
		plain_executed: true,
		json_executed: true,
		plain_exit_code: 1,
		json_exit_code: 1,
	};
	const manifest = {
		schema_version: 1,
		kind: "T1_CONCRETE_TOOLING_MANIFEST",
		status: "PENDING_OWNER_DECISION",
		policy_framework: { ...policyFramework },
		candidate: {
			cli_name: "Vercel CLI",
			...candidate,
			registry_signature_status: "VERIFIED_NPM_REGISTRY_SIGNATURE",
			whole_tree_signature_status: "INCONCLUSIVE_SIGSTORE_TUF_FETCH_FAILURE",
			publisher_provenance_status: "ABSENT_NO_DIST_ATTESTATIONS_OR_GIT_HEAD",
			sbom_status: "ABSENT_NO_PUBLISHED_CLI_SBOM",
		},
		runtime,
		install,
		execution,
		target,
		installed_tree: installedTree,
		audit: {
			plain_command: audit.plain_command,
			json_command: audit.json_command,
			plain_exit_code: 1,
			json_exit_code: 1,
			raw_result: "FAIL",
			audit_json_sha256: digest(auditJson),
			inventory_sha256: inventory.sha256,
			package_entry_count: inventory.packageEntryCount,
			advisory_record_count: inventory.advisoryRecordCount,
			advisory_reference_count: inventory.advisoryReferenceCount,
			counts: inventory.counts,
		},
		independent_review: { path: "independent-security-review.json", sha256: "PENDING" },
		risk: {
			unknown_paths_exposed: true,
			unknown_paths: unknownPaths,
			aggregate_residual_risk: "Unresolved moderate, high, and critical advisories may be reachable through package startup, deployment processing, dynamic fallbacks, or same-runner state persistence; available npm and registry evidence does not prove these paths safe.",
			t1_c1_coupled_risk: "A compromised CLI can exercise the full approved same-project C1 capability set.",
		},
		proposed_expiry: expiry,
		proposed_expiry_rationale: "A 48-hour decision window limits reliance on mutable registry and hosted-runner evidence and requires refresh before any later use.",
		invalidation_triggers: getToolingInvalidationTriggers(),
		owner_approval: { status: "PENDING", comment_id: null, expires_at: null },
	};
	const review = {
		schema_version: 1,
		result: "REVIEWED_WITH_EXPOSED_RESIDUAL_RISK",
		review_complete: true,
		reviewer_independent: true,
		reviewer_identity: "independent-security synthetic test fixture",
		reviewed_at: "2026-10-06T14:00:00Z",
		candidate,
		audit_json_sha256: digest(auditJson),
		inventory_sha256: inventory.sha256,
		runtime,
		install,
		execution,
		target,
		installed_tree_sha256: treeSha,
		installed_tree_platform_scope: "Linux/x64",
		unknown_paths_treated_as_exposed: true,
		unknown_paths: unknownPaths,
		reviewed_package_entries: inventory.packageEntryCount,
		reviewed_advisory_objects: inventory.advisoryRecordCount,
		reviewed_advisory_references: inventory.advisoryReferenceCount,
		advisory_reviews: inventory.advisoryRecords.map((record) => ({
			...record,
			analysis: `Reviewed ${record.advisory_id} for ${record.package_name}; dependency path remains exposed and unresolved reachability is preserved.`,
			reachability: "UNKNOWN_EXPOSED",
		})),
		assessments: {
			install_time_execution: "ASSESSED: lifecycle scripts ran before credentials were mapped; no token was present.",
			startup_import_execution: "UNKNOWN paths remain exposed.",
			fixed_deploy_command: "Reviewed deploy --prebuilt --prod --skip-domain --yes with exact metadata fields.",
			local_artifact_and_config_parsing: "UNKNOWN paths remain exposed.",
			network_response_parsing: "UNKNOWN paths remain exposed.",
			archive_extraction: "UNKNOWN paths remain exposed.",
			fallback_and_dynamic_paths: "Native fallback is disabled; remaining dynamic paths are UNKNOWN/exposed.",
			credential_before_and_after_mapping: "Install precedes token; fixed command runs with the protected token and remains exposed to unresolved advisories.",
			c1_blast_radius: "Full approved same-project capability set if execution is compromised.",
		},
	};
	const independentReview = JSON.stringify(review);
	manifest.independent_review.sha256 = digest(independentReview);
	return { auditJson, inventory, manifest, independentReview, observed: structuredClone({ candidate, runtime, install, execution, target, installed_tree: installedTree, audit }) };
}

function approvedDecision(manifest, expiresAt = expiry) {
	return {
		authenticated: true,
		owner: "markd3ng",
		issue_number: 130,
		comment_id: 5999999999,
		comment_url: "https://github.com/markd3ng/KIRARI/issues/130#issuecomment-5999999999",
		kind: "T1_CONCRETE_TOOLING_MANIFEST",
		decision: "APPROVED",
		manifest_sha256: toolingManifestDigest(manifest),
		expires_at: expiresAt,
		revocation_status: "CLEAR",
		revocation_checked_at: now,
	};
}

function evaluate(value, overrides = {}) {
	return evaluateToolingAcceptance({
		auditExitCode: 1,
		auditJson: value.auditJson,
		manifest: value.manifest,
		ownerApproval: approvedDecision(value.manifest),
		independentReview: value.independentReview,
		observed: value.observed,
		now,
		...overrides,
	});
}

test("a fully bound, separately approved candidate may satisfy the amended gate while preserving raw audit FAIL", () => {
	const value = setup();
	const result = evaluate(value);
	assert.equal(result.rawAuditResult, "FAIL");
	assert.equal(result.p4AcceptanceResult, "PASS");
	assert.equal(result.manifestSha256, toolingManifestDigest(value.manifest));
});

test("a clean raw audit still fails P4 until its candidate review and separate Owner approval exist", () => {
	const value = setup({ auditJson: cleanAuditFixture() });
	value.manifest.audit.raw_result = "PASS";
	value.manifest.audit.plain_exit_code = 0;
	value.manifest.audit.json_exit_code = 0;
	value.observed.audit.plain_exit_code = 0;
	value.observed.audit.json_exit_code = 0;
	const result = evaluateToolingAcceptance({
		auditExitCode: 0,
		auditJson: value.auditJson,
		manifest: value.manifest,
		ownerApproval: null,
		independentReview: value.independentReview,
		observed: value.observed,
		now,
	});
	assert.equal(result.rawAuditResult, "PASS");
	assert.equal(result.p4AcceptanceResult, "FAIL");
	assert.ok(result.failureCodes.includes("CONCRETE_OWNER_APPROVAL_MISSING_EXPIRED_OR_MISMATCHED"));
});

test("the complete advisory inventory includes every package path, advisory ID, severity, and fix proposal", () => {
	const value = setup();
	assert.match(value.inventory.text, /GHSA-x8mw-p69m-v3mx/);
	assert.match(value.inventory.text, /node_modules\/@fastify\/busboy/);
	assert.match(value.inventory.text, /fixAvailable/);
	assert.match(value.inventory.text, /54\.17\.3/);
	assert.equal(createAdvisoryInventory(value.auditJson).sha256, value.inventory.sha256);
	assert.equal(value.inventory.advisoryRecords.length, 1);
	assert.equal(value.inventory.advisoryRecords[0].paths[0], "node_modules/@fastify/busboy");
	assert.equal(value.inventory.advisoryRecords[0].advisory_id, "GHSA-x8mw-p69m-v3mx");
});

test("independent review must contain exactly one fully bound row for every advisory and inherited reference", () => {
	const value = setup();
	const missing = JSON.parse(value.independentReview);
	missing.advisory_reviews = [];
	const missingText = JSON.stringify(missing);
	value.manifest.independent_review.sha256 = digest(missingText);
	assert.ok(evaluate(value, { independentReview: missingText }).failureCodes.includes("INDEPENDENT_REVIEW_ADVISORY_MATRIX_INCOMPLETE"));

	const substituted = setup();
	const review = JSON.parse(substituted.independentReview);
	review.advisory_reviews[0].paths = ["node_modules/other-package"];
	const substitutedText = JSON.stringify(review);
	substituted.manifest.independent_review.sha256 = digest(substitutedText);
	assert.ok(evaluate(substituted, { independentReview: substitutedText }).failureCodes.includes("INDEPENDENT_REVIEW_ADVISORY_MATRIX_BINDING_MISMATCH"));

	const stub = setup();
	const stubReview = JSON.parse(stub.independentReview);
	stubReview.advisory_reviews[0].analysis = "reviewed";
	const stubText = JSON.stringify(stubReview);
	stub.manifest.independent_review.sha256 = digest(stubText);
	assert.ok(evaluate(stub, { independentReview: stubText }).failureCodes.includes("INDEPENDENT_REVIEW_ADVISORY_ANALYSIS_MISSING"));

	const unattributed = setup();
	const unattributedReview = JSON.parse(unattributed.independentReview);
	unattributedReview.reviewer_identity = "";
	const unattributedText = JSON.stringify(unattributedReview);
	unattributed.manifest.independent_review.sha256 = digest(unattributedText);
	assert.ok(evaluate(unattributed, { independentReview: unattributedText }).failureCodes.includes("INDEPENDENT_REVIEW_ATTRIBUTION_MISSING"));
});

test("canonical manifest digest does not depend on JSON object insertion order", () => {
	assert.equal(toolingManifestDigest({ b: 2, a: { d: 4, c: 3 } }), toolingManifestDigest({ a: { c: 3, d: 4 }, b: 2 }));
});

test("a missing concrete Owner decision fails closed even when T1 policy is approved", () => {
	const value = setup();
	const result = evaluate(value, { ownerApproval: null });
	assert.equal(result.rawAuditResult, "FAIL");
	assert.equal(result.p4AcceptanceResult, "FAIL");
	assert.ok(result.failureCodes.includes("CONCRETE_OWNER_APPROVAL_MISSING_EXPIRED_OR_MISMATCHED"));
});

test("a local approved boolean cannot stand in for an authenticated Owner comment", () => {
	const value = setup();
	const result = evaluate(value, { ownerApproval: { approved: true, manifest_sha256: toolingManifestDigest(value.manifest) } });
	assert.equal(result.p4AcceptanceResult, "FAIL");
});

test("policy approval, exact invalidation triggers, and current unrevoked Owner proof are all required", () => {
	const policy = setup();
	policy.manifest.policy_framework.scope = "T1 policy approval includes the concrete CLI";
	assert.ok(evaluate(policy).failureCodes.includes("T1_POLICY_FRAMEWORK_APPROVAL_NOT_RECORDED"));

	const triggers = setup();
	triggers.manifest.invalidation_triggers = ["one", "two", "three", "four", "five"];
	assert.ok(evaluate(triggers).failureCodes.includes("INVALIDATION_TRIGGERS_INCOMPLETE"));

	const revoked = setup();
	const decision = approvedDecision(revoked.manifest);
	decision.revocation_status = "REVOKED";
	assert.ok(evaluate(revoked, { ownerApproval: decision }).failureCodes.includes("CONCRETE_OWNER_APPROVAL_MISSING_EXPIRED_OR_MISMATCHED"));

	const wrongDigest = setup();
	const mismatched = approvedDecision(wrongDigest.manifest);
	mismatched.manifest_sha256 = digest("different manifest");
	assert.ok(evaluate(wrongDigest, { ownerApproval: mismatched }).failureCodes.includes("CONCRETE_OWNER_APPROVAL_MISSING_EXPIRED_OR_MISMATCHED"));
});

test("wrong CLI version and package-lock hash fail exact identity binding", () => {
	for (const [section, field, changed] of [["candidate", "cli_version", "62.2.1"], ["candidate", "package_lock_sha256", digest("other lock")]]) {
		const value = setup();
		value.observed[section][field] = changed;
		assert.equal(evaluate(value).p4AcceptanceResult, "FAIL");
	}
});

test("wrong audit digest, changed advisory inventory, and a new advisory fail closed", () => {
	const wrongHash = setup();
	wrongHash.manifest.audit.audit_json_sha256 = digest("other audit");
	assert.ok(evaluate(wrongHash).failureCodes.includes("AUDIT_JSON_HASH_MISMATCH"));

	const changedInventory = setup();
	changedInventory.manifest.audit.inventory_sha256 = digest("other inventory");
	assert.ok(evaluate(changedInventory).failureCodes.includes("ADVISORY_INVENTORY_HASH_MISMATCH"));

	const newFinding = setup();
	const report = JSON.parse(newFinding.auditJson);
	report.vulnerabilities["new-package"] = {
		name: "new-package", severity: "critical", isDirect: false,
		via: [{ source: 7, name: "new-package", dependency: "new-package", title: "New issue", url: "https://github.com/advisories/GHSA-new-issue", severity: "critical", range: "<2.0.0" }],
		effects: [], range: "<2.0.0", nodes: ["node_modules/new-package"], fixAvailable: false,
	};
	report.metadata.vulnerabilities.critical = 1;
	report.metadata.vulnerabilities.total = 2;
	const changedAudit = JSON.stringify(report);
	const result = evaluateToolingAcceptance({
		auditExitCode: 1,
		auditJson: changedAudit,
		manifest: newFinding.manifest,
		ownerApproval: approvedDecision(newFinding.manifest),
		independentReview: newFinding.independentReview,
		observed: newFinding.observed,
		now,
	});
	assert.equal(result.rawAuditResult, "FAIL");
	assert.ok(result.failureCodes.includes("AUDIT_JSON_HASH_MISMATCH"));
	assert.ok(result.failureCodes.includes("ADVISORY_INVENTORY_HASH_MISMATCH"));
});

test("expired and missing finite approval expiries fail closed", () => {
	const expired = setup();
	assert.ok(evaluate(expired, { ownerApproval: approvedDecision(expired.manifest, "2026-10-06T00:00:00Z") }).failureCodes.includes("CONCRETE_OWNER_APPROVAL_MISSING_EXPIRED_OR_MISMATCHED"));

	const missingManifestExpiry = setup();
	missingManifestExpiry.manifest.proposed_expiry = null;
	assert.ok(evaluate(missingManifestExpiry).failureCodes.includes("MANIFEST_EXPIRY_MISSING_OR_INVALID"));

	const missingApprovalExpiry = setup();
	assert.ok(evaluate(missingApprovalExpiry, { ownerApproval: approvedDecision(missingApprovalExpiry.manifest, null) }).failureCodes.includes("CONCRETE_OWNER_APPROVAL_MISSING_EXPIRED_OR_MISMATCHED"));
});

test("runtime, runner image, architecture, and Node or npm mismatches fail closed", () => {
	for (const [section, key, value] of [
		["runtime", "node_version", "v22.13.0"],
		["runtime", "npm_version", "10.9.1"],
	]) {
		const candidate = setup();
		candidate.observed[section][key] = value;
		assert.equal(evaluate(candidate).p4AcceptanceResult, "FAIL");
	}
	const runner = setup();
	runner.observed.runtime.runner.image_version = "20261001.1";
	assert.equal(evaluate(runner).p4AcceptanceResult, "FAIL");
	const architecture = setup();
	architecture.observed.runtime.runner.arch = "arm64";
	assert.equal(evaluate(architecture).p4AcceptanceResult, "FAIL");
	const npmCli = setup();
	npmCli.observed.runtime.npm_cli_sha256 = digest("different npm CLI runtime");
	assert.ok(evaluate(npmCli).failureCodes.includes("RUNTIME_MISMATCH"));
	const npmTree = setup();
	npmTree.observed.runtime.npm_tree_sha256 = digest("different npm runtime tree");
	assert.ok(evaluate(npmTree).failureCodes.includes("RUNTIME_MISMATCH"));
});

test("material source hash set and observed installed-tree algorithm are exactly bound", () => {
	const missingSource = setup();
	delete missingSource.manifest.execution.material_source_hashes[TOOLING_MATERIAL_SOURCE_PATHS[0]];
	assert.ok(evaluate(missingSource).failureCodes.includes("MATERIAL_SOURCE_HASH_SET_INCOMPLETE"));

	const sourceMismatch = setup();
	sourceMismatch.observed.execution.material_source_hashes[TOOLING_MATERIAL_SOURCE_PATHS[1]] = digest("changed source");
	assert.ok(evaluate(sourceMismatch).failureCodes.includes("EXECUTION_MISMATCH"));

	const fingerprintMismatch = setup();
	fingerprintMismatch.observed.installed_tree.fingerprint_algorithm = "different";
	assert.ok(evaluate(fingerprintMismatch).failureCodes.includes("INSTALLED_TREE_MISMATCH"));
});

test("audit exit zero cannot contradict qualifying counts and incomplete npm schema is rejected", () => {
	const value = setup();
	const result = evaluateToolingAcceptance({
		auditExitCode: 0,
		auditJson: value.auditJson,
		manifest: value.manifest,
		ownerApproval: approvedDecision(value.manifest),
		independentReview: value.independentReview,
		observed: { ...value.observed, audit: { ...value.observed.audit, plain_exit_code: 0, json_exit_code: 0 } },
		now,
	});
	assert.equal(result.rawAuditResult, "PASS");
	assert.ok(result.failureCodes.includes("RAW_AUDIT_EXIT_CODE_INCONSISTENT_WITH_THRESHOLD_COUNTS"));

	const incomplete = setup();
	const report = JSON.parse(incomplete.auditJson);
	delete report.metadata.dependencies.peerOptional;
	const invalid = evaluateToolingAcceptance({
		auditExitCode: 1,
		auditJson: JSON.stringify(report),
		manifest: incomplete.manifest,
		ownerApproval: approvedDecision(incomplete.manifest),
		independentReview: incomplete.independentReview,
		observed: incomplete.observed,
		now,
	});
	assert.ok(invalid.failureCodes.includes("COMPLETE_RAW_AUDIT_JSON_MISSING_OR_INVALID"));
});

test("install mode, tarball integrity, command path, target, and installed tree mismatches fail closed", () => {
	const install = setup();
	install.observed.install.mode = "npm install";
	assert.equal(evaluate(install).p4AcceptanceResult, "FAIL");

	const integrity = setup();
	integrity.observed.candidate.tarball_integrity = "sha512-changed";
	assert.equal(evaluate(integrity).p4AcceptanceResult, "FAIL");

	const command = setup();
	command.observed.execution.resolved_entrypoint = "scripts/p4-production/tooling/node_modules/vercel/dist/evil.js";
	assert.equal(evaluate(command).p4AcceptanceResult, "FAIL");

	const targetMismatch = setup();
	targetMismatch.observed.target.project_id = "prj_other";
	assert.equal(evaluate(targetMismatch).p4AcceptanceResult, "FAIL");

	const tree = setup();
	tree.observed.installed_tree.sha256 = digest("tampered tree");
	assert.equal(evaluate(tree).p4AcceptanceResult, "FAIL");
});

test("missing independent review and omitted UNKNOWN exposure fail closed", () => {
	const missingReview = setup();
	assert.ok(evaluate(missingReview, { independentReview: null }).failureCodes.includes("INDEPENDENT_REVIEW_MISSING"));

	const omittedUnknowns = setup();
	omittedUnknowns.manifest.risk.unknown_paths = [unknownPaths[0]];
	assert.ok(evaluate(omittedUnknowns).failureCodes.includes("UNKNOWN_PATHS_NOT_EXPOSED"));

	const reviewHidesUnknowns = setup();
	const review = JSON.parse(reviewHidesUnknowns.independentReview);
	review.unknown_paths_treated_as_exposed = false;
	const changedReview = JSON.stringify(review);
	reviewHidesUnknowns.manifest.independent_review.sha256 = digest(changedReview);
	assert.ok(evaluate({ ...reviewHidesUnknowns, independentReview: changedReview }).failureCodes.includes("INDEPENDENT_REVIEW_UNKNOWN_PATHS_NOT_EXPOSED"));
});

test("a raw audit FAIL is never relabeled PASS, and audit cannot be skipped, changed, or suppressed", () => {
	const relabeled = setup();
	relabeled.manifest.audit.raw_result = "PASS";
	const result = evaluate(relabeled);
	assert.equal(result.rawAuditResult, "FAIL");
	assert.equal(result.p4AcceptanceResult, "FAIL");
	assert.ok(result.failureCodes.includes("RAW_AUDIT_RESULT_MISMATCH"));

	const skipped = setup();
	skipped.observed.audit.plain_executed = false;
	assert.ok(evaluate(skipped).failureCodes.includes("AUDIT_COMMAND_SKIPPED_OR_FAILED_TO_START"));

	const changedCommand = setup();
	changedCommand.observed.audit.json_command += " --omit=optional";
	assert.ok(evaluate(changedCommand).failureCodes.includes("AUDIT_COMMAND_CHANGED_OR_SUPPRESSED"));

	const suppressed = setup();
	suppressed.observed.audit.suppressed = true;
	assert.ok(evaluate(suppressed).failureCodes.includes("AUDIT_SUPPRESSION_DETECTED"));
});

test("experimental native fallback or update notifier controls cannot be enabled", () => {
	const native = setup();
	native.observed.execution.env_flags.VERCEL_CLI_USE_NATIVE_BINARY = "1";
	assert.equal(evaluate(native).p4AcceptanceResult, "FAIL");

	const updater = setup();
	updater.observed.execution.env_flags.NO_UPDATE_NOTIFIER = "0";
	assert.equal(evaluate(updater).p4AcceptanceResult, "FAIL");
});

test("installed-tree fingerprint binds sorted paths and content without following symlinks", () => {
	const directory = mkdtempSync(join(tmpdir(), "kirari-tooling-tree-"));
	try {
		mkdirSync(join(directory, "node_modules"));
		writeFileSync(join(directory, "node_modules", "entry.js"), "module.exports = 1;\n");
		symlinkSync("entry.js", join(directory, "node_modules", "entry-link.js"));
		const root = join(directory, "node_modules");
		const first = fingerprintInstalledTree(root);
		assert.match(first, /^sha256:[0-9a-f]{64}$/);
		assert.equal(fingerprintInstalledTree(root), first);
		writeFileSync(join(root, "entry.js"), "module.exports = 2;\n");
		assert.notEqual(fingerprintInstalledTree(root), first);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
