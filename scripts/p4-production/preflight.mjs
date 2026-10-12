#!/usr/bin/env node

import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
	assertAuthorizationClaimPresent,
	assertAuthorizationClaimUnused,
	assertProductionApproval,
	assertProductionDispatchContext,
	assertProductionSourceRun,
	assertProtectedProductionEnvironment,
	assertSourceShaIsMainAncestor,
	normalizeProductionBinding,
	productionAuthorizationArtifactName,
} from "../production-authorization.mjs";
import { downloadVerifiedArtifact, extractSiteArtifactArchive, verifySitePackageArchive } from "../site-artifact.mjs";

const API = "https://api.github.com";
const CLAIM_FILE = "authorization-claim.json";
const GITHUB_API_VERSION = "2022-11-28";
const MAX_JSON_BYTES = 1_048_576;
const MAX_CLAIM_BYTES = 16_384;

function fail(message) {
	throw new Error(message);
}

function assert(condition, message) {
	if (!condition) fail(message);
}

function exactKeys(value, keys, label) {
	assert(value && typeof value === "object" && !Array.isArray(value), `${label} is invalid`);
	const actual = Object.keys(value).sort();
	const expected = [...keys].sort();
	assert(JSON.stringify(actual) === JSON.stringify(expected), `${label} has missing or unsupported fields`);
}

function validSha(value) {
	return typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
}

function validDigest(value) {
	return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
}

function validateRepository(repository) {
	assert(typeof repository === "string" && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository), "GitHub repository identity is invalid");
	return repository.split("/").map(encodeURIComponent);
}

function githubUrl(repository, pathname, query = {}, apiBaseUrl = API) {
	const [owner, repo] = validateRepository(repository);
	const base = new URL(apiBaseUrl);
	assert(base.protocol === "https:" && !base.username && !base.password, "GitHub API base URL is invalid");
	const url = new URL(`/repos/${owner}/${repo}/${pathname.replace(/^\/+/, "")}`, base);
	for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
	return url;
}

async function githubJson(repository, pathname, { token, fetchImpl = fetch, query = {}, apiBaseUrl = API } = {}) {
	assert(typeof token === "string" && token.length > 0, "GitHub read token is unavailable");
	let response;
	try {
		response = await fetchImpl(githubUrl(repository, pathname, query, apiBaseUrl), {
			method: "GET",
			redirect: "error",
			signal: AbortSignal.timeout(30_000),
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/vnd.github+json",
				"X-GitHub-Api-Version": GITHUB_API_VERSION,
			},
		});
	} catch {
		fail("GitHub authorization metadata read failed");
	}
	assert(response?.ok, `GitHub authorization metadata read failed (${response?.status ?? "network"})`);
	let text;
	try {
		text = await response.text();
	} catch {
		fail("GitHub authorization metadata response is unreadable");
	}
	assert(Buffer.byteLength(text, "utf8") <= MAX_JSON_BYTES, "GitHub authorization metadata response exceeds its size limit");
	try {
		return JSON.parse(text);
	} catch {
		fail("GitHub authorization metadata response is not valid JSON");
	}
}

function envContext(env = process.env) {
	return {
		eventName: env.GITHUB_EVENT_NAME,
		ref: env.GITHUB_REF,
		actor: env.GITHUB_ACTOR,
		triggeringActor: env.PRODUCTION_TRIGGERING_ACTOR ?? env.GITHUB_TRIGGERING_ACTOR,
		repositoryOwner: env.GITHUB_REPOSITORY_OWNER,
		repository: env.GITHUB_REPOSITORY,
		workflowRef: env.GITHUB_WORKFLOW_REF,
		workflowSha: env.PRODUCTION_WORKFLOW_SHA ?? env.GITHUB_WORKFLOW_SHA,
		sha: env.GITHUB_SHA,
		runAttempt: env.GITHUB_RUN_ATTEMPT,
		runId: env.GITHUB_RUN_ID,
	};
}

