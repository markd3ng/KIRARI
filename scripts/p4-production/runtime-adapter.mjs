import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	getVercelProject, getVercelProjectDomains, getVercelAliases, getVercelDeployment,
	getDeploymentFileTree, validateVercelProjectIdentity, validateVercelDeploymentIdentity,
	stagePrebuiltProduction, promoteStagedProduction, productionValidationDigest,
} from "../deploy-vercel-production.mjs";
import { deploymentFiles, vercelRequest } from "../site-artifact.mjs";
import { requestGithubOidcToken } from "../p3-browser/github-oidc.mjs";
import { assertProductionBrowserReport, verifyDeployedStaticOutput } from "./production-validation.mjs";
import { loadApprovedRollback, restoreApprovedRelease, assertProductionAliasSnapshot, assertRollbackDeployment } from "./rollback.mjs";
import { verifyProductionPreflight } from "./preflight.mjs";
import { productionApprovalDigest } from "../production-authorization.mjs";
import { assertConcreteProductionContracts } from "./tooling-gate.mjs";

function assert(condition, code) { if (!condition) throw new Error(code); }

export function normalizeAliasSnapshot(raw, target) {
	assert(Array.isArray(raw), "PRODUCTION_ALIAS_METADATA_MISSING");
	return raw.map((entry) => {
		const projectId = entry.projectId ?? entry.project?.id;
		const deploymentId = entry.deploymentId ?? entry.deployment?.id ?? null;
		assert(projectId === target.project_id && typeof entry.alias === "string", "PRODUCTION_ALIAS_IDENTITY_MISMATCH");
		return { alias: entry.alias, projectId, deploymentId, redirect: entry.redirect ?? null };
	});
}

/** Include implicit Production aliases as well as configured domains. */
export function deriveProductionDomains(configured, aliases, currentId) {
	assert(Array.isArray(configured), "PRODUCTION_DOMAIN_METADATA_MISSING");
	const names = configured.filter((domain) => !domain.gitBranch && !domain.customEnvironmentId).map((domain) => {
		assert(typeof domain.name === "string" && !domain.redirect, "PRODUCTION_DOMAIN_REDIRECT_UNAPPROVED");
		return domain.name;
	});
	for (const alias of aliases) if (currentId && alias.deploymentId === currentId) names.push(alias.alias);
	return [...new Set(names)].sort();
}

function sameDomains(left, right) { return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort()); }

