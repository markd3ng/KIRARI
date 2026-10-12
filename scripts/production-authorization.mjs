import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const PRODUCTION_WORKFLOW_PATH = ".github/workflows/site-production.yml";
export const PRODUCTION_ENVIRONMENT_NAME = "kirari-site-production";
export const PRODUCTION_APPROVAL_MAX_AGE_SECONDS = 15 * 60;
export const PRODUCTION_AUTHORIZATION_ARTIFACT_PREFIX = "kirari-p4-authorization-";

const shaPattern = /^[a-f0-9]{40}$/;
const digestPattern = /^sha256:[a-f0-9]{64}$/;
const numericIdPattern = /^[1-9][0-9]*$/;
const noncePattern = /^[a-f0-9]{32}$/;

function fail(message) {
	throw new Error(message);
}

function assertObject(value, label) {
	if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
	return value;
}

function assertKeys(value, requiredKeys, label, optionalKeys = []) {
	const object = assertObject(value, label);
	const expected = new Set([...requiredKeys, ...optionalKeys]);
	const missing = requiredKeys.filter((key) => !(key in object));
	const extra = Object.keys(object).filter((key) => !expected.has(key));
	if (missing.length) fail(`${label} is missing required fields: ${missing.join(", ")}`);
	if (extra.length) fail(`${label} has unsupported fields: ${extra.join(", ")}`);
	return object;
}

function assertString(value, label, pattern) {
	if (typeof value !== "string" || !value || (pattern && !pattern.test(value))) fail(`${label} is invalid`);
	return value;
}

function assertPositiveInteger(value, label) {
	if (!Number.isSafeInteger(value) || value < 1) fail(`${label} must be a positive integer`);
	return value;
}

function normalizeDomain(value) {
	assertString(value, "Production domain");
	if (value !== value.toLowerCase() || value.includes("*") || value.includes(":") || value.endsWith(".")) {
		fail("Production domain must be a lowercase hostname without wildcards or a trailing dot");
	}
	let parsed;
	try {
		parsed = new URL(`https://${value}`);
	} catch {
		fail("Production domain is invalid");
	}
	if (parsed.hostname !== value || parsed.port || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
		fail("Production domain must be a bare hostname");
	}
	return value;
}

function normalizeOrigin(value) {
	assertString(value, "Production canonical origin");
	let parsed;
	try {
		parsed = new URL(value);
	} catch {
		fail("Production canonical origin is invalid");
	}
	if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port || parsed.pathname !== "/" || parsed.search || parsed.hash || parsed.origin !== value) {
		fail("Production canonical origin must be an HTTPS origin without a path, query, or fragment");
	}
	return value;
}

function normalizeJson(value, label = "JSON value") {
	if (value === null || typeof value === "string" || typeof value === "boolean") return value;
	if (typeof value === "number") {
		if (!Number.isFinite(value)) fail(`${label} must contain finite numbers`);
		return value;
	}
	if (Array.isArray(value)) return value.map((item, index) => normalizeJson(item, `${label}[${index}]`));
	const object = assertObject(value, label);
	return Object.fromEntries(Object.keys(object).sort().map((key) => [key, normalizeJson(object[key], `${label}.${key}`)]));
}

function validateRollbackRecord(value) {
	if (value === null) return null;
	const record = assertKeys(value, ["run_id", "run_attempt", "workflow_sha", "artifact_id", "archive_digest", "record_digest", "deployment_id"], "rollback_record");
	assertString(record.run_id, "rollback_record.run_id", numericIdPattern);
	assertPositiveInteger(record.run_attempt, "rollback_record.run_attempt");
	assertString(record.workflow_sha, "rollback_record.workflow_sha", shaPattern);
	assertString(record.artifact_id, "rollback_record.artifact_id", numericIdPattern);
	assertString(record.archive_digest, "rollback_record.archive_digest", digestPattern);
	assertString(record.record_digest, "rollback_record.record_digest", digestPattern);
	assertString(record.deployment_id, "rollback_record.deployment_id", /^dpl_[A-Za-z0-9]+$/);
	return {
		run_id: record.run_id,
		run_attempt: record.run_attempt,
		workflow_sha: record.workflow_sha,
		artifact_id: record.artifact_id,
		archive_digest: record.archive_digest,
		record_digest: record.record_digest,
		deployment_id: record.deployment_id,
	};
}