function normalizeContext(value) {
	if (!value || typeof value !== "object" || Array.isArray(value)) return envContext();
	if ("eventName" in value || "workflowRef" in value) return {
		...value,
		eventName: value.eventName ?? value.GITHUB_EVENT_NAME,
		ref: value.ref ?? value.GITHUB_REF,
		actor: value.actor ?? value.GITHUB_ACTOR,
		triggeringActor: value.triggeringActor ?? value.PRODUCTION_TRIGGERING_ACTOR ?? value.GITHUB_TRIGGERING_ACTOR,
		repositoryOwner: value.repositoryOwner ?? value.GITHUB_REPOSITORY_OWNER,
		repository: value.repository ?? value.GITHUB_REPOSITORY,
		workflowRef: value.workflowRef ?? value.GITHUB_WORKFLOW_REF,
		workflowSha: value.workflowSha ?? value.PRODUCTION_WORKFLOW_SHA ?? value.GITHUB_WORKFLOW_SHA,
		sha: value.sha ?? value.GITHUB_SHA,
		runAttempt: value.runAttempt ?? value.GITHUB_RUN_ATTEMPT,
		runId: value.runId ?? value.GITHUB_RUN_ID,
	};
	return envContext(value);
}

async function getClaimArtifacts(repository, artifactName, options) {
	const response = await githubJson(repository, "actions/artifacts", { ...options, query: { name: artifactName, per_page: 100, page: 1 } });
	assert(response && Array.isArray(response.artifacts) && Number.isSafeInteger(response.total_count), "GitHub authorization claim listing is invalid");
	assert(response.total_count <= 100 && response.artifacts.length === response.total_count, "GitHub authorization claim listing is incomplete");
	return response.artifacts;
}

function validateArtifactIdentity(artifact, { id, name, digest, runId, sha, nowMs = Date.now() } = {}) {
	assert(artifact && typeof artifact === "object" && !Array.isArray(artifact), "GitHub artifact metadata is invalid");
	assert(String(artifact.id) === String(id) && artifact.name === name && artifact.digest === digest, "GitHub artifact metadata does not match its approved identity");
	assert(artifact.expired === false && Number.isFinite(Date.parse(artifact.expires_at)) && Date.parse(artifact.expires_at) > nowMs, "GitHub artifact is expired or has invalid expiration metadata");
	assert(String(artifact.workflow_run?.id) === String(runId) && artifact.workflow_run?.head_branch === "main" && artifact.workflow_run?.head_sha === sha, "GitHub artifact does not belong to the expected main-branch workflow run");
	return artifact;
}

function validatePackageVerification(binding, verification) {
	assert(verification && verification.result === "PASS", "immutable Site package verification did not pass");
	const expectedPackageName = `kirari-site-package-${binding.source.run_id}-${binding.source.run_attempt}`;
	const packageArtifact = verification.packageArtifact;
	assert(packageArtifact && String(packageArtifact.id) === binding.package.artifact_id && packageArtifact.name === expectedPackageName && packageArtifact.digest === binding.package.archive_digest, "verified Site package identity does not match the owner binding");
	assert(verification.packageArchiveSha256 === binding.package.archive_digest, "verified Site package archive digest does not match the owner binding");
	const manifest = verification.manifest;
	assert(manifest?.schema_version === 1 && manifest.core?.resolved_sha === binding.composition.core_sha && manifest.site?.resolved_sha === binding.composition.site_sha, "verified package Core/Site provenance does not match the owner binding");
	assert(manifest.core.resolved_sha === binding.source.sha, "verified package Core SHA does not match the trusted source CI run");
	assert(validDigest(manifest.output_digest) && verification.outputDigest === manifest.output_digest, "verified package output digest is invalid");
	const upstream = manifest.upstream_github_artifact;
	const verifiedUpstream = verification.upstreamArtifact ?? verification.upstream;
	assert(upstream && verifiedUpstream && String(upstream.id) === String(verifiedUpstream.id) && upstream.name === verifiedUpstream.name && upstream.digest === verifiedUpstream.digest, "verified composition artifact identity does not match the package manifest");
	assert(String(upstream.run_id) === binding.source.run_id && String(upstream.run_attempt) === String(binding.source.run_attempt), "verified composition artifact source does not match the trusted CI run");
	assert(validDigest(upstream.digest), "verified composition archive digest is invalid");
	return { packageArtifact, upstreamArtifact: verifiedUpstream, manifest };
}

