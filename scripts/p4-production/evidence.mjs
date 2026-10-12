import { writeFileSync } from "node:fs";
import {
	assertProductionAuthorizationBinding,
	assertProductionBrowserReport,
	assertProductionDeployment,
	ProductionValidationError,
} from "./production-validation.mjs";
import { productionApprovalDigest } from "../production-authorization.mjs";

const SHA1 = /^[a-f0-9]{40}$/;
const SHA256 = /^sha256:[a-f0-9]{64}$/;
const POSITIVE_INTEGER = /^[1-9]\d*$/;
const SAFE_ARTIFACT_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,180}$/;
const DEPLOYMENT_ID = /^dpl_[A-Za-z0-9]+$/;

function fail(code) {
	throw new ProductionValidationError(code);
}

function validTime(value) {
	return typeof value === "string" && Number.isFinite(Date.parse(value)) && value === new Date(value).toISOString();
}

function assertSha1(value, code) {
	if (!SHA1.test(value ?? "")) fail(code);
	return value;
}

function assertSha256(value, code) {
	if (!SHA256.test(value ?? "")) fail(code);
	return value;
}

function assertRunNumber(value, code) {
	if (!POSITIVE_INTEGER.test(String(value ?? ""))) fail(code);
	return String(value);
}

function safeIdentity(value, code) {
	if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._\[\]-]{0,100}$/.test(value)) fail(code);
	return value;
}

function exactKeys(value, keys, code) {
	if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => !keys.includes(key)) || keys.some((key) => !Object.hasOwn(value, key))) fail(code);
}

function githubRepositorySlug(value, code) {
	if (typeof value !== "string") fail(code);
	let url;
	try { url = new URL(value); } catch { fail(code); }
	if (url.protocol !== "https:" || url.hostname !== "github.com" || url.username || url.password || url.port || url.search || url.hash) fail(code);
	const match = /^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(url.pathname);
	if (!match) fail(code);
	return `${match[1]}/${match[2]}`;
}

function boundedRequestedRef(value, code) {
	if (typeof value !== "string" || !value || Buffer.byteLength(value, "utf8") > 256 || /[\x00-\x1f\x7f]/.test(value) || value.trim() !== value) fail(code);
	return value;
}

function safeSubdirectory(value, code) {
	if (typeof value !== "string" || !value || Buffer.byteLength(value, "utf8") > 1024 || value.startsWith("/") || value.includes("\\") || (value !== "." && value.split("/").some((part) => !part || part === "." || part === ".."))) fail(code);
	return value;
}

function normalizeBrowserReport(report) {
	const browser = assertProductionBrowserReport(report);
	return {
		result: browser.result,
		mode: browser.mode,
		phase: browser.phase,
		baseUrl: browser.baseUrl,
		canonicalOrigin: browser.canonicalOrigin,
		indexable: browser.indexable,
		canonicalDocuments: browser.canonicalDocuments,
		robotsSitemapCount: browser.robotsSitemapCount,
		routes: browser.routes,
		assets: { required: browser.assets?.required, loaded: browser.assets?.loaded },
		expectedExternalCalls: browser.expectedExternalCalls,
		browserConsoleErrors: browser.browserConsoleErrors,
		pageErrors: browser.pageErrors,
		failedBrowserRequests: browser.failedBrowserRequests,
		badResponses: browser.badResponses,
		unexpectedExternalCalls: browser.unexpectedExternalCalls,
		byteEquality: browser.byteEquality,
		artifactBytesVerified: browser.artifactBytesVerified,
		byteOutputDigest: browser.byteOutputDigest,
		inventoryDigest: browser.inventoryDigest,
		fileCount: browser.fileCount,
		totalBytes: browser.totalBytes,
	};
}