export function normalizeProductionTarget(value) {
	const target = assertKeys(value, ["team_id", "project", "project_id", "environment", "domains", "canonical_origin", "current_deployment_id", "operation"], "target");
	assertString(target.team_id, "target.team_id", /^team_[A-Za-z0-9]+$/);
	assertString(target.project, "target.project", /^[a-z0-9][a-z0-9-]*$/);
	assertString(target.project_id, "target.project_id", /^prj_[A-Za-z0-9]+$/);
	if (target.environment !== "production") fail('target.environment must equal "production"');
	if (!Array.isArray(target.domains) || !target.domains.length) fail("target.domains must be a non-empty array");
	const domains = target.domains.map(normalizeDomain).sort();
	if (new Set(domains).size !== domains.length) fail("target.domains must not contain duplicates");
	const canonicalOrigin = normalizeOrigin(target.canonical_origin);
	if (!domains.includes(new URL(canonicalOrigin).hostname)) fail("target.domains must include the canonical origin hostname");
	if (target.current_deployment_id !== null) assertString(target.current_deployment_id, "target.current_deployment_id", /^dpl_[A-Za-z0-9]+$/);
	if (!["deploy", "rollback"].includes(target.operation)) fail('target.operation must be "deploy" or "rollback"');
	return {
		team_id: target.team_id,
		project: target.project,
		project_id: target.project_id,
		environment: target.environment,
		domains,
		canonical_origin: canonicalOrigin,
		current_deployment_id: target.current_deployment_id,
		operation: target.operation,
	};
}

export function normalizeProductionBinding(value) {
	const binding = assertKeys(value, ["schema_version", "repository", "workflow_path", "workflow_sha", "main_sha", "issued_at", "nonce", "source", "package", "composition", "target", "rollback_record"], "approval binding");
	if (binding.schema_version !== 1) fail("approval binding schema_version must equal 1");
	assertString(binding.repository, "repository", /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);
	if (binding.workflow_path !== PRODUCTION_WORKFLOW_PATH) fail("approval binding workflow_path is not the production workflow");
	assertString(binding.workflow_sha, "workflow_sha", shaPattern);
	assertString(binding.main_sha, "main_sha", shaPattern);
	assertPositiveInteger(binding.issued_at, "issued_at");
	assertString(binding.nonce, "nonce", noncePattern);

	const source = assertKeys(binding.source, ["run_id", "run_attempt", "sha"], "source");
	assertString(source.run_id, "source.run_id", numericIdPattern);
	assertPositiveInteger(source.run_attempt, "source.run_attempt");
	assertString(source.sha, "source.sha", shaPattern);

	const sitePackage = assertKeys(binding.package, ["artifact_id", "archive_digest"], "package");
	assertString(sitePackage.artifact_id, "package.artifact_id", numericIdPattern);
	assertString(sitePackage.archive_digest, "package.archive_digest", digestPattern);

	const composition = assertKeys(binding.composition, ["core_sha", "site_sha"], "composition");
	assertString(composition.core_sha, "composition.core_sha", shaPattern);
	assertString(composition.site_sha, "composition.site_sha", shaPattern);

	const target = normalizeProductionTarget(binding.target);
	const rollbackRecord = validateRollbackRecord(binding.rollback_record);
	if (target.operation === "rollback" && rollbackRecord === null) fail("rollback operation requires a prior approved rollback_record");

	return {
		schema_version: 1,
		repository: binding.repository,
		workflow_path: PRODUCTION_WORKFLOW_PATH,
		workflow_sha: binding.workflow_sha,
		main_sha: binding.main_sha,
		issued_at: binding.issued_at,
		nonce: binding.nonce,
		source: { run_id: source.run_id, run_attempt: source.run_attempt, sha: source.sha },
		package: { artifact_id: sitePackage.artifact_id, archive_digest: sitePackage.archive_digest },
		composition: { core_sha: composition.core_sha, site_sha: composition.site_sha },
		target,
		rollback_record: rollbackRecord,
	};
}

function canonicalize(value) {
	if (Array.isArray(value)) return value.map(canonicalize);
	if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
	return value;
}

export function canonicalProductionBinding(binding) {
	return JSON.stringify(canonicalize(normalizeProductionBinding(binding)));
}