export async function createProductionRuntime({ binding, packageVerification, env = process.env, fetchImpl = fetch }) {
	const target = { ...binding.target, repository: binding.repository, workflow_path: binding.workflow_path };
	const options = { projectId: target.project_id, teamId: target.team_id, token: env.VERCEL_TOKEN, fetchImpl };
	const workspace = mkdtempSync(join(tmpdir(), "kirari-production-runtime-"));
	let rollbackCandidate = null;
	let staged = null;
	if (binding.rollback_record) {
		try {
			const loaded = await loadApprovedRollback({ binding, token: env.GH_TOKEN, outputDirectory: join(workspace, "rollback"), fetchImpl });
			rollbackCandidate = loaded.candidate;
			if (target.operation === "rollback") packageVerification = loaded.packageVerification;
		} catch (error) {
			rmSync(workspace, { recursive: true, force: true });
			throw error;
		}
	}
	const guard = async () => {
		await assertConcreteProductionContracts({ env, fetchImpl });
		const context = { eventName: env.GITHUB_EVENT_NAME, ref: env.GITHUB_REF, actor: env.GITHUB_ACTOR,
			triggeringActor: env.PRODUCTION_TRIGGERING_ACTOR ?? env.GITHUB_TRIGGERING_ACTOR,
			repositoryOwner: env.GITHUB_REPOSITORY_OWNER, repository: env.GITHUB_REPOSITORY,
			workflowRef: env.GITHUB_WORKFLOW_REF, workflowSha: env.PRODUCTION_WORKFLOW_SHA ?? env.GITHUB_WORKFLOW_SHA,
			sha: env.GITHUB_SHA, runAttempt: env.GITHUB_RUN_ATTEMPT, runId: env.GITHUB_RUN_ID };
		await verifyProductionPreflight({ binding, ownerAuthorization: env.OWNER_AUTHORIZATION, requireClaim: true,
			expectedClaimArtifactId: env.PRODUCTION_CLAIM_ARTIFACT_ID, expectedClaimDigest: env.PRODUCTION_CLAIM_DIGEST,
			expectedCurrentRunId: env.GITHUB_RUN_ID, packageVerification, rollbackCandidate,
			token: env.GH_TOKEN, repository: binding.repository, context, fetchImpl });
	};
	const rawAliases = async () => normalizeAliasSnapshot(await getVercelAliases(options), target);
	const currentProductionId = async () => {
		const aliases = await rawAliases();
		const canonicalHost = new URL(target.canonical_origin).hostname;
		const entries = aliases.filter((item) => item.alias === canonicalHost);
		assert(entries.length <= 1, "PRODUCTION_CANONICAL_ALIAS_AMBIGUOUS");
		const currentId = entries[0]?.deploymentId ?? null;
		if (currentId) assertProductionAliasSnapshot(aliases, target, currentId);
		return currentId;
	};
	const aliasesFor = async (expectedId) => {
		const aliases = await rawAliases();
		if (expectedId === null) {
			assert(!aliases.some((item) => target.domains.includes(item.alias)), "PRODUCTION_ALIAS_UNEXPECTED");
			return [];
		}
		assertProductionAliasSnapshot(aliases, target, expectedId);
		const affected = deriveProductionDomains(await getVercelProjectDomains(options), aliases, expectedId);
		assert(sameDomains(affected, target.domains), "PRODUCTION_ALIAS_SET_DRIFT");
		return target.domains.map((domain) => ({ domain, deployment_id: expectedId }));
	};
	const waitForAliases = async (expectedId) => {
		const deadline = Date.now() + 120_000;
		while (true) {
			try { return await aliasesFor(expectedId); }
			catch {
				assert(Date.now() < deadline, "PRODUCTION_ALIAS_ASSIGNMENT_UNVERIFIED");
				await new Promise((resolve) => setTimeout(resolve, 2000));
			}
		}
	};
	const snapshot = async () => {
		const project = await getVercelProject(options);
		validateVercelProjectIdentity(project, target);
		const aliases = await rawAliases();
		const currentId = await currentProductionId();
		const domains = deriveProductionDomains(await getVercelProjectDomains(options), aliases, currentId);
		assert(sameDomains(domains, target.domains), "PRODUCTION_DOMAIN_SET_DRIFT");
		const currentDeployment = currentId ? await getVercelDeployment({ ...options, deploymentIdOrUrl: currentId }) : null;
		if (currentDeployment) validateVercelDeploymentIdentity(currentDeployment, target);
		return { project, domains, currentDeployment };
	};
	const browser = async ({ phase, deployment, packageVerification: artifact, aliases, priorReleaseRecord }) => {
		const directory = mkdtempSync(join(workspace, "browser-"));
		try {
			const aliasBindings = aliases ?? await aliasesFor(phase === "staged" ? target.current_deployment_id : deployment.id);
			for (const [name, value] of Object.entries({ binding, deployment, aliases: { aliasBindings }, prior: priorReleaseRecord })) {
				if (value) writeFileSync(join(directory, `${name}.json`), JSON.stringify(value), { flag: "wx", mode: 0o600 });
			}
			const baseUrl = phase === "staged" ? `https://${deployment.url}` : target.canonical_origin;
			const reportPath = join(directory, "report.json");
			const args = [fileURLToPath(new URL("../p3-browser/validate.mjs", import.meta.url)), "--mode", "production", "--phase", phase,
				"--base-url", baseUrl, "--manifest", artifact.manifestPath, "--static-root", artifact.staticRoot,
				"--binding", join(directory, "binding.json"), "--deployment", join(directory, "deployment.json"), "--aliases", join(directory, "aliases.json"), "--report", reportPath];
			if (priorReleaseRecord) args.push("--prior-release-record", join(directory, "prior.json"));
			const childEnv = { ...env };
			delete childEnv.GH_TOKEN; delete childEnv.GITHUB_TOKEN; delete childEnv.VERCEL_TOKEN; delete childEnv.OWNER_AUTHORIZATION;
			const result = spawnSync(process.execPath, args, { env: childEnv, stdio: "pipe", timeout: 5 * 60_000, maxBuffer: 1024 * 1024 });
			assert(result.status === 0 && !result.error, "PRODUCTION_BROWSER_CHECK_FAILED");
			return assertProductionBrowserReport(JSON.parse(readFileSync(reportPath, "utf8")));
		} finally { rmSync(directory, { recursive: true, force: true }); }
	};
	const restoreRollback = async (candidate, currentDeploymentId) => {
		const outcome = await restoreApprovedRelease({
		candidate, currentDeploymentId,
		api: {
			getProject: async () => { const project = await getVercelProject(options); validateVercelProjectIdentity(project, target); return project; },
			getDeployment: async (id) => getVercelDeployment({ ...options, deploymentIdOrUrl: id }),
			getAliases: rawAliases,
			promoteExisting: async (id) => {
				await guard();
				const state = await snapshot();
				assert(state.currentDeployment?.id === currentDeploymentId, "ROLLBACK_CURRENT_DEPLOYMENT_DRIFT");
				assertRollbackDeployment(await getVercelDeployment({ ...options, deploymentIdOrUrl: id }), candidate);
				// This documented API points traffic to an existing immutable deployment.
				const response = await vercelRequest(`/v10/projects/${target.project_id}/promote/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }, false, options);
				await response.body?.cancel();
				await waitForAliases(id);
			},
		},
		verifyBytes: async () => {
			const oidcToken = await requestGithubOidcToken({ env: { ...env }, fetchImpl });
			const verified = await verifyDeployedStaticOutput({ staticRoot: candidate.packageVerification.staticRoot, baseUrl: candidate.target.url, oidcToken, fetchImpl });
			return { result: "PASS", byte_output_digest: verified.byteOutputDigest, inventory_digest: verified.inventoryDigest };
		},
		validateProduction: async () => browser({ phase: "restore", deployment: await getVercelDeployment({ ...options, deploymentIdOrUrl: candidate.target.deployment_id }), packageVerification: candidate.packageVerification, priorReleaseRecord: candidate.record }),
		});
		return { ...outcome,
			authorization: { binding_digest: productionApprovalDigest(binding), actor: env.GITHUB_ACTOR },
			workflow: { id: env.GITHUB_RUN_ID, attempt: env.GITHUB_RUN_ATTEMPT, sha: env.PRODUCTION_WORKFLOW_SHA ?? env.GITHUB_WORKFLOW_SHA, path: binding.workflow_path, created_at: new Date().toISOString() },
			prior_release: { run_id: candidate.approved.run_id, run_attempt: candidate.approved.run_attempt, artifact_id: candidate.approved.artifact_id, archive_digest: candidate.approved.archive_digest, record_digest: candidate.approved.record_digest,
				target: candidate.record.target, source_run: candidate.record.source_run, package_artifact: candidate.record.package_artifact, upstream_artifact: candidate.record.upstream_artifact, core: candidate.record.core, site: candidate.record.site, output_digest: candidate.record.output_digest },
			indexing_action: false, dns_action: false, release_action: false,
		};
	};
	return {
		workflow: { id: env.GITHUB_RUN_ID, attempt: env.GITHUB_RUN_ATTEMPT, workflow_sha: env.PRODUCTION_WORKFLOW_SHA ?? env.GITHUB_WORKFLOW_SHA, main_sha: binding.main_sha, path: binding.workflow_path, actor: env.GITHUB_ACTOR, triggering_actor: env.PRODUCTION_TRIGGERING_ACTOR ?? env.GITHUB_TRIGGERING_ACTOR, created_at: new Date().toISOString() },
		guard, validateBrowser: browser, rollbackCandidate, restoreRollback,
		cleanup: () => rmSync(workspace, { recursive: true, force: true }),
		api: {
			snapshot, currentProductionId, aliases: waitForAliases,
			stage: async (artifact) => {
				await guard(); const state = await snapshot();
				assert((state.currentDeployment?.id ?? null) === target.current_deployment_id, "PRODUCTION_STAGE_DRIFT");
				await aliasesFor(target.current_deployment_id);
				staged = await stagePrebuiltProduction({ ...options, packageRoot: artifact.outputDirectory, target, artifact: { ...artifact, deploymentFiles: deploymentFiles(artifact.outputDirectory) }, vercelCliPath: env.VERCEL_CLI_PATH, env });
				return { ...staged.deployment, url: new URL(staged.deployment.url).hostname };
			},
			promote: async (deployment, artifact, report) => {
				await guard(); const state = await snapshot();
				assert((state.currentDeployment?.id ?? null) === target.current_deployment_id, "PRODUCTION_PROMOTION_DRIFT");
				const validation = { result: "PASS", phase: "staged", deploymentId: deployment.id, outputDigest: artifact.outputDigest, browser: report, remoteInventory: staged.remoteInventory };
				validation.validationDigest = productionValidationDigest(validation);
				return promoteStagedProduction({ ...options, deploymentId: deployment.id, target, artifact: { ...artifact, deploymentFiles: deploymentFiles(artifact.outputDirectory) }, packageRoot: artifact.outputDirectory, prePromotionValidation: validation });
			},
		},
	};
}
