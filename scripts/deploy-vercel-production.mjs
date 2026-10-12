#!/usr/bin/env node

import { createHash } from "node:crypto";
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { compareRemoteFileInventory, deploymentFiles, fileInventory, verifySitePackage, vercelRequest } from "./site-artifact.mjs";

const PROJECT_ID = /^prj_[A-Za-z0-9]+$/;
const TEAM_ID = /^team_[A-Za-z0-9]+$/;
const DEPLOYMENT_ID = /^dpl_[A-Za-z0-9]+$/;
const HASH = /^[a-f0-9]{40}$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const GITHUB_OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const REPOSITORY = "markd3ng/KIRARI";
const WORKFLOW_PATH = ".github/workflows/site-production.yml";
const OIDC_AUDIENCE = "https://github.com/markd3ng";
const MAX_JSON_BYTES = 32 * 1024 * 1024;
const MAX_PAGES = 20;
const API = "https://api.vercel.com";

function assertRecord(value, message) {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
}

function projectTarget(target) {
	assertRecord(target, "Approved Production target is required");
	const project = target.project ?? target.projectName;
	const projectId = target.project_id ?? target.projectId;
	const teamId = target.team_id ?? target.teamId;
	if (typeof project !== "string" || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(project) || !PROJECT_ID.test(projectId ?? "") || !TEAM_ID.test(teamId ?? "")) {
		throw new Error("Approved Production project identity is invalid");
	}
	if (target.environment !== "production") throw new Error("Approved Vercel target must be Production");
	if ((target.repository ?? REPOSITORY) !== REPOSITORY) throw new Error("Approved GitHub repository does not match the reviewed source");
	return { project, projectId, teamId };
}

export function githubDeploymentMetadata(target, artifact) {
	projectTarget(target);
	const repository = target.repository ?? REPOSITORY;
	const sourceSha = artifact?.source?.headSha ?? artifact?.source?.head_sha;
	const sourceRef = artifact?.source?.ref;
	if (typeof sourceSha !== "string" || !HASH.test(sourceSha) || sourceSha !== sourceSha.toLowerCase()) throw new Error("Verified artifact source commit SHA is invalid");
	if (sourceRef !== "refs/heads/main") throw new Error("Verified artifact is not bound to the reviewed main branch");
	const [owner, repo] = repository.split("/");
	return {
		githubDeployment: "1",
		githubCommitRef: "main",
		githubCommitOrg: owner,
		githubCommitRepo: repo,
		githubCommitSha: sourceSha,
		githubOrg: owner,
		githubRepo: repo,
	};
}

function validateGitHubDeploymentMetadata(deployment, target, artifact) {
	const expected = githubDeploymentMetadata(target, artifact);
	assertRecord(deployment.meta, "Vercel deployment GitHub source metadata is unavailable");
	for (const [key, value] of Object.entries(expected)) {
		if (deployment.meta[key] !== value) throw new Error(`Vercel deployment GitHub source metadata ${key} does not match the approved artifact`);
	}
	return expected;
}

function expectedOidc(target) {
	const repository = target.repository ?? REPOSITORY;
	const workflowPath = target.workflow_path ?? target.workflowPath ?? WORKFLOW_PATH;
	if (repository !== REPOSITORY || workflowPath !== WORKFLOW_PATH) throw new Error("Trusted Sources must be scoped to the reviewed main Production workflow");
	return {
		issuer: GITHUB_OIDC_ISSUER,
		claims: {
			aud: [OIDC_AUDIENCE],
			repository: [REPOSITORY],
			ref: ["refs/heads/main"],
			workflow_ref: [`${REPOSITORY}/${WORKFLOW_PATH}@refs/heads/main`],
		},
		to: { slugs: ["production"] },
	};
}