function validateClaim(claim, { binding, digest, artifactName, runId, runAttempt, actor, triggeringActor } = {}) {
	exactKeys(claim, ["schema_version", "binding_digest", "artifact_name", "run_id", "run_attempt", "actor", "triggering_actor", "workflow_sha", "main_sha", "issued_at"], "authorization claim");
	assert(claim.schema_version === 1 && claim.binding_digest === digest && claim.artifact_name === artifactName, "authorization claim does not match the exact owner approval");
	assert(String(claim.run_id) === String(runId) && Number(claim.run_attempt) === Number(runAttempt) && Number(runAttempt) === 1, "authorization claim belongs to another workflow run or attempt");
	const owner = binding.repository.split("/")[0].toLowerCase();
	assert(String(claim.actor).toLowerCase() === owner && String(claim.triggering_actor).toLowerCase() === owner && String(actor).toLowerCase() === owner && String(triggeringActor).toLowerCase() === owner, "authorization claim is not owner-triggered");
	assert(claim.workflow_sha === binding.workflow_sha && claim.main_sha === binding.main_sha, "authorization claim workflow SHA does not match the approval");
	assert(Number.isSafeInteger(claim.issued_at) && claim.issued_at === binding.issued_at, "authorization claim issuance time does not match the approval");
	return claim;
}

async function readAndVerifyClaim({ binding, digest, artifactName, token, repository, context, fetchImpl, expectedClaimArtifactId, expectedClaimDigest, nowMs = Date.now() }) {
	const artifacts = await getClaimArtifacts(repository, artifactName, { token, fetchImpl });
	assertAuthorizationClaimPresent(artifacts.map((artifact) => artifact.name), digest);
	assert(artifacts.length === 1, "authorization claim artifact name is ambiguous");
	const artifact = artifacts[0];
	const runId = String(context.runId ?? "");
	const sha = String(context.sha ?? "");
	validateArtifactIdentity(artifact, {
		id: expectedClaimArtifactId ?? artifact.id,
		name: artifactName,
		digest: expectedClaimDigest ?? artifact.digest,
		runId,
		sha,
		nowMs,
	});
	const temp = mkdtempSync(join(tmpdir(), "kirari-p4-claim-"));
	try {
		const archivePath = join(temp, "claim.zip");
		await downloadVerifiedArtifact({
			repository,
			artifactId: String(artifact.id),
			expectedName: artifactName,
			expectedDigest: artifact.digest,
			expectedRun: { id: runId, attempt: String(context.runAttempt), head_sha: sha, head_branch: "main" },
			token,
			destination: archivePath,
			fetchImpl,
		});
		const claimDirectory = join(temp, "extracted");
		extractSiteArtifactArchive(archivePath, claimDirectory);
		const entries = readdirSync(claimDirectory).sort();
		assert(JSON.stringify(entries) === JSON.stringify([CLAIM_FILE]), "authorization claim archive contains unexpected files");
		const claimBytes = readFileSync(join(claimDirectory, CLAIM_FILE));
		assert(claimBytes.length <= MAX_CLAIM_BYTES, "authorization claim exceeds its size limit");
		let claim;
		try { claim = JSON.parse(claimBytes.toString("utf8")); } catch { fail("authorization claim is not valid JSON"); }
		validateClaim(claim, { binding, digest, artifactName, runId, runAttempt: context.runAttempt, actor: context.actor, triggeringActor: context.triggeringActor });
		return { id: String(artifact.id), name: artifactName, digest: artifact.digest, claim };
	} finally {
		rmSync(temp, { recursive: true, force: true });
	}
}

