#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { normalizeProductionBinding, productionApprovalDigest } from "../production-authorization.mjs";
import { assertProductionTargetSnapshot, deriveProductionIndexingPolicy } from "./production-validation.mjs";
import { createProductionReleaseRecord } from "./evidence.mjs";
import { assertConcreteProductionContracts } from "./tooling-gate.mjs";

function assert(condition, code) {
	if (!condition) throw new Error(code);
}

/** One transaction, with all production writes confined to the verified adapter. */
export async function coordinateProduction({ binding: rawBinding, packageVerification, workflow, api, guard, validateBrowser, rollbackCandidate = null, restoreRollback, createRecord = createProductionReleaseRecord }) {
	const binding = normalizeProductionBinding(rawBinding);
	assert(packageVerification.result === "PASS" && packageVerification.manifest.core.resolved_sha === binding.composition.core_sha && packageVerification.manifest.site.resolved_sha === binding.composition.site_sha, "PACKAGE_APPROVAL_MISMATCH");
	assert(packageVerification.packageArtifact?.digest === binding.package.archive_digest && packageVerification.packageArtifact?.id === binding.package.artifact_id, "PACKAGE_APPROVAL_MISMATCH");
	assert(Boolean(rollbackCandidate) === Boolean(binding.rollback_record), "ROLLBACK_APPROVAL_MISMATCH");
	if (rollbackCandidate) assert(rollbackCandidate.approved.record_digest === binding.rollback_record.record_digest && rollbackCandidate.target.deployment_id === binding.rollback_record.deployment_id, "ROLLBACK_APPROVAL_MISMATCH");
	let deployment = null;
	let promotionAttempted = false;
	let staged = false;
	let stageAttempted = false;
	let rollback = null;
	let rollbackAttempted = false;
	const snapshot = async () => {
		await guard();
		const state = await api.snapshot();
		assertProductionTargetSnapshot({ binding, ...state });
		return state;
	};
	try {
		await snapshot();
		deriveProductionIndexingPolicy({ staticRoot: packageVerification.staticRoot, canonicalOrigin: binding.target.canonical_origin, domains: binding.target.domains });
		if (binding.target.operation === "rollback") {
			assert(rollbackCandidate.target.deployment_id !== binding.target.current_deployment_id, "ROLLBACK_MUST_RESTORE_PRIOR_RELEASE");
			rollbackAttempted = true;
			rollback = await restoreRollback(rollbackCandidate, binding.target.current_deployment_id);
			promotionAttempted = rollback.production_action === true;
			assert(rollback.result === "PASS", "ROLLBACK_VERIFICATION_INCOMPLETE");
			return { result: "PASS", operation: "rollback", rollback, productionDeploymentCreated: false, productionAliasChanged: true };
		}
		if (rollbackCandidate) assert(rollbackCandidate.target.deployment_id === binding.target.current_deployment_id, "RECOVERY_MUST_USE_CURRENT_APPROVED_RELEASE");
		// No alias change is permitted until this exact staged deployment passes validation.
		stageAttempted = true;
		deployment = await api.stage(packageVerification);
		staged = true;
		const stagedReport = await validateBrowser({ phase: "staged", deployment, packageVerification });
		assert(stagedReport.result === "PASS" && stagedReport.phase === "staged" && stagedReport.artifactBytesVerified === true, "STAGED_VALIDATION_FAILED");
		await snapshot();
		promotionAttempted = true;
		await api.promote(deployment, packageVerification, stagedReport);
		const aliases = await api.aliases(deployment.id);
		const browser = await validateBrowser({ phase: "live", deployment, packageVerification, aliases });
		assert(browser.result === "PASS" && browser.phase === "live", "PRODUCTION_VALIDATION_FAILED");
		const record = createRecord({
			approvalBinding: binding,
			bindingDigest: productionApprovalDigest(binding),
			packageArtifact: { id: packageVerification.packageArtifact.id, name: packageVerification.packageArtifact.name, archive_digest: packageVerification.packageArtifact.digest },
			packageVerification,
			deployment,
			aliasBindings: aliases,
			browserReport: browser,
			workflow,
		});
		return { result: "PASS", operation: "deploy", record, stagedReport, browser, productionDeploymentCreated: true, productionAliasChanged: true };
	} catch {
		let recovery = null;
		if (binding.target.operation === "deploy" && promotionAttempted && rollbackCandidate) {
			try {
				await guard();
				const current = await api.currentProductionId();
				if (current === deployment?.id) recovery = await restoreRollback(rollbackCandidate, current);
				else if (current !== binding.target.current_deployment_id) recovery = { result: "INCOMPLETE", error_code: "PRODUCTION_STATE_UNCERTAIN" };
			} catch { recovery = { result: "INCOMPLETE", error_code: "RECOVERY_VERIFICATION_FAILED" }; }
		}
		return {
			result: "FAIL",
			operation: binding.target.operation,
			error_code: binding.target.operation === "rollback"
				? (rollback ? "PRODUCTION_ROLLBACK_VERIFICATION_INCOMPLETE" : "PRODUCTION_ROLLBACK_FAILED")
				: (promotionAttempted ? "PRODUCTION_PROMOTION_OR_VALIDATION_FAILED" : "PRODUCTION_PREPROMOTION_FAILED"),
			productionDeploymentCreated: staged,
			productionDeploymentCreationAttempted: stageAttempted,
			productionAliasChangeAttempted: promotionAttempted || (rollbackAttempted && rollback === null),
			deployment_id: deployment?.id ?? null,
			rollback,
			recovery,
		};
	}
}