function trustedSourcesFromProject(project) {
	if (Object.hasOwn(project, "trustedSources") && Object.hasOwn(project, "trusted_sources")) {
		throw new Error("Vercel project Trusted Sources readback is ambiguous");
	}
	const trustedSources = project.trustedSources ?? project.trusted_sources;
	assertRecord(trustedSources, "Vercel project Trusted Sources readback is unavailable");
	if (trustedSources.enableVercelCiSameRepository !== false) {
		throw new Error("Vercel Trusted Sources same-repository CI trust must be explicitly disabled");
	}
	const projects = trustedSources.projects;
	if (!projects || typeof projects !== "object" || Object.keys(projects).length !== 0) {
		throw new Error("Vercel project Trusted Sources must explicitly contain no additional project rules");
	}
	const sourceFields = ["externalSources", "external_sources", "oidcProviders", "oidc_providers"];
	if (sourceFields.filter((key) => Object.hasOwn(trustedSources, key)).length !== 1) {
		throw new Error("Vercel project Trusted Sources provider readback is ambiguous or unavailable");
	}
	if (Array.isArray(trustedSources.externalSources)) return trustedSources.externalSources;
	if (Array.isArray(trustedSources.external_sources)) return trustedSources.external_sources;
	const providers = trustedSources.oidcProviders ?? trustedSources.oidc_providers;
	if (providers && typeof providers === "object" && !Array.isArray(providers)) {
		const result = [];
		for (const [issuer, configured] of Object.entries(providers)) {
			const entries = Array.isArray(configured) ? configured : [configured];
			for (const entry of entries) result.push({ ...entry, issuer: entry?.issuer ?? issuer });
		}
		return result;
	}
	throw new Error("Vercel project Trusted Sources schema is unsupported");
}

export function validateVercelTrustedSources(project, target) {
	assertRecord(project, "Vercel project readback is invalid");
	const expected = expectedOidc(target);
	const sources = trustedSourcesFromProject(project);
	if (sources.length !== 1) throw new Error("Vercel project must have exactly one reviewed GitHub OIDC Trusted Source");
	const source = sources[0];
	if (source?.issuer !== expected.issuer) throw new Error("Vercel GitHub OIDC issuer does not match the reviewed Trusted Source");
	assertRecord(source.claims, "Vercel GitHub OIDC Trusted Source claims are unavailable");
	const claimKeys = Object.keys(source.claims).sort();
	const expectedClaims = Object.keys(expected.claims).sort();
	if (JSON.stringify(claimKeys) !== JSON.stringify(expectedClaims)) throw new Error("Vercel GitHub OIDC Trusted Source has unexpected claims");
	for (const [claim, values] of Object.entries(expected.claims)) {
		const actual = source.claims[claim];
		if (!Array.isArray(actual) || JSON.stringify(actual) !== JSON.stringify(values)) throw new Error(`Vercel GitHub OIDC Trusted Source claim ${claim} does not match`);
	}
	if (!source.to || source.to.preset !== undefined || !Array.isArray(source.to.slugs) || JSON.stringify(source.to.slugs) !== JSON.stringify(expected.to.slugs)) {
		throw new Error("Vercel GitHub OIDC Trusted Source must target Production only");
	}
	return true;
}

export function validateVercelProjectIdentity(project, target) {
	const expected = projectTarget(target);
	assertRecord(project, "Vercel project readback is invalid");
	if (project.id !== expected.projectId || project.name !== expected.project || project.accountId !== expected.teamId) throw new Error("Vercel project/team identity does not match the approved target");
	validateVercelTrustedSources(project, target);
	return { project: expected.project, projectId: expected.projectId, teamId: expected.teamId, trustedSource: "PASS" };
}

async function responseJson(response, label, maxBytes = MAX_JSON_BYTES) {
	const contentLength = Number(response.headers.get("content-length") ?? 0);
	if (contentLength > maxBytes) {
		await response.body?.cancel();
		throw new Error(`${label} exceeded the response size limit`);
	}
	const bytes = Buffer.from(await response.arrayBuffer());
	if (bytes.length > maxBytes) throw new Error(`${label} exceeded the response size limit`);
	try {
		return JSON.parse(bytes.toString("utf8"));
	} catch {
		throw new Error(`${label} response was invalid JSON`);
	}
}

async function getJson(path, { teamId, token, fetchImpl } = {}) {
	const response = await vercelRequest(path, {}, false, { teamId, token, fetchImpl });
	return responseJson(response, "Vercel API");
}

export async function getVercelProject({ projectId, teamId = process.env.VERCEL_ORG_ID, token = process.env.VERCEL_TOKEN, fetchImpl = fetch } = {}) {
	if (!PROJECT_ID.test(projectId ?? "")) throw new Error("Vercel project ID is invalid");
	const result = await getJson(`/v9/projects/${encodeURIComponent(projectId)}`, { teamId, token, fetchImpl });
	assertRecord(result, "Vercel project response is invalid");
	return result;
}