function assertRollbackCandidateBinding(binding, rollbackCandidate) {
	assert(rollbackCandidate && rollbackCandidate.approved && rollbackCandidate.record, "approved prior production release is required for this operation");
	const approved = binding.rollback_record;
	for (const key of ["run_id", "run_attempt", "workflow_sha", "artifact_id", "archive_digest", "record_digest", "deployment_id"]) {
		assert(String(rollbackCandidate.approved[key]) === String(approved[key]), `approved prior release ${key} does not match the owner binding`);
	}
	const record = rollbackCandidate.record;
	assert(record.kind === "kirari-production-release" && record.result === "PASS" && record.target?.deployment_id === approved.deployment_id, "prior production release evidence is invalid");
	const target = binding.target;
	assert(record.target?.project === target.project && record.target?.project_id === target.project_id && record.target?.team_id === target.team_id && record.target?.environment === target.environment, "prior release target does not match the approved operation");
	assert(record.target?.canonical_origin === target.canonical_origin && JSON.stringify([...(record.target?.domains ?? [])].sort()) === JSON.stringify(target.domains), "prior release domain set does not match the approved operation");
	assert(rollbackCandidate.target?.deployment_id === approved.deployment_id, "prior release deployment does not match the approval");
	if (target.operation === "deploy") assert(approved.deployment_id === target.current_deployment_id, "recovery release must equal the approved current deployment");
	else {
		assert(record.source_run?.id === binding.source.run_id && Number(record.source_run?.attempt) === binding.source.run_attempt && record.source_run?.sha === binding.source.sha, "prior release source does not match the owner binding");
		assert(record.package_artifact?.id === binding.package.artifact_id && record.package_artifact?.archive_digest === binding.package.archive_digest, "prior release package does not match the owner binding");
		assert(record.core?.resolved_sha === binding.composition.core_sha && record.site?.resolved_sha === binding.composition.site_sha, "prior release Core/Site identity does not match the owner binding");
		validatePackageVerification(binding, rollbackCandidate.packageVerification);
	}
	return rollbackCandidate;
}

async function recheckRollbackEvidenceMetadata({ binding, candidate, token, repository, fetchImpl, currentMainSha, nowMs, apiBaseUrl = API }) {
	const approved = binding.rollback_record;
	const run = await githubJson(repository, `actions/runs/${encodeURIComponent(approved.run_id)}/attempts/${approved.run_attempt}`, { token, fetchImpl, apiBaseUrl });
	const owner = repository.split("/")[0].toLowerCase();
	assert(String(run.id) === approved.run_id && Number(run.run_attempt) === approved.run_attempt && run.head_sha === approved.workflow_sha, "prior production workflow run identity mismatch");
	assert(run.event === "workflow_dispatch" && run.path === ".github/workflows/site-production.yml" && run.head_branch === "main" && run.status === "completed" && run.conclusion === "success", "prior release requires a successful manual first-attempt main production run");
	assert(String(run.actor?.login ?? "").toLowerCase() === owner && String(run.triggering_actor?.login ?? "").toLowerCase() === owner, "prior production release was not owner-triggered");
	assert(run.repository?.full_name?.toLowerCase() === repository.toLowerCase() && run.head_repository?.full_name?.toLowerCase() === repository.toLowerCase(), "prior production workflow run repository mismatch");
	assertSourceShaIsMainAncestor(await githubJson(repository, `compare/${approved.workflow_sha}...${currentMainSha}`, { token, fetchImpl, apiBaseUrl }), approved.workflow_sha);
	const artifact = await githubJson(repository, `actions/artifacts/${encodeURIComponent(approved.artifact_id)}`, { token, fetchImpl, apiBaseUrl });
	validateArtifactIdentity(artifact, {
		id: approved.artifact_id,
		name: `kirari-p4-production-${approved.run_id}-${approved.run_attempt}`,
		digest: approved.archive_digest,
		runId: approved.run_id,
		sha: approved.workflow_sha,
		nowMs,
	});
	const { releaseRecordDigest } = await import("./rollback.mjs");
	assert(releaseRecordDigest(candidate.record) === approved.record_digest, "prior release record digest no longer matches its approval");
	return true;
}