function normalizedIdentity(identity, label, required, expectedRepository) {
	if (!identity || typeof identity !== "object") fail("PACKAGE_COMPOSITION_INVALID");
	const site = label === "site";
	const expectedKeys = site ? ["kind", "repository", "requested_ref", "resolved_sha", "source_subdirectory"] : ["kind", "repository", "requested_ref", "resolved_sha"];
	exactKeys(identity, expectedKeys, "PACKAGE_COMPOSITION_INVALID");
	if (identity.kind !== "git") fail("PACKAGE_COMPOSITION_INVALID");
	const repositorySlug = githubRepositorySlug(identity.repository, "PACKAGE_COMPOSITION_INVALID");
	if (expectedRepository && repositorySlug.toLowerCase() !== expectedRepository.toLowerCase()) fail("PACKAGE_COMPOSITION_MISMATCH");
	const result = {
		kind: "git",
		repository: identity.repository,
		requested_ref: boundedRequestedRef(identity.requested_ref, "PACKAGE_COMPOSITION_INVALID"),
		resolved_sha: identity.resolved_sha,
	};
	assertSha1(result.resolved_sha, "PACKAGE_COMPOSITION_INVALID");
	if (required && result.resolved_sha !== required) fail("PACKAGE_COMPOSITION_MISMATCH");
	if (site) result.source_subdirectory = safeSubdirectory(identity.source_subdirectory, "PACKAGE_COMPOSITION_INVALID");
	return result;
}

function assertCompositionMatchesBinding(binding, verification) {
	const manifest = verification?.manifest;
	if (!manifest || manifest.schema_version !== 1 || !manifest.core || !manifest.site || !manifest.upstream_github_artifact) fail("PACKAGE_MANIFEST_INVALID");
	if (manifest.core.resolved_sha !== binding.composition?.core_sha || manifest.site.resolved_sha !== binding.composition?.site_sha) fail("PACKAGE_COMPOSITION_MISMATCH");
	if (verification.outputDigest !== manifest.output_digest || !SHA256.test(manifest.output_digest ?? "")) fail("PACKAGE_OUTPUT_DIGEST_MISMATCH");
	if (verification.result !== "PASS" || verification.manifest?.output_digest !== manifest.output_digest) fail("PACKAGE_VERIFICATION_NOT_PASS");
	const verifiedArchiveDigest = verification.packageArchiveSha256;
	if (verifiedArchiveDigest !== binding.package.archive_digest) fail("PACKAGE_ARCHIVE_DIGEST_MISMATCH");
	const upstream = manifest.upstream_github_artifact;
	if (!POSITIVE_INTEGER.test(String(upstream.id ?? "")) || !POSITIVE_INTEGER.test(String(upstream.run_id ?? "")) || !POSITIVE_INTEGER.test(String(upstream.run_attempt ?? "")) || !SAFE_ARTIFACT_NAME.test(upstream.name ?? "") || !SHA256.test(upstream.digest ?? "")) fail("PACKAGE_UPSTREAM_IDENTITY_INVALID");
	if (upstream.run_id !== String(binding.source.run_id) || upstream.run_attempt !== String(binding.source.run_attempt)) fail("PACKAGE_UPSTREAM_IDENTITY_MISMATCH");
	const verifiedUpstream = verification.upstream ?? verification.upstreamArtifact;
	if (verifiedUpstream && (String(verifiedUpstream.id) !== String(upstream.id) || verifiedUpstream.name !== upstream.name || (verifiedUpstream.digest !== undefined && verifiedUpstream.digest !== upstream.digest))) fail("PACKAGE_UPSTREAM_IDENTITY_MISMATCH");
	return { manifest, upstream: {
		id: String(upstream.id),
		name: upstream.name,
		run_id: String(upstream.run_id),
		run_attempt: String(upstream.run_attempt),
		digest: upstream.digest,
	} };
}