export async function getVercelProjectDomains({ projectId, teamId = process.env.VERCEL_ORG_ID, token = process.env.VERCEL_TOKEN, fetchImpl = fetch } = {}) {
	if (!PROJECT_ID.test(projectId ?? "")) throw new Error("Vercel project ID is invalid");
	const domains = [];
	let until;
	for (let page = 0; page < MAX_PAGES; page += 1) {
		const query = new URLSearchParams({ limit: "100" });
		if (until !== undefined) query.set("until", String(until));
		const result = await getJson(`/v9/projects/${encodeURIComponent(projectId)}/domains?${query}`, { teamId, token, fetchImpl });
		assertRecord(result, "Vercel project domains response is invalid");
		if (!Array.isArray(result.domains)) throw new Error("Vercel project domains response is incomplete");
		domains.push(...result.domains);
		const next = result.pagination?.next;
		if (next === undefined || next === null) return domains;
		if (!Number.isSafeInteger(Number(next)) || Number(next) <= 0 || Number(next) === Number(until)) throw new Error("Vercel project domains pagination is invalid");
		until = Number(next);
	}
	throw new Error("Vercel project domains exceeded the page limit");
}

export async function getVercelAliases({ projectId, deploymentId, teamId = process.env.VERCEL_ORG_ID, token = process.env.VERCEL_TOKEN, fetchImpl = fetch } = {}) {
	if ((projectId !== undefined && !PROJECT_ID.test(projectId)) || (deploymentId !== undefined && !DEPLOYMENT_ID.test(deploymentId)) || Boolean(projectId) === Boolean(deploymentId)) throw new Error("Vercel alias query needs exactly one approved project or deployment ID");
	const aliases = [];
	let until;
	for (let page = 0; page < MAX_PAGES; page += 1) {
		const query = new URLSearchParams({ limit: "100" });
		if (projectId) query.set("projectId", projectId);
		if (deploymentId) query.set("deploymentId", deploymentId);
		if (until !== undefined) query.set("until", String(until));
		const result = await getJson(`/v4/aliases?${query}`, { teamId, token, fetchImpl });
		assertRecord(result, "Vercel alias response is invalid");
		if (!Array.isArray(result.aliases)) throw new Error("Vercel alias response is incomplete");
		aliases.push(...result.aliases);
		const next = result.pagination?.next;
		if (next === undefined || next === null) return aliases;
		if (!Number.isSafeInteger(Number(next)) || Number(next) <= 0 || Number(next) === Number(until)) throw new Error("Vercel alias pagination is invalid");
		until = Number(next);
	}
	throw new Error("Vercel aliases exceeded the page limit");
}

export async function getVercelDeployment({ deploymentIdOrUrl, teamId = process.env.VERCEL_ORG_ID, token = process.env.VERCEL_TOKEN, fetchImpl = fetch } = {}) {
	if (typeof deploymentIdOrUrl !== "string" || !deploymentIdOrUrl || deploymentIdOrUrl.length > 255 || /[\r\n\0]/.test(deploymentIdOrUrl)) throw new Error("Vercel deployment identity is invalid");
	const result = await getJson(`/v13/deployments/${encodeURIComponent(deploymentIdOrUrl)}`, { teamId, token, fetchImpl });
	assertRecord(result, "Vercel deployment response is invalid");
	return result;
}

export async function getDeploymentFileTree({ deploymentId, teamId = process.env.VERCEL_ORG_ID, token = process.env.VERCEL_TOKEN, fetchImpl = fetch } = {}) {
	if (!DEPLOYMENT_ID.test(deploymentId ?? "")) throw new Error("Vercel deployment ID is invalid");
	const result = await getJson(`/v6/deployments/${encodeURIComponent(deploymentId)}/files`, { teamId, token, fetchImpl });
	if (!Array.isArray(result)) throw new Error("Vercel deployment file tree is invalid");
	return result;
}