export function writeOperationEvidence(directory, result) {
	mkdirSync(directory, { recursive: true });
	const write = (name, value) => writeFileSync(join(directory, name), `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
	if (result.record && result.result === "PASS") write("production-record.json", result.record);
	if (result.rollback) write("rollback-record.json", result.rollback);
	if (result.recovery) write("recovery-record.json", result.recovery);
	if (result.stagedReport) write("staged-browser.json", result.stagedReport);
	if (result.browser) write("production-browser.json", result.browser);
	write("operation-result.json", {
		result: result.result,
		operation: result.operation,
		error_code: result.error_code ?? null,
		deployment_id: result.record?.target.deployment_id ?? result.deployment_id ?? null,
		production_deployment_created: result.productionDeploymentCreated ?? false,
		production_deployment_creation_attempted: result.productionDeploymentCreationAttempted ?? result.productionDeploymentCreated ?? false,
		production_alias_change_attempted: result.productionAliasChangeAttempted ?? result.productionAliasChanged ?? false,
		recovery_result: result.recovery?.result ?? null,
		indexing_action: false,
		dns_action: false,
		release_action: false,
	});
}

async function main() {
	for (const name of ["PRODUCTION_BINDING", "PRODUCTION_PACKAGE_VERIFICATION", "PRODUCTION_PACKAGE_DIR", "PRODUCTION_EVIDENCE_DIR", "VERCEL_CLI_PATH"]) assert(process.env[name], "PRODUCTION_INPUT_MISSING");
	await assertConcreteProductionContracts();
	const binding = normalizeProductionBinding(JSON.parse(readFileSync(process.env.PRODUCTION_BINDING, "utf8")));
	assert(process.env.VERCEL_ORG_ID === binding.target.team_id && process.env.VERCEL_PROJECT_ID === binding.target.project_id, "PRODUCTION_CREDENTIAL_TARGET_MISMATCH");
	const verification = JSON.parse(readFileSync(process.env.PRODUCTION_PACKAGE_VERIFICATION, "utf8"));
	assert(resolve(verification.outputDirectory) === resolve(process.env.PRODUCTION_PACKAGE_DIR), "PRODUCTION_PACKAGE_PATH_MISMATCH");
	// The concrete adapter is loaded only in an already authorized protected job.
	const { createProductionRuntime } = await import("./runtime-adapter.mjs");
	const runtime = await createProductionRuntime({ binding, packageVerification: verification });
	let result;
	try { result = await coordinateProduction({ binding, packageVerification: verification, ...runtime }); }
	finally { runtime.cleanup(); }
	writeOperationEvidence(process.env.PRODUCTION_EVIDENCE_DIR, result);
	if (result.result !== "PASS") process.exitCode = 1;
	process.stdout.write(`${JSON.stringify({ result: result.result, operation: result.operation, error_code: result.error_code ?? null })}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	try { await main(); }
	catch {
		if (process.env.PRODUCTION_EVIDENCE_DIR) {
			try { writeOperationEvidence(process.env.PRODUCTION_EVIDENCE_DIR, { result: "FAIL", operation: "unknown", error_code: "PRODUCTION_GATE_OR_INPUT_FAILED" }); } catch { /* Preserve already written evidence. */ }
		}
		process.stderr.write("PRODUCTION_GATE_OR_INPUT_FAILED\n");
		process.exitCode = 1;
	}
}