async function verifySourceAndMain({ binding, token, repository, context, fetchImpl, apiBaseUrl = API }) {
	const branch = await githubJson(repository, "branches/main", { token, fetchImpl, apiBaseUrl });
	const currentMainSha = String(branch.commit?.sha ?? "").toLowerCase();
	assert(validSha(currentMainSha), "current main branch SHA is unavailable");
	const dispatchContext = { ...context, currentMainSha };
	assertProductionDispatchContext(dispatchContext, binding);
	const sourceRun = await githubJson(repository, `actions/runs/${encodeURIComponent(binding.source.run_id)}/attempts/${binding.source.run_attempt}`, { token, fetchImpl, apiBaseUrl });
	assertProductionSourceRun(sourceRun, binding);
	const comparison = await githubJson(repository, `compare/${binding.source.sha}...${currentMainSha}`, { token, fetchImpl, apiBaseUrl });
	assertSourceShaIsMainAncestor(comparison, binding.source.sha);
	return { currentMainSha, sourceRun };
}

async function verifyEnvironment({ binding, token, repository, fetchImpl, apiBaseUrl = API }) {
	const envPath = `environments/${encodeURIComponent("kirari-site-production")}`;
	const environment = await githubJson(repository, envPath, { token, fetchImpl, apiBaseUrl });
	const policies = await githubJson(repository, `${envPath}/deployment-branch-policies`, { token, fetchImpl, query: { per_page: 100, page: 1 }, apiBaseUrl });
	assertProtectedProductionEnvironment(environment, policies, { owner: repository.split("/")[0] });
	return environment;
}

async function verifyClaimState({ binding, digest, artifactName, token, repository, context, fetchImpl, requireClaim, expectedClaimArtifactId, expectedClaimDigest, nowMs }) {
	const artifacts = await getClaimArtifacts(repository, artifactName, { token, fetchImpl });
	if (!requireClaim) {
		assertAuthorizationClaimUnused(artifacts.map((artifact) => artifact.name), digest);
		return null;
	}
	return readAndVerifyClaim({ binding, digest, artifactName, token, repository, context, fetchImpl, expectedClaimArtifactId, expectedClaimDigest, nowMs });
}

/**
 * Metadata-only production write guard. It never reads or uses a Vercel token.
 * All GitHub facts that can change are re-read on each call; package bytes and
 * release evidence are supplied only after their corresponding immutable
 * verifier has passed in the no-secret preflight.
 */
export async function verifyProductionPreflight({
	binding: rawBinding,
	ownerAuthorization,
	requireClaim = true,
	expectedClaimArtifactId = process.env.PRODUCTION_CLAIM_ARTIFACT_ID,
	expectedClaimDigest = process.env.PRODUCTION_CLAIM_DIGEST,
	expectedCurrentRunId = process.env.GITHUB_RUN_ID,
	packageVerification,
	rollbackCandidate,
	skipRollbackCandidate = false,
	token = process.env.GH_TOKEN,
	repository = process.env.GITHUB_REPOSITORY,
	context = envContext(),
	fetchImpl = fetch,
	nowSeconds = Math.floor(Date.now() / 1000),
	nowMs = Date.now(),
	apiBaseUrl = API,
} = {}) {
	const binding = normalizeProductionBinding(rawBinding);
	context = normalizeContext(context);
	assert(repository === binding.repository && context.repository === binding.repository, "current repository does not match the approval binding");
	assert(String(context.runAttempt) === "1", "production authorization cannot be replayed by rerunning a workflow attempt");
	assert(typeof context.runId === "string" && /^[1-9][0-9]*$/.test(context.runId), "current workflow run identity is invalid");
	if (expectedCurrentRunId !== undefined) assert(context.runId === String(expectedCurrentRunId), "current workflow run ID does not match the expected dispatch");
	const approval = assertProductionApproval(binding, ownerAuthorization, { nowSeconds });
	const { currentMainSha } = await verifySourceAndMain({ binding, token, repository, context, fetchImpl, apiBaseUrl });
	await verifyEnvironment({ binding, token, repository, fetchImpl, apiBaseUrl });
	const claimArtifactName = productionAuthorizationArtifactName(approval.digest);
	const claimArtifact = await verifyClaimState({
		binding,
		digest: approval.digest,
		artifactName: claimArtifactName,
		token,
		repository,
		context,
		fetchImpl,
		requireClaim,
		expectedClaimArtifactId,
		expectedClaimDigest,
		nowMs,
	});

	let selectedPackageVerification = packageVerification;
	const selectedRollbackCandidate = rollbackCandidate;
	if (binding.rollback_record && !skipRollbackCandidate) {
		assert(selectedRollbackCandidate, "verified prior production release is required for this operation");
		assertRollbackCandidateBinding(binding, selectedRollbackCandidate);
		await recheckRollbackEvidenceMetadata({ binding, candidate: selectedRollbackCandidate, token, repository, fetchImpl, currentMainSha, nowMs, apiBaseUrl });
	}
	if (binding.target.operation === "rollback" && !skipRollbackCandidate) {
		if (!selectedPackageVerification) selectedPackageVerification = selectedRollbackCandidate?.packageVerification;
		assert(selectedPackageVerification, "verified retained release package is required for this operation");
		validatePackageVerification(binding, selectedPackageVerification);
	} else if (selectedPackageVerification) {
		validatePackageVerification(binding, selectedPackageVerification);
	}

	if (binding.target.operation === "deploy" && selectedPackageVerification) {
		await verifyArtifactMetadataForPackage(binding, selectedPackageVerification, { token, repository, fetchImpl, nowMs, apiBaseUrl });
	}
	return {
		binding,
		bindingDigest: approval.digest,
		claimArtifactName,
		claimArtifact,
		currentMainSha,
		packageVerification: selectedPackageVerification,
		rollbackCandidate: selectedRollbackCandidate,
	};
}