function safeDeploymentOrigin(value, project) {
	if (typeof value !== "string") throw new Error("Vercel deployment URL is invalid");
	let url;
	try { url = new URL(value.startsWith("https://") ? value : `https://${value}`); } catch { throw new Error("Vercel deployment URL is invalid"); }
	if (url.protocol !== "https:" || url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash || !url.hostname.startsWith(`${project}-`) || !url.hostname.endsWith(".vercel.app")) throw new Error("Vercel deployment URL does not match the approved project");
	return url.origin;
}

export function validateVercelDeploymentIdentity(deployment, target, artifact) {
	const expected = projectTarget(target);
	assertRecord(deployment, "Vercel deployment readback is invalid");
	if (!DEPLOYMENT_ID.test(deployment.id ?? "") || deployment.projectId !== expected.projectId || deployment.target !== "production" || deployment.readyState !== "READY") throw new Error("Vercel deployment is not the exact READY Production target");
	const ownerId = deployment.teamId ?? deployment.ownerId;
	if (ownerId !== expected.teamId) throw new Error("Vercel deployment team identity does not match the approved target");
	const url = safeDeploymentOrigin(deployment.url, expected.project);
	if (artifact) {
		if (artifact.result !== "PASS" || artifact.outputDigest !== artifact.manifest?.output_digest || !DIGEST.test(artifact.outputDigest ?? "") || deployment.id === artifact.deploymentId) throw new Error("Vercel deployment is not bound to a verified immutable artifact");
		validateGitHubDeploymentMetadata(deployment, target, artifact);
	}
	return { id: deployment.id, url, projectId: expected.projectId, teamId: expected.teamId, target: "production", readyState: "READY" };
}

export function verifyDeploymentFileInventory({ deploymentFiles: remoteTree, expectedInventory }) {
	const result = compareRemoteFileInventory(remoteTree, expectedInventory);
	return { ...result, inventoryDigest: result.inventorySha256 };
}

function assertArtifactBinding(packageRoot, artifact) {
	assertRecord(artifact, "Verified Site package result is required");
	if (artifact.result !== "PASS" || !DIGEST.test(artifact.packageArchiveSha256 ?? "") || !DIGEST.test(artifact.upstreamArchiveSha256 ?? "")) throw new Error("Site package artifact does not have archive verification evidence");
	const verified = verifySitePackage({ packageRoot, sourceRunSha: artifact.source?.headSha ?? artifact.source?.head_sha });
	if (verified.outputDigest !== artifact.outputDigest || verified.manifest.output_digest !== artifact.outputDigest || artifact.manifest?.output_digest !== artifact.outputDigest) throw new Error("Site package output changed after immutable artifact verification");
	if (!Array.isArray(artifact.deploymentFiles) || artifact.deploymentFiles.length < 1) throw new Error("Verified Build Output inventory is missing");
	const actualFiles = deploymentFiles(packageRoot);
	if (JSON.stringify(actualFiles) !== JSON.stringify(artifact.deploymentFiles)) throw new Error("Site Build Output inventory changed after verification");
	return { verified, expectedInventory: actualFiles };
}

async function assertProjectSnapshot(target, options) {
	const expected = projectTarget(target);
	const project = await getVercelProject({ projectId: expected.projectId, teamId: expected.teamId, ...options });
	return { project, identity: validateVercelProjectIdentity(project, target) };
}