export function productionApprovalDigest(binding) {
	const hex = createHash("sha256").update(canonicalProductionBinding(binding)).digest("hex");
	return `sha256:${hex}`;
}

export function productionAuthorizationArtifactName(bindingOrDigest) {
	const digest = typeof bindingOrDigest === "string" ? bindingOrDigest : productionApprovalDigest(bindingOrDigest);
	if (!digestPattern.test(digest)) fail("authorization digest is invalid");
	return `${PRODUCTION_AUTHORIZATION_ARTIFACT_PREFIX}${digest.slice("sha256:".length)}`;
}

export function productionApprovalPhrase(binding) {
	const normalized = normalizeProductionBinding(binding);
	const operation = normalized.target.operation.toUpperCase();
	const digest = productionApprovalDigest(normalized);
	const hex = digest.slice("sha256:".length);
	return `APPROVE KIRARI PRODUCTION ${operation} TO ${normalized.target.project} ${normalized.target.project_id} ARTIFACT ${normalized.package.artifact_id} ${normalized.package.archive_digest} BINDING ${hex}`;
}

export function createProductionApprovalProposal(baseBinding, { nowSeconds = Math.floor(Date.now() / 1000), nonce = randomBytes(16).toString("hex") } = {}) {
	assertPositiveInteger(nowSeconds, "proposal time");
	const object = assertObject(baseBinding, "base approval binding");
	if ("issued_at" in object || "nonce" in object) fail("base approval binding must omit issued_at and nonce");
	const binding = normalizeProductionBinding({ ...object, issued_at: nowSeconds, nonce });
	const digest = productionApprovalDigest(binding);
	return {
		binding,
		digest,
		artifact_name: productionAuthorizationArtifactName(digest),
		phrase: productionApprovalPhrase(binding),
		expires_at: nowSeconds + PRODUCTION_APPROVAL_MAX_AGE_SECONDS,
	};
}

export function assertProductionApproval(binding, phrase, { nowSeconds = Math.floor(Date.now() / 1000), maxAgeSeconds = PRODUCTION_APPROVAL_MAX_AGE_SECONDS } = {}) {
	const normalized = normalizeProductionBinding(binding);
	assertPositiveInteger(nowSeconds, "current time");
	assertPositiveInteger(maxAgeSeconds, "approval max age");
	const age = nowSeconds - normalized.issued_at;
	if (age < -60) fail("owner authorization is dated too far in the future");
	if (age > maxAgeSeconds) fail("owner authorization has expired");
	if (typeof phrase !== "string" || phrase !== productionApprovalPhrase(normalized)) fail("owner authorization phrase does not match the exact approval binding");
	const digest = productionApprovalDigest(normalized);
	return { binding: normalized, digest, artifactName: productionAuthorizationArtifactName(digest) };
}

export function assertProductionDispatchContext(context, binding) {
	const normalized = normalizeProductionBinding(binding);
	const owner = String(context.repositoryOwner ?? "").toLowerCase();
	const actor = String(context.actor ?? "").toLowerCase();
	const triggeringActor = String(context.triggeringActor ?? "").toLowerCase();
	if (context.eventName !== "workflow_dispatch") fail("production workflow must be manually dispatched");
	if (context.ref !== "refs/heads/main") fail("production workflow must run from main");
	if (!owner || actor !== owner || triggeringActor !== owner) fail("only the repository owner may trigger production authorization");
	if (String(context.runAttempt) !== "1") fail("production authorization cannot be replayed by rerunning a workflow attempt");
	if (context.repository !== normalized.repository) fail("approval binding repository does not match the current repository");
	const expectedRef = `${normalized.repository}/${PRODUCTION_WORKFLOW_PATH}@refs/heads/main`;
	if (context.workflowRef !== expectedRef) fail("production workflow ref/path does not match the reviewed main workflow");
	if (context.sha !== normalized.main_sha || context.workflowSha !== normalized.workflow_sha || context.sha !== context.workflowSha) {
		fail("production workflow SHA must match the exact current main SHA in the approval binding");
	}
	if (context.currentMainSha !== context.sha) fail("production workflow SHA is no longer the current main SHA");
	return normalized;
}