function requiredEnv(name, env = process.env) {
	assert(typeof env[name] === "string" && env[name].length > 0, `${name} is required`);
	return env[name];
}

function parseBindingFromEnv(env = process.env) {
	const raw = requiredEnv("PRODUCTION_APPROVAL_BINDING_JSON", env);
	try { return normalizeProductionBinding(JSON.parse(raw)); } catch { fail("owner approval binding JSON is invalid"); }
}

function writeNewJson(path, value) {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", mode: 0o600 });
}

function writeOutput(values, env = process.env) {
	const outputPath = requiredEnv("GITHUB_OUTPUT", env);
	const text = Object.entries(values).map(([name, value]) => {
		assert(typeof value === "string" && !/[\r\n]/.test(value), `workflow output ${name} is invalid`);
		return `${name}=${value}`;
	}).join("\n");
	writeFileSync(outputPath, `${text}\n`, { flag: "a", mode: 0o600 });
}

function claimContents(binding, digest, artifactName, context) {
	return {
		schema_version: 1,
		binding_digest: digest,
		artifact_name: artifactName,
		run_id: String(context.runId),
		run_attempt: Number(context.runAttempt),
		actor: context.actor,
		triggering_actor: context.triggeringActor,
		workflow_sha: binding.workflow_sha,
		main_sha: binding.main_sha,
		issued_at: binding.issued_at,
	};
}

function packageExpected(binding) {
	return {
		schema_version: 1,
		source: {
			run_id: binding.source.run_id,
			run_attempt: String(binding.source.run_attempt),
			head_sha: binding.source.sha,
			ref: "refs/heads/main",
			event: "workflow_dispatch",
			conclusion: "success",
			workflow_path: ".github/workflows/ci.yml",
		},
		package: {
			id: binding.package.artifact_id,
			name: `kirari-site-package-${binding.source.run_id}-${binding.source.run_attempt}`,
			digest: binding.package.archive_digest,
		},
	};
}