export function createProductionReleaseRecord({
	approvalBinding,
	bindingDigest,
	packageArtifact,
	packageVerification,
	deployment,
	aliasBindings,
	browserReport,
	workflow,
}) {
	const target = assertProductionAuthorizationBinding(approvalBinding);
	assertSha256(bindingDigest, "AUTHORIZATION_BINDING_DIGEST_INVALID");
	if (bindingDigest !== productionApprovalDigest(approvalBinding)) fail("AUTHORIZATION_BINDING_DIGEST_MISMATCH");
	if (!approvalBinding.source || !approvalBinding.package || !approvalBinding.composition || !approvalBinding.workflow_sha || !approvalBinding.workflow_path || !approvalBinding.main_sha) fail("AUTHORIZATION_BINDING_INCOMPLETE");
	if (target.operation === "rollback") fail("ROLLBACK_REQUIRES_SEPARATE_RESULT_RECORD");
	const source = {
		id: assertRunNumber(approvalBinding.source.run_id, "AUTHORIZATION_SOURCE_INVALID"),
		attempt: assertRunNumber(approvalBinding.source.run_attempt, "AUTHORIZATION_SOURCE_INVALID"),
		sha: assertSha1(approvalBinding.source.sha, "AUTHORIZATION_SOURCE_INVALID"),
	};
	const packageId = assertRunNumber(approvalBinding.package.artifact_id, "AUTHORIZATION_PACKAGE_INVALID");
	const packageArchiveDigest = assertSha256(approvalBinding.package.archive_digest, "AUTHORIZATION_PACKAGE_INVALID");
	if (!packageArtifact || String(packageArtifact.id ?? "") !== packageId || (packageArtifact.archive_digest ?? packageArtifact.digest) !== packageArchiveDigest || packageArtifact.name !== `kirari-site-package-${source.id}-${source.attempt}` || !SAFE_ARTIFACT_NAME.test(packageArtifact.name)) fail("PACKAGE_ARTIFACT_BINDING_MISMATCH");
	const { manifest, upstream } = assertCompositionMatchesBinding(approvalBinding, packageVerification);
	const composition = {
		core: normalizedIdentity(manifest.core, "core", approvalBinding.composition.core_sha),
		site: normalizedIdentity(manifest.site, "site", approvalBinding.composition.site_sha, approvalBinding.repository),
	};
	if (composition.core.resolved_sha !== source.sha) fail("PACKAGE_SOURCE_CORE_MISMATCH");
	const browser = normalizeBrowserReport(browserReport);
	if (browser.phase !== "live" || browser.baseUrl !== target.canonical_origin || browser.canonicalOrigin !== target.canonical_origin) fail("BROWSER_TARGET_MISMATCH");
	const deploymentContext = assertProductionDeployment({
		baseUrl: browser.baseUrl,
		binding: approvalBinding,
		deployment,
		aliasBindings,
	});
	if (!workflow || typeof workflow !== "object") fail("WORKFLOW_IDENTITY_INVALID");
	const workflowId = assertRunNumber(workflow.id, "WORKFLOW_IDENTITY_INVALID");
	const workflowAttempt = assertRunNumber(workflow.attempt, "WORKFLOW_IDENTITY_INVALID");
	if (workflowAttempt !== "1") fail("WORKFLOW_ATTEMPT_INVALID");
	const workflowSha = assertSha1(workflow.workflow_sha, "WORKFLOW_IDENTITY_INVALID");
	const mainSha = assertSha1(workflow.main_sha, "WORKFLOW_IDENTITY_INVALID");
	const workflowPath = workflow.path;
	if (workflowPath !== approvalBinding.workflow_path || workflowSha !== approvalBinding.workflow_sha || mainSha !== approvalBinding.main_sha) fail("WORKFLOW_BINDING_MISMATCH");
	const actor = safeIdentity(workflow.actor, "WORKFLOW_ACTOR_INVALID");
	const triggeringActor = safeIdentity(workflow.triggering_actor, "WORKFLOW_ACTOR_INVALID");
	const owner = approvalBinding.repository.split("/")[0].toLowerCase();
	if (actor.toLowerCase() !== owner || triggeringActor.toLowerCase() !== owner || actor !== triggeringActor) fail("WORKFLOW_ACTOR_MISMATCH");
	if (!validTime(workflow.created_at)) fail("WORKFLOW_TIME_INVALID");
	const normalizedWorkflow = {
		id: workflowId,
		attempt: workflowAttempt,
		sha: workflowSha,
		main_sha: mainSha,
		path: workflowPath,
		actor,
		triggering_actor: triggeringActor,
		created_at: workflow.created_at,
	};
	const record = {
		schema_version: 1,
		kind: "kirari-production-release",
		result: "PASS",
		authorization: { binding_digest: bindingDigest, actor, repository: approvalBinding.repository },
		target: {
			platform: "vercel",
			team_id: target.team_id,
			project: target.project,
			project_id: target.project_id,
			environment: target.environment,
			domains: target.domains,
			canonical_origin: target.canonical_origin,
			operation: target.operation,
			previous_deployment_id: target.current_deployment_id,
			deployment_id: deploymentContext.deployment.id,
			url: deploymentContext.deployment.url,
			deployment_target: "production",
		},
		source_run: source,
		package_artifact: { id: packageId, name: packageArtifact.name, archive_digest: packageArchiveDigest },
		upstream_artifact: upstream,
		core: composition.core,
		site: composition.site,
		output_digest: manifest.output_digest,
		byte_output_digest: browser.byteOutputDigest,
		inventory_digest: browser.inventoryDigest,
		browser,
		workflow: normalizedWorkflow,
		production_action: true,
		indexing_action: false,
		dns_action: false,
		release_action: false,
	};
	return assertProductionReleaseRecord(record);
}