export function assertProductionSourceRun(run, binding) {
	const normalized = normalizeProductionBinding(binding);
	const source = normalized.source;
	if (!run || typeof run !== "object" || Array.isArray(run)) fail("source workflow run response is invalid");
	if (String(run.id) !== source.run_id || Number(run.run_attempt) !== source.run_attempt) fail("source CI run ID or attempt does not match the approval binding");
	if (run.event !== "workflow_dispatch" || run.head_branch !== "main" || run.status !== "completed" || run.conclusion !== "success") {
		fail("source CI run must be a successful manual main-branch run");
	}
	if (run.path !== ".github/workflows/ci.yml") fail("source CI run must use the reviewed CI workflow");
	if (String(run.head_sha ?? "").toLowerCase() !== source.sha) fail("source CI run SHA does not match the approval binding");
	if (String(run.actor?.login ?? "").toLowerCase() !== normalized.repository.split("/")[0].toLowerCase() || String(run.triggering_actor?.login ?? "").toLowerCase() !== normalized.repository.split("/")[0].toLowerCase()) {
		fail("source CI run must have been triggered by the repository owner");
	}
	if (run.repository?.full_name && run.repository.full_name.toLowerCase() !== normalized.repository.toLowerCase()) fail("source CI run repository does not match the approval binding");
	if (run.head_repository?.full_name && run.head_repository.full_name.toLowerCase() !== normalized.repository.toLowerCase()) fail("source CI run head repository does not match the approval binding");
	return { runId: source.run_id, runAttempt: source.run_attempt, sha: source.sha };
}

export function assertSourceShaIsMainAncestor(comparison, sourceSha) {
	assertString(sourceSha, "source SHA", shaPattern);
	if (!comparison || typeof comparison !== "object" || Array.isArray(comparison)) fail("GitHub compare response is invalid");
	if (comparison.status !== "ahead" && comparison.status !== "identical") fail("source CI SHA is not an ancestor of current main");
	if (String(comparison.base_commit?.sha ?? "").toLowerCase() !== sourceSha || String(comparison.merge_base_commit?.sha ?? "").toLowerCase() !== sourceSha) {
		fail("GitHub compare response does not prove the source SHA is an ancestor of current main");
	}
	return true;
}

export function assertProtectedProductionEnvironment(environment, branchPolicies, { owner, requiredBranch = "main", expectedEnvironment = PRODUCTION_ENVIRONMENT_NAME } = {}) {
	if (!environment || typeof environment !== "object" || Array.isArray(environment)) fail("production GitHub environment response is invalid");
	if (environment.name !== expectedEnvironment) fail("production GitHub environment name does not match the reviewed target");
	if (environment.can_admins_bypass !== false) fail("production GitHub environment must explicitly disable administrator bypass");
	const rules = Array.isArray(environment.protection_rules) ? environment.protection_rules : [];
	const reviewerRule = rules.find((rule) => rule?.type === "required_reviewers");
	if (!reviewerRule || !Array.isArray(reviewerRule.reviewers) || reviewerRule.reviewers.length !== 1) {
		fail("production GitHub environment must have exactly one required reviewer");
	}
	const requiredReviewer = reviewerRule.reviewers[0];
	if (!owner || requiredReviewer?.type !== "User" || String(requiredReviewer.reviewer?.login ?? "").toLowerCase() !== String(owner).toLowerCase()) {
		fail("production GitHub environment required reviewer must be the repository owner as the sole User reviewer");
	}
	if (reviewerRule.prevent_self_review !== false) fail("production GitHub environment must explicitly permit the sole owner dispatcher to review");
	const branchPolicy = environment.deployment_branch_policy;
	if (!branchPolicy || branchPolicy.protected_branches !== false || branchPolicy.custom_branch_policies !== true) fail("production GitHub environment must use an explicit custom deployment-branch policy");
	const policies = Array.isArray(branchPolicies) ? branchPolicies : branchPolicies?.branch_policies;
	if (!Array.isArray(policies) || policies.length !== 1 || policies[0]?.name !== requiredBranch) fail(`production GitHub environment branch policy must allow only ${requiredBranch}`);
	if (policies[0].type !== undefined && policies[0].type !== "branch") fail("production GitHub environment policy must target a branch, not a tag");
	return { name: environment.name, ownerReviewerConfigured: true, allowedBranches: [requiredBranch] };
}