export async function runVercelStage({ packageRoot, expected, target, artifact, vercelCliPath, env = process.env, spawn = spawnSync }) {
	if (typeof vercelCliPath !== "string" || !isAbsolute(vercelCliPath)) throw new Error("Pinned Vercel CLI path is required");
	const cliInfo = lstatSync(resolve(vercelCliPath));
	if (!(cliInfo.isFile() || cliInfo.isSymbolicLink())) throw new Error("Pinned Vercel CLI must be an installed file");
	const stagingRoot = mkdtempSync(join(tmpdir(), "kirari-vercel-production-stage-"));
	try {
		const isolatedHome = join(stagingRoot, "home");
		mkdirSync(isolatedHome, { recursive: false, mode: 0o700 });
		const vercelDirectory = join(stagingRoot, ".vercel");
		mkdirSync(vercelDirectory, { mode: 0o700 });
		cpSync(join(packageRoot, ".vercel/output"), join(vercelDirectory, "output"), { recursive: true, errorOnExist: true, force: false, preserveTimestamps: true });
		writeFileSync(join(vercelDirectory, "project.json"), `${JSON.stringify({ orgId: expected.teamId, projectId: expected.projectId }, null, 2)}\n`, { flag: "wx", mode: 0o600 });
		const runtimeEnv = Object.fromEntries(["PATH", "LANG", "LC_ALL", "CI", "NO_COLOR", "FORCE_COLOR"].flatMap((name) => typeof env[name] === "string" ? [[name, env[name]]] : []));
		runtimeEnv.PATH = `${dirname(process.execPath)}:${runtimeEnv.PATH ?? ""}`;
		runtimeEnv.HOME = isolatedHome;
		runtimeEnv.TMPDIR = stagingRoot;
		runtimeEnv.VERCEL_TOKEN = env.VERCEL_TOKEN;
		runtimeEnv.VERCEL_ORG_ID = expected.teamId;
		runtimeEnv.VERCEL_PROJECT_ID = expected.projectId;
		runtimeEnv.VERCEL_TELEMETRY_DISABLED = "1";
		runtimeEnv.VERCEL_CLI_USE_NATIVE_BINARY = "0";
		runtimeEnv.NO_UPDATE_NOTIFIER = "1";
		if (!runtimeEnv.VERCEL_TOKEN || runtimeEnv.VERCEL_TOKEN.length < 8) throw new Error("Vercel production token is unavailable");
		const metadata = githubDeploymentMetadata(target, artifact);
		const args = ["deploy", "--prebuilt", "--prod", "--skip-domain", "--yes", ...Object.entries(metadata).flatMap(([key, value]) => ["--meta", `${key}=${value}`])];
		const result = spawn(resolve(vercelCliPath), args, {
			cwd: stagingRoot,
			env: runtimeEnv,
			encoding: "utf8",
			timeout: 25 * 60_000,
			maxBuffer: 1024 * 1024,
			windowsHide: true,
		});
		if (result.error || result.status !== 0 || result.signal) throw new Error("Pinned Vercel CLI failed to stage the prebuilt production output");
		const outputs = String(result.stdout ?? "").split(/\r?\n/).map((line) => line.trim()).filter((line) => /^https:\/\//i.test(line));
		if (outputs.length !== 1) throw new Error("Pinned Vercel CLI did not return exactly one deployment URL");
		return safeDeploymentOrigin(outputs[0], expected.project);
	} finally {
		rmSync(stagingRoot, { recursive: true, force: true });
	}
}

export async function stagePrebuiltProduction({ packageRoot, target, artifact, vercelCliPath, env = process.env, token = env.VERCEL_TOKEN, teamId = target?.team_id ?? target?.teamId, fetchImpl = fetch, spawn = spawnSync } = {}) {
	const expected = projectTarget(target);
	const { verified, expectedInventory } = assertArtifactBinding(packageRoot, artifact);
	await assertProjectSnapshot(target, { token, teamId, fetchImpl });
	// `--skip-domain` is part of the documented staged Production flow. A newly
	// created deployment remains detached until an independently validated promote.
	const deploymentUrl = spawn === spawnSync
		? await runVercelStage({ packageRoot, expected, target, artifact, vercelCliPath, env })
		: await spawn({ packageRoot, target, artifact, vercelCliPath, env, args: ["deploy", "--prebuilt", "--prod", "--skip-domain", "--yes", ...Object.entries(githubDeploymentMetadata(target, artifact)).flatMap(([key, value]) => ["--meta", `${key}=${value}`])] });
	const deployment = await getVercelDeployment({ deploymentIdOrUrl: new URL(deploymentUrl).hostname, teamId: expected.teamId, token, fetchImpl });
	const identity = validateVercelDeploymentIdentity(deployment, target, artifact);
	if (deployment.aliasAssigned === true || (Array.isArray(deployment.aliases) && deployment.aliases.some((alias) => target.domains?.includes(typeof alias === "string" ? alias : alias?.alias)))) throw new Error("Staged Vercel deployment unexpectedly received a production alias");
	const remoteTree = await getDeploymentFileTree({ deploymentId: deployment.id, teamId: expected.teamId, token, fetchImpl });
	const remoteInventory = verifyDeploymentFileInventory({ deploymentFiles: remoteTree, expectedInventory });
	if (remoteInventory.fileCount !== expectedInventory.length) throw new Error("Staged Vercel output file count does not match the reviewed Build Output");
	const aliases = await getVercelAliases({ deploymentId: deployment.id, teamId: expected.teamId, token, fetchImpl });
	const productionDomains = new Set((target.domains ?? []).map((domain) => typeof domain === "string" ? domain : domain?.name));
	if (aliases.some((alias) => productionDomains.has(alias.alias))) throw new Error("Staged Vercel deployment unexpectedly owns an approved production domain");
	return {
		result: "STAGED",
		deployment: { id: identity.id, url: identity.url, projectId: identity.projectId, teamId: identity.teamId, target: identity.target, readyState: identity.readyState, aliasAssigned: deployment.aliasAssigned === true, aliases: (deployment.aliases ?? []).filter((alias) => typeof alias === "string" || typeof alias?.alias === "string").map((alias) => typeof alias === "string" ? alias : alias.alias) },
		artifact: { outputDigest: verified.outputDigest, coreSha: verified.provenance.core.resolved_sha, siteSha: verified.provenance.site.resolved_sha, sourceRunId: artifact.source?.runId ?? artifact.source?.run_id, sourceRunAttempt: artifact.source?.runAttempt ?? artifact.source?.run_attempt, packageArchiveDigest: artifact.packageArchiveSha256, upstreamArchiveDigest: artifact.upstreamArchiveSha256 },
		remoteInventory,
		trustedSource: "PASS",
	};
}

function canonicalJson(value) {
	if (Array.isArray(value)) return value.map(canonicalJson);
	if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]));
	return value;
}