export function assertProductionReleaseRecord(record) {
	if (!record || record.schema_version !== 1 || record.kind !== "kirari-production-release" || record.result !== "PASS") fail("PRODUCTION_RELEASE_RECORD_NOT_PASS");
	exactKeys(record, ["schema_version", "kind", "result", "authorization", "target", "source_run", "package_artifact", "upstream_artifact", "core", "site", "output_digest", "byte_output_digest", "inventory_digest", "browser", "workflow", "production_action", "indexing_action", "dns_action", "release_action"], "PRODUCTION_RELEASE_RECORD_INVALID");
	const target = record.target;
	exactKeys(target, ["platform", "team_id", "project", "project_id", "environment", "domains", "canonical_origin", "operation", "previous_deployment_id", "deployment_id", "url", "deployment_target"], "PRODUCTION_RELEASE_TARGET_INVALID");
	if (!target || target.platform !== "vercel" || target.environment !== "production" || target.deployment_target !== "production" || target.operation !== "deploy" || typeof target.project !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(target.project) || !/^prj_[A-Za-z0-9]+$/.test(target.project_id ?? "") || !/^team_[A-Za-z0-9]+$/.test(target.team_id ?? "") || !DEPLOYMENT_ID.test(target.deployment_id ?? "")) fail("PRODUCTION_RELEASE_TARGET_INVALID");
	if (target.previous_deployment_id !== null && !DEPLOYMENT_ID.test(target.previous_deployment_id ?? "")) fail("PRODUCTION_RELEASE_TARGET_INVALID");
	let canonicalOrigin;
	let deploymentUrl;
	try {
		canonicalOrigin = new URL(target.canonical_origin);
		deploymentUrl = new URL(target.url);
	} catch { fail("PRODUCTION_RELEASE_TARGET_INVALID"); }
	if (canonicalOrigin.protocol !== "https:" || canonicalOrigin.username || canonicalOrigin.password || canonicalOrigin.port || canonicalOrigin.pathname !== "/" || canonicalOrigin.search || canonicalOrigin.hash || target.canonical_origin !== canonicalOrigin.origin) fail("PRODUCTION_RELEASE_TARGET_INVALID");
	if (deploymentUrl.protocol !== "https:" || deploymentUrl.username || deploymentUrl.password || deploymentUrl.port || deploymentUrl.pathname !== "/" || deploymentUrl.search || deploymentUrl.hash || target.url !== deploymentUrl.origin || !deploymentUrl.hostname.startsWith(`${target.project}-`) || !deploymentUrl.hostname.endsWith(".vercel.app")) fail("PRODUCTION_RELEASE_TARGET_INVALID");
	if (!Array.isArray(target.domains) || !target.domains.length || new Set(target.domains).size !== target.domains.length || !target.domains.every((domain) => typeof domain === "string" && domain.length <= 253 && domain === domain.toLowerCase() && domain.split(".").length >= 2 && domain.split(".").every((label) => label.length > 0 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) || JSON.stringify(target.domains) !== JSON.stringify([...target.domains].sort()) || !target.domains.includes(canonicalOrigin.hostname)) fail("PRODUCTION_RELEASE_TARGET_INVALID");
	assertSha256(record.authorization?.binding_digest, "PRODUCTION_RELEASE_AUTHORIZATION_INVALID");
	exactKeys(record.authorization, ["binding_digest", "actor", "repository"], "PRODUCTION_RELEASE_AUTHORIZATION_INVALID");
	safeIdentity(record.authorization?.actor, "PRODUCTION_RELEASE_AUTHORIZATION_INVALID");
	if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(record.authorization?.repository ?? "") || record.authorization.actor.toLowerCase() !== record.authorization.repository.split("/")[0].toLowerCase() || record.authorization.actor !== record.workflow?.triggering_actor) fail("PRODUCTION_RELEASE_AUTHORIZATION_INVALID");
	exactKeys(record.source_run, ["id", "attempt", "sha"], "PRODUCTION_RELEASE_SOURCE_INVALID");
	if (assertRunNumber(record.source_run?.id, "PRODUCTION_RELEASE_SOURCE_INVALID") !== record.source_run.id || assertRunNumber(record.source_run?.attempt, "PRODUCTION_RELEASE_SOURCE_INVALID") !== record.source_run.attempt) fail("PRODUCTION_RELEASE_SOURCE_INVALID");
	assertSha1(record.source_run?.sha, "PRODUCTION_RELEASE_SOURCE_INVALID");
	exactKeys(record.package_artifact, ["id", "name", "archive_digest"], "PRODUCTION_RELEASE_PACKAGE_INVALID");
	if (assertRunNumber(record.package_artifact?.id, "PRODUCTION_RELEASE_PACKAGE_INVALID") !== record.package_artifact.id || !SAFE_ARTIFACT_NAME.test(record.package_artifact?.name ?? "")) fail("PRODUCTION_RELEASE_PACKAGE_INVALID");
	assertSha256(record.package_artifact?.archive_digest, "PRODUCTION_RELEASE_PACKAGE_INVALID");
	if (record.package_artifact.name !== `kirari-site-package-${record.source_run.id}-${record.source_run.attempt}`) fail("PRODUCTION_RELEASE_PACKAGE_INVALID");
	exactKeys(record.upstream_artifact, ["id", "name", "run_id", "run_attempt", "digest"], "PRODUCTION_RELEASE_UPSTREAM_INVALID");
	if (!POSITIVE_INTEGER.test(String(record.upstream_artifact?.id ?? "")) || String(record.upstream_artifact?.run_id ?? "") !== record.source_run.id || String(record.upstream_artifact?.run_attempt ?? "") !== record.source_run.attempt || record.upstream_artifact?.name !== `kirari-composition-${record.source_run.id}-${record.source_run.attempt}`) fail("PRODUCTION_RELEASE_UPSTREAM_INVALID");
	assertSha256(record.upstream_artifact?.digest, "PRODUCTION_RELEASE_UPSTREAM_INVALID");
	assertSha256(record.output_digest, "PRODUCTION_RELEASE_OUTPUT_INVALID");
	assertSha256(record.byte_output_digest, "PRODUCTION_RELEASE_OUTPUT_INVALID");
	assertSha256(record.inventory_digest, "PRODUCTION_RELEASE_OUTPUT_INVALID");
	assertReleaseIdentity(record.core, "core", record.source_run.sha);
	const siteSlug = assertReleaseIdentity(record.site, "site", record.site?.resolved_sha);
	if (siteSlug.toLowerCase() !== record.authorization.repository.toLowerCase()) fail("PRODUCTION_RELEASE_COMPOSITION_INVALID");
	if (record.core.resolved_sha !== record.source_run.sha) fail("PRODUCTION_RELEASE_COMPOSITION_INVALID");
	const browser = assertProductionBrowserReport(record.browser);
	if (browser.phase !== "live" || browser.baseUrl !== target.canonical_origin || browser.canonicalOrigin !== target.canonical_origin || browser.byteOutputDigest !== record.byte_output_digest || browser.inventoryDigest !== record.inventory_digest) fail("PRODUCTION_RELEASE_BROWSER_MISMATCH");
	exactKeys(record.workflow, ["id", "attempt", "sha", "main_sha", "path", "actor", "triggering_actor", "created_at"], "PRODUCTION_RELEASE_WORKFLOW_INVALID");
	if (!record.workflow || assertRunNumber(record.workflow.id, "PRODUCTION_RELEASE_WORKFLOW_INVALID") !== record.workflow.id || assertRunNumber(record.workflow.attempt, "PRODUCTION_RELEASE_WORKFLOW_INVALID") !== record.workflow.attempt || record.workflow.attempt !== "1") fail("PRODUCTION_RELEASE_WORKFLOW_INVALID");
	assertSha1(record.workflow.sha, "PRODUCTION_RELEASE_WORKFLOW_INVALID");
	assertSha1(record.workflow.main_sha, "PRODUCTION_RELEASE_WORKFLOW_INVALID");
	if (record.workflow.main_sha !== record.workflow.sha || record.workflow.path !== ".github/workflows/site-production.yml" || !validTime(record.workflow.created_at)) fail("PRODUCTION_RELEASE_WORKFLOW_INVALID");
	safeIdentity(record.workflow.actor, "PRODUCTION_RELEASE_WORKFLOW_INVALID");
	safeIdentity(record.workflow.triggering_actor, "PRODUCTION_RELEASE_WORKFLOW_INVALID");
	if (record.workflow.actor !== record.workflow.triggering_actor) fail("PRODUCTION_RELEASE_WORKFLOW_INVALID");
	if (record.production_action !== true || record.indexing_action !== false || record.dns_action !== false || record.release_action !== false) fail("PRODUCTION_RELEASE_ACTION_FLAGS_INVALID");
	return record;
}