export function assertAuthorizationClaimUnused(artifactNames, bindingOrDigest) {
	const expectedName = productionAuthorizationArtifactName(bindingOrDigest);
	if (!Array.isArray(artifactNames) || artifactNames.some((name) => typeof name !== "string")) fail("GitHub artifact name list is invalid");
	if (artifactNames.includes(expectedName)) fail("this owner authorization has already been consumed");
	return expectedName;
}

export function assertAuthorizationClaimPresent(artifactNames, bindingOrDigest) {
	const expectedName = productionAuthorizationArtifactName(bindingOrDigest);
	if (!Array.isArray(artifactNames) || artifactNames.some((name) => typeof name !== "string")) fail("GitHub artifact name list is invalid");
	if (!artifactNames.includes(expectedName)) fail("the exact owner authorization claim artifact is missing");
	return expectedName;
}

function readJson(path) {
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch {
		fail(`could not read valid JSON from ${path}`);
	}
}

function option(args, name) {
	const index = args.indexOf(name);
	if (index < 0 || !args[index + 1]) fail(`missing required option ${name}`);
	return args[index + 1];
}

function dispatchContextFromEnv(env = process.env) {
	return {
		eventName: env.GITHUB_EVENT_NAME,
		ref: env.GITHUB_REF,
		actor: env.GITHUB_ACTOR,
		triggeringActor: env.GITHUB_TRIGGERING_ACTOR,
		repositoryOwner: env.GITHUB_REPOSITORY_OWNER,
		repository: env.GITHUB_REPOSITORY,
		workflowRef: env.GITHUB_WORKFLOW_REF,
		workflowSha: env.GITHUB_WORKFLOW_SHA,
		sha: env.GITHUB_SHA,
		runAttempt: env.GITHUB_RUN_ATTEMPT,
		currentMainSha: env.CURRENT_MAIN_SHA,
	};
}

export function runProductionAuthorizationCli(args = process.argv.slice(2), env = process.env) {
	const [command, ...rest] = args;
	let result;
	switch (command) {
		case "propose": {
			const proposal = createProductionApprovalProposal(readJson(option(rest, "--binding")));
			result = JSON.stringify(proposal);
			break;
		}
		case "verify-approval": {
			const binding = readJson(option(rest, "--binding"));
			const phrasePathIndex = rest.indexOf("--phrase-file");
			const phrase = phrasePathIndex >= 0
				? readFileSync(option(rest, "--phrase-file"), "utf8")
				: option(rest, "--phrase");
			const verified = assertProductionApproval(binding, phrase);
			result = JSON.stringify({ digest: verified.digest, artifact_name: verified.artifactName });
			break;
		}
		case "verify-dispatch": {
			const binding = readJson(option(rest, "--binding"));
			const context = { ...dispatchContextFromEnv(env), currentMainSha: option(rest, "--current-main-sha") };
			result = JSON.stringify({ main_sha: assertProductionDispatchContext(context, binding).main_sha });
			break;
		}
		case "verify-source": {
			const binding = readJson(option(rest, "--binding"));
			const run = readJson(option(rest, "--run"));
			const comparison = readJson(option(rest, "--comparison"));
			const verified = assertProductionSourceRun(run, binding);
			assertSourceShaIsMainAncestor(comparison, verified.sha);
			result = JSON.stringify(verified);
			break;
		}
		case "verify-environment": {
			const environment = readJson(option(rest, "--environment"));
			const policies = readJson(option(rest, "--branch-policies"));
			result = JSON.stringify(assertProtectedProductionEnvironment(environment, policies, { owner: option(rest, "--owner") }));
			break;
		}
		case "verify-claim": {
			const artifactNames = readJson(option(rest, "--artifact-names"));
			const digest = option(rest, "--digest");
			result = JSON.stringify({ artifact_name: assertAuthorizationClaimUnused(artifactNames, digest) });
			break;
		}
		case "verify-claim-present": {
			const artifactNames = readJson(option(rest, "--artifact-names"));
			const digest = option(rest, "--digest");
			result = JSON.stringify({ artifact_name: assertAuthorizationClaimPresent(artifactNames, digest) });
			break;
		}
		default:
			fail("command must be propose, verify-approval, verify-dispatch, verify-source, verify-environment, verify-claim, or verify-claim-present");
	}
	return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		process.stdout.write(`${runProductionAuthorizationCli()}\n`);
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : "Production authorization check failed"}\n`);
		process.exitCode = 1;
	}
}