export function productionValidationDigest(validation) {
	const { validationDigest: _ignored, ...boundValidation } = validation ?? {};
	return `sha256:${createHash("sha256").update(JSON.stringify(canonicalJson(boundValidation))).digest("hex")}`;
}

export async function promoteStagedProduction({ deploymentId, target, artifact, packageRoot, prePromotionValidation, token = process.env.VERCEL_TOKEN, teamId = target?.team_id ?? target?.teamId, fetchImpl = fetch } = {}) {
	const expected = projectTarget(target);
	const { expectedInventory } = assertArtifactBinding(packageRoot, artifact);
	assertRecord(prePromotionValidation, "Independent pre-promotion validation is required");
	const browser = prePromotionValidation.browser ?? prePromotionValidation;
	if (prePromotionValidation.result !== "PASS" || prePromotionValidation.phase !== "staged" || prePromotionValidation.deploymentId !== deploymentId || prePromotionValidation.outputDigest !== artifact.outputDigest || !DIGEST.test(prePromotionValidation.validationDigest ?? "") || prePromotionValidation.validationDigest !== productionValidationDigest(prePromotionValidation)) {
		throw new Error("Pre-promotion validation is not bound to this staged deployment and artifact");
	}
	if (browser?.byteEquality !== "PASS" || browser?.artifactBytesVerified !== true || browser?.phase !== "staged") throw new Error("Independent browser validation did not verify the staged artifact bytes");
	const { project } = await assertProjectSnapshot(target, { token, teamId, fetchImpl });
	const deployment = await getVercelDeployment({ deploymentIdOrUrl: deploymentId, teamId: expected.teamId, token, fetchImpl });
	const identity = validateVercelDeploymentIdentity(deployment, target, artifact);
	if (identity.id !== deploymentId || browser.baseUrl !== identity.url) throw new Error("Pre-promotion browser result refers to a different deployment");
	const remoteTree = await getDeploymentFileTree({ deploymentId, teamId: expected.teamId, token, fetchImpl });
	const remoteInventory = verifyDeploymentFileInventory({ deploymentFiles: remoteTree, expectedInventory });
	if (prePromotionValidation.remoteInventory?.inventoryDigest !== remoteInventory.inventoryDigest) throw new Error("Staged deployment files changed after browser validation");
	const promotionPath = `/v10/projects/${encodeURIComponent(expected.projectId)}/promote/${encodeURIComponent(deploymentId)}`;
	const response = await vercelRequest(promotionPath, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }, false, { teamId: expected.teamId, token, fetchImpl });
	await response.body?.cancel();
	return { result: "PROMOTION_REQUESTED", projectId: expected.projectId, teamId: expected.teamId, deploymentId, outputDigest: artifact.outputDigest, inventoryDigest: remoteInventory.inventoryDigest, httpStatus: response.status };
}