function assertReleaseIdentity(identity, label, requiredSha) {
	const expectedKeys = label === "site" ? ["kind", "repository", "requested_ref", "resolved_sha", "source_subdirectory"] : ["kind", "repository", "requested_ref", "resolved_sha"];
	exactKeys(identity, expectedKeys, "PRODUCTION_RELEASE_COMPOSITION_INVALID");
	if (identity.kind !== "git") fail("PRODUCTION_RELEASE_COMPOSITION_INVALID");
	const slug = githubRepositorySlug(identity.repository, "PRODUCTION_RELEASE_COMPOSITION_INVALID");
	boundedRequestedRef(identity.requested_ref, "PRODUCTION_RELEASE_COMPOSITION_INVALID");
	assertSha1(identity.resolved_sha, "PRODUCTION_RELEASE_COMPOSITION_INVALID");
	if (requiredSha && identity.resolved_sha !== requiredSha) fail("PRODUCTION_RELEASE_COMPOSITION_INVALID");
	if (label === "site") safeSubdirectory(identity.source_subdirectory, "PRODUCTION_RELEASE_COMPOSITION_INVALID");
	return slug;
}

export function writeProductionReleaseRecord(path, record) {
	const validated = assertProductionReleaseRecord(record);
	writeFileSync(path, `${JSON.stringify(validated, null, 2)}\n`, { flag: "wx" });
	return validated;
}
