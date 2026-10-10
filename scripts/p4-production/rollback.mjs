import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { downloadVerifiedArtifact, extractSiteArtifactArchive, readSiteArtifactZipMember, sha256File, verifySitePackage, deploymentFiles } from "../site-artifact.mjs";
import { assertProductionSourceRun, assertSourceShaIsMainAncestor } from "../production-authorization.mjs";
import { assertProductionReleaseRecord } from "./evidence.mjs";
import { assertProductionBrowserReport } from "./production-validation.mjs";

const sha = /^[a-f0-9]{40}$/;
const digest = /^sha256:[a-f0-9]{64}$/;
const id = /^[1-9][0-9]*$/;
const deploymentId = /^dpl_[A-Za-z0-9]+$/;

function requireCondition(condition, message) {
	if (!condition) throw new Error(message);
}

function canonical(value) {
	if (Array.isArray(value)) return value.map(canonical);
	if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
	return value;
}

export function releaseRecordDigest(record) {
	return `sha256:${createHash("sha256").update(JSON.stringify(canonical(record))).digest("hex")}`;
}

function same(left, right) {
	return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

function origin(value) {
	const url = new URL(value);
	requireCondition(url.protocol === "https:" && !url.username && !url.password && !url.port && url.pathname === "/" && !url.search && !url.hash, "Rollback URL must be an exact HTTPS origin");
	return url.origin;
}

function readArchiveRecord(bytes) {
	try {
		return JSON.parse(readSiteArtifactZipMember(bytes, "production-record.json"));
	} catch {
		throw new Error("Rollback evidence archive must safely contain production-record.json");
	}
}

/** The server's immutable artifact metadata and downloaded bytes are both required. */
export function verifyRollbackRelease({ record, archiveBytes, artifact, run, approved, repository, owner, trustedWorkflowSha, target, now = Date.now() }) {
	requireCondition(approved && id.test(String(approved.run_id)) && id.test(String(approved.run_attempt)) && id.test(String(approved.artifact_id)), "Approved rollback record identity is required");
	requireCondition(digest.test(approved.archive_digest) && digest.test(approved.record_digest) && sha.test(approved.workflow_sha) && deploymentId.test(approved.deployment_id), "Approved rollback fingerprints are invalid");
	requireCondition(trustedWorkflowSha === approved.workflow_sha, "Rollback producer must be a verified reviewed main ancestor");
	requireCondition(run.repository?.full_name === repository && run.head_repository?.full_name === repository, "Rollback run repository substitution");
	requireCondition(String(run.id) === String(approved.run_id) && String(run.run_attempt) === String(approved.run_attempt) && run.head_sha === approved.workflow_sha, "Rollback producer run identity mismatch");
	requireCondition(run.event === "workflow_dispatch" && run.path === ".github/workflows/site-production.yml" && run.head_branch === "main" && run.status === "completed" && run.conclusion === "success" && String(run.run_attempt) === "1", "Rollback requires a successful first-attempt main production workflow");
	requireCondition(run.actor?.login === owner && run.triggering_actor?.login === owner, "Rollback producer must be owner authorized");
	requireCondition(String(artifact.id) === approved.artifact_id && artifact.name === `kirari-p4-production-${approved.run_id}-${approved.run_attempt}` && artifact.expired === false && artifact.digest === approved.archive_digest, "Rollback artifact metadata mismatch or expired record");
	requireCondition(String(artifact.workflow_run?.id) === approved.run_id && artifact.workflow_run?.head_sha === approved.workflow_sha && artifact.workflow_run?.head_branch === "main", "Rollback artifact producer substitution");
	requireCondition(Number.isFinite(Date.parse(artifact.expires_at)) && Date.parse(artifact.expires_at) > now, "Rollback evidence artifact expired");
	requireCondition(Buffer.isBuffer(archiveBytes), "Downloaded rollback evidence archive bytes are required");
	requireCondition(`sha256:${createHash("sha256").update(archiveBytes).digest("hex")}` === approved.archive_digest, "Rollback archive digest mismatch");
	requireCondition(same(readArchiveRecord(archiveBytes), record), "Rollback record is not the authentic evidence archive member");
	requireCondition(releaseRecordDigest(record) === approved.record_digest, "Rollback release record digest mismatch");
	assertProductionReleaseRecord(record);
	const rt = record.target;
	requireCondition(rt.deployment_id === approved.deployment_id, "Rollback deployment substitution");
	for (const key of ["team_id", "project_id", "project", "canonical_origin"]) requireCondition(rt[key] === target[key], `Rollback target ${key} mismatch`);
	requireCondition(same([...rt.domains].sort(), [...target.domains].sort()), "Rollback domain set mismatch");
	requireCondition(record.authorization.actor === owner && record.authorization.repository === repository, "Rollback record owner/repository substitution");
	const rw = record.workflow;
	requireCondition(String(rw?.id) === String(approved.run_id) && String(rw.attempt) === String(approved.run_attempt) && rw.sha === approved.workflow_sha && rw.path === run.path && rw.actor === owner && rw.triggering_actor === owner, "Rollback record workflow identity mismatch");
	requireCondition(Number.isFinite(Date.parse(rw.created_at)) && Date.parse(rw.created_at) <= now, "Rollback timestamp is invalid");
	return { record, approved, target: rt };
}

async function githubJson(repository, path, token, fetchImpl) {
	requireCondition(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) && token, "Rollback GitHub identity is invalid");
	const response = await fetchImpl(`https://api.github.com/repos/${repository}${path}`, { redirect: "error", signal: AbortSignal.timeout(30000), headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" } });
	requireCondition(response.ok, "Rollback metadata read failed");
	const bytes = Buffer.from(await response.arrayBuffer());
	requireCondition(bytes.length <= 32 * 1024 * 1024, "Rollback metadata exceeds its bounded size");
	try { return JSON.parse(bytes); }
	catch { throw new Error("Rollback metadata response is invalid JSON"); }
}

/** Prior successful release evidence is the durable authority for retained ZIPs. */
export async function loadApprovedRollback({ binding, token, repository = binding.repository, outputDirectory, fetchImpl = fetch }) {
	const approved = binding.rollback_record;
	requireCondition(approved && outputDirectory && repository === binding.repository, "Rollback binding is missing");
	mkdirSync(outputDirectory, { recursive: false, mode: 0o700 });
	const run = await githubJson(repository, `/actions/runs/${approved.run_id}`, token, fetchImpl);
	const comparison = await githubJson(repository, `/compare/${approved.workflow_sha}...${binding.main_sha}`, token, fetchImpl);
	assertSourceShaIsMainAncestor(comparison, approved.workflow_sha);
	const artifact = await githubJson(repository, `/actions/artifacts/${approved.artifact_id}`, token, fetchImpl);
	const archivePath = join(outputDirectory, "release.zip");
	await downloadVerifiedArtifact({ repository, artifactId: approved.artifact_id, expectedName: `kirari-p4-production-${approved.run_id}-${approved.run_attempt}`, expectedDigest: approved.archive_digest, expectedRun: { id: approved.run_id, attempt: String(approved.run_attempt), head_sha: approved.workflow_sha, head_branch: "main" }, token, destination: archivePath, fetchImpl });
	const archiveBytes = readFileSync(archivePath);
	const record = readArchiveRecord(archiveBytes);
	const candidate = verifyRollbackRelease({ record, archiveBytes, artifact, run, approved, repository, owner: repository.split("/")[0], trustedWorkflowSha: approved.workflow_sha, target: binding.target });
	const extracted = join(outputDirectory, "evidence");
	extractSiteArtifactArchive(archivePath, extracted);
	const packageZip = join(extracted, "retained/site-package.zip");
	const upstreamZip = join(extracted, "retained/composition.zip");
	requireCondition(await sha256File(packageZip) === record.package_artifact.archive_digest && await sha256File(upstreamZip) === record.upstream_artifact.digest, "Retained rollback archive substitution");
	const packageRoot = join(outputDirectory, "package");
	const upstreamRoot = join(outputDirectory, "composition");
	extractSiteArtifactArchive(packageZip, packageRoot);
	extractSiteArtifactArchive(upstreamZip, upstreamRoot);
	const sourceBinding = { ...binding, source: { run_id: record.source_run.id, run_attempt: Number(record.source_run.attempt), sha: record.source_run.sha } };
	const sourceRun = await githubJson(repository, `/actions/runs/${record.source_run.id}/attempts/${record.source_run.attempt}`, token, fetchImpl);
	assertProductionSourceRun(sourceRun, sourceBinding);
	assertSourceShaIsMainAncestor(await githubJson(repository, `/compare/${record.source_run.sha}...${binding.main_sha}`, token, fetchImpl), record.source_run.sha);
	const verified = verifySitePackage({ packageRoot, sourceRun: { run_id: record.source_run.id, run_attempt: record.source_run.attempt, head_sha: record.source_run.sha }, upstreamRoot });
	requireCondition(verified.outputDigest === record.output_digest && verified.manifest.site.resolved_sha === record.site.resolved_sha && same(verified.upstreamArtifact, record.upstream_artifact), "Retained rollback package provenance mismatch");
	const packageVerification = { ...verified, result: "PASS", source: { runId: record.source_run.id, runAttempt: record.source_run.attempt, headSha: record.source_run.sha, ref: "refs/heads/main" }, packageArtifact: { id: record.package_artifact.id, name: record.package_artifact.name, digest: record.package_artifact.archive_digest }, packageArchiveSha256: record.package_artifact.archive_digest, upstreamArchiveSha256: record.upstream_artifact.digest, deploymentFiles: deploymentFiles(packageRoot) };
	return { candidate: { ...candidate, packageVerification }, packageVerification };
}

export function assertRollbackDeployment(deployment, candidate) {
	const target = candidate.record.target;
	requireCondition(deployment.id === target.deployment_id && deployment.projectId === target.project_id && deployment.target === "production" && deployment.readyState === "READY", "Rollback deployment is not the exact approved READY Production target");
	requireCondition(origin(`https://${deployment.url}`) === target.url, "Rollback live deployment URL mismatch");
	return deployment;
}

export function assertProductionAliasSnapshot(aliases, target, expectedDeployment) {
	requireCondition(Array.isArray(aliases), "Production aliases are missing");
	for (const domain of target.domains) {
		const entries = aliases.filter((entry) => entry.alias === domain);
		requireCondition(entries.length === 1 && entries[0].projectId === target.project_id && entries[0].deploymentId === expectedDeployment && !entries[0].redirect, "Production alias/deployment substitution");
	}
	return true;
}

/** Restore an existing immutable deployment. The injected adapter never rebuilds. */
export async function restoreApprovedRelease({ candidate, currentDeploymentId, api, verifyBytes, validateProduction }) {
	requireCondition(deploymentId.test(currentDeploymentId) && currentDeploymentId !== candidate.target.deployment_id, "Rollback must select a distinct prior approved deployment");
	const target = candidate.target;
	const project = await api.getProject(target.project_id);
	requireCondition(project.id === target.project_id && project.name === target.project && project.accountId === target.team_id, "Rollback project/team identity mismatch");
	assertRollbackDeployment(await api.getDeployment(target.deployment_id), candidate);
	assertProductionAliasSnapshot(await api.getAliases(), target, currentDeploymentId);
	const before = await verifyBytes(candidate);
	requireCondition(before.result === "PASS" && before.byte_output_digest === candidate.record.byte_output_digest && before.inventory_digest === candidate.record.inventory_digest, "Rollback immutable output could not be reverified");
	// A failure before this call performs no production write. After it, every failure is INCOMPLETE.
	try {
		await api.promoteExisting(target.deployment_id);
		assertRollbackDeployment(await api.getDeployment(target.deployment_id), candidate);
		assertProductionAliasSnapshot(await api.getAliases(), target, target.deployment_id);
		const browser = await validateProduction(candidate);
		assertProductionBrowserReport(browser);
		requireCondition(browser.phase === "restore" && browser.baseUrl === target.canonical_origin, "Restored production health validation failed");
		return { schema_version: 1, kind: "kirari-production-rollback", result: "PASS", from_deployment_id: currentDeploymentId, restored_deployment_id: target.deployment_id, release_record_digest: candidate.approved.record_digest, production_action: true, no_rebuild: true, browser };
	} catch {
		return { schema_version: 1, kind: "kirari-production-rollback", result: "INCOMPLETE", from_deployment_id: currentDeploymentId, restored_deployment_id: target.deployment_id, release_record_digest: candidate.approved.record_digest, production_action: true, error_code: "POST_ROLLBACK_VERIFICATION_FAILED" };
	}
}