async function verifyArtifactMetadataForPackage(binding, verification, { token, repository, fetchImpl, nowMs, apiBaseUrl = API }) {
	const { packageArtifact, upstreamArtifact, manifest } = validatePackageVerification(binding, verification);
	const packageRecord = await githubJson(repository, `actions/artifacts/${encodeURIComponent(binding.package.artifact_id)}`, { token, fetchImpl, apiBaseUrl });
	validateArtifactIdentity(packageRecord, {
		id: binding.package.artifact_id,
		name: packageArtifact.name,
		digest: binding.package.archive_digest,
		runId: binding.source.run_id,
		sha: binding.source.sha,
		nowMs,
	});
	const upstreamRecord = await githubJson(repository, `actions/artifacts/${encodeURIComponent(String(upstreamArtifact.id))}`, { token, fetchImpl, apiBaseUrl });
	validateArtifactIdentity(upstreamRecord, {
		id: upstreamArtifact.id,
		name: upstreamArtifact.name,
		digest: upstreamArtifact.digest,
		runId: binding.source.run_id,
		sha: binding.source.sha,
		nowMs,
	});
	assert(String(manifest.upstream_github_artifact.id) === String(upstreamRecord.id), "composition artifact metadata does not match the verified package");
	return { packageArtifact, upstreamArtifact };
}

async function loadBoundRollback(binding, { token, repository, fetchImpl = fetch, parentDirectory }) {
	if (!binding.rollback_record) return { candidate: null, directory: null };
	const { loadApprovedRollback } = await import("./rollback.mjs");
	const directory = join(parentDirectory, `kirari-p4-approved-rollback-${randomUUID()}`);
	try {
		const loaded = await loadApprovedRollback({ binding, token, repository, outputDirectory: directory, fetchImpl });
		return { candidate: loaded.candidate, directory };
	} catch (error) {
		rmSync(directory, { recursive: true, force: true });
		throw error;
	}
}

async function claim(env = process.env) {
	const binding = parseBindingFromEnv(env);
	const context = { ...envContext(env), runId: env.GITHUB_RUN_ID };
	const token = requiredEnv("GH_TOKEN", env);
	const repository = requiredEnv("GITHUB_REPOSITORY", env);
	const ownerAuthorization = requiredEnv("OWNER_AUTHORIZATION", env);
	const checked = await verifyProductionPreflight({ binding, ownerAuthorization, requireClaim: false, token, repository, context, expectedCurrentRunId: context.runId, skipRollbackCandidate: true });
	const runnerTemp = requiredEnv("RUNNER_TEMP", env);
	const claimPath = join(runnerTemp, CLAIM_FILE);
	writeNewJson(claimPath, claimContents(binding, checked.bindingDigest, checked.claimArtifactName, context));
	writeOutput({ binding_digest: checked.bindingDigest, claim_artifact_name: checked.claimArtifactName, claim_path: claimPath }, env);
	return { bindingDigest: checked.bindingDigest, claimArtifactName: checked.claimArtifactName };
}

async function prepare(env = process.env) {
	const binding = parseBindingFromEnv(env);
	const context = { ...envContext(env), runId: env.GITHUB_RUN_ID };
	const token = requiredEnv("GH_TOKEN", env);
	const repository = requiredEnv("GITHUB_REPOSITORY", env);
	const ownerAuthorization = requiredEnv("OWNER_AUTHORIZATION", env);
	const expectedClaimArtifactId = requiredEnv("PRODUCTION_CLAIM_ARTIFACT_ID", env);
	const expectedClaimDigest = requiredEnv("PRODUCTION_CLAIM_DIGEST", env);
	const { candidate, directory: rollbackDirectory } = await loadBoundRollback(binding, { token, repository, fetchImpl: fetch, parentDirectory: requiredEnv("RUNNER_TEMP", env) });
	try {
		const initial = await verifyProductionPreflight({ binding, ownerAuthorization, requireClaim: true, expectedClaimArtifactId, expectedClaimDigest, token, repository, context, expectedCurrentRunId: context.runId, rollbackCandidate: candidate });
		let verification;
		if (binding.target.operation === "rollback") verification = candidate.packageVerification;
		else verification = await verifySitePackageArchive({ expected: packageExpected(binding), outputDirectory: join(requiredEnv("RUNNER_TEMP", env), "kirari-p4-site-package"), token, repository });
		await verifyProductionPreflight({ binding: initial.binding, ownerAuthorization, requireClaim: true, expectedClaimArtifactId, expectedClaimDigest, packageVerification: verification, token, repository, context, expectedCurrentRunId: context.runId, rollbackCandidate: candidate });
		return { result: "PASS", bindingDigest: initial.bindingDigest, packageDigest: verification.packageArchiveSha256 };
	} finally {
		if (rollbackDirectory) rmSync(rollbackDirectory, { recursive: true, force: true });
	}
}

async function consume(env = process.env) {
	const binding = parseBindingFromEnv(env);
	const context = { ...envContext(env), runId: env.GITHUB_RUN_ID };
	const token = requiredEnv("GH_TOKEN", env);
	const repository = requiredEnv("GITHUB_REPOSITORY", env);
	const ownerAuthorization = requiredEnv("OWNER_AUTHORIZATION", env);
	const expectedClaimArtifactId = requiredEnv("PRODUCTION_CLAIM_ARTIFACT_ID", env);
	const expectedClaimDigest = requiredEnv("PRODUCTION_CLAIM_DIGEST", env);
	const runnerTemp = requiredEnv("RUNNER_TEMP", env);
	const packageDirectory = join(runnerTemp, "kirari-p4-site-package");
	const evidenceDirectory = join(runnerTemp, "kirari-p4-evidence");
	const archiveDirectory = join(evidenceDirectory, "retained");
	let verification;
	const { candidate, directory: rollbackDirectory } = await loadBoundRollback(binding, { token, repository, fetchImpl: fetch, parentDirectory: runnerTemp });
	let retainRollbackDirectory = false;
	try {
		const initial = await verifyProductionPreflight({ binding, ownerAuthorization, requireClaim: true, expectedClaimArtifactId, expectedClaimDigest, token, repository, context, expectedCurrentRunId: context.runId, rollbackCandidate: candidate });
		if (binding.target.operation === "rollback") {
			verification = candidate.packageVerification;
			retainRollbackDirectory = true;
			mkdirSync(evidenceDirectory, { recursive: false, mode: 0o700 });
			const { cpSync } = await import("node:fs");
			cpSync(join(rollbackDirectory, "evidence/retained"), archiveDirectory, { recursive: true, errorOnExist: true, force: false });
		} else {
			mkdirSync(evidenceDirectory, { recursive: false, mode: 0o700 });
			verification = await verifySitePackageArchive({
				expected: packageExpected(binding),
				outputDirectory: packageDirectory,
				token,
				repository,
				retainArchiveDirectory: archiveDirectory,
			});
		}
		const verified = await verifyProductionPreflight({
			binding,
			ownerAuthorization,
			requireClaim: true,
			expectedClaimArtifactId,
			expectedClaimDigest,
			packageVerification: verification,
			token,
			repository,
			context,
			expectedCurrentRunId: context.runId,
			rollbackCandidate: candidate,
		});
		const bindingPath = join(runnerTemp, "production-binding.json");
		const verificationPath = join(runnerTemp, "production-package-verification.json");
		writeNewJson(bindingPath, verified.binding);
		writeNewJson(verificationPath, verification);
		writeOutput({
			binding_path: bindingPath,
			package_verification_path: verificationPath,
			package_dir: verification.outputDirectory,
			evidence_dir: evidenceDirectory,
		}, env);
		return { bindingDigest: verified.bindingDigest, packageDirectory: verification.outputDirectory };
	} finally {
		if (rollbackDirectory && !retainRollbackDirectory) rmSync(rollbackDirectory, { recursive: true, force: true });
	}
}

export function verifyProductionPackageIdentity(binding, verification) {
	const normalized = normalizeProductionBinding(binding);
	validatePackageVerification(normalized, verification);
	return true;
}

export async function runProductionPreflightCli(command, env = process.env) {
	if (command === "claim") return claim(env);
	if (command === "prepare") return prepare(env);
	if (command === "consume") return consume(env);
	fail("production preflight command must be claim, prepare or consume");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	try {
		const result = await runProductionPreflightCli(process.argv[2]);
		process.stdout.write(`${JSON.stringify({ result: "PASS", ...result })}\n`);
	} catch (error) {
		const safeMessage = error instanceof Error ? error.message : "production preflight failed";
		process.stderr.write(`${safeMessage}\n`);
		process.exitCode = 1;
	}
}
