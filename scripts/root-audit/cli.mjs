import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	evaluateAudit,
	canonicalJson,
	fetchIssueComments,
	hashCanonical,
	existingExceptionBinding,
	fetchIssue,
	fetchDecisionIssue,
	fetchPullRequest,
	latestOwnerDecision,
	latestOwnerEvidence,
	sha256,
	validateDecisionIssue,
} from "./evaluator.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const outputPath = process.env.POLICY_RESULT_PATH ?? join(process.cwd(), "root-audit-result.json");
const rawAuditPath = process.env.RAW_AUDIT_PATH ?? join(process.cwd(), "root-audit.json");
const auditExitCodePath = process.env.RAW_AUDIT_EXIT_CODE_PATH ?? join(process.cwd(), "root-audit.exit-code");
const stderrPath = process.env.RAW_AUDIT_STDERR_PATH ?? join(process.cwd(), "root-audit.stderr");
const executedPath = process.env.RAW_AUDIT_EXECUTED_PATH ?? join(process.cwd(), "root-audit.executed");
const unignoredAuditPath = process.env.UNIGNORED_AUDIT_PATH ?? join(process.cwd(), "root-audit-unignored.json");
const unignoredAuditExitCodePath = process.env.UNIGNORED_AUDIT_EXIT_CODE_PATH ?? join(process.cwd(), "root-audit-unignored.exit-code");
const unignoredAuditStderrPath = process.env.UNIGNORED_AUDIT_STDERR_PATH ?? join(process.cwd(), "root-audit-unignored.stderr");
const unignoredAuditExecutedPath = process.env.UNIGNORED_AUDIT_EXECUTED_PATH ?? join(process.cwd(), "root-audit-unignored.executed");
const unignoredRootManifestPath = process.env.UNIGNORED_ROOT_MANIFEST_PATH ?? join(process.cwd(), "unignored-project/package.json");
const dependencyTreePath = process.env.DEPENDENCY_TREE_PATH ?? join(process.cwd(), "dependency-tree.raw.json");
const dependencyTreeExitCodePath = process.env.DEPENDENCY_TREE_EXIT_CODE_PATH ?? join(process.cwd(), "dependency-tree.exit-code");
const dependencyTreeStderrPath = process.env.DEPENDENCY_TREE_STDERR_PATH ?? join(process.cwd(), "dependency-tree.stderr");
const dependencyTreeExecutedPath = process.env.DEPENDENCY_TREE_EXECUTED_PATH ?? join(process.cwd(), "dependency-tree.executed");
const dependencyInstallStdoutPath = process.env.DEPENDENCY_INSTALL_STDOUT_PATH ?? join(process.cwd(), "dependency-install.stdout");
const dependencyInstallStderrPath = process.env.DEPENDENCY_INSTALL_STDERR_PATH ?? join(process.cwd(), "dependency-install.stderr");
const dependencyInstallExitCodePath = process.env.DEPENDENCY_INSTALL_EXIT_CODE_PATH ?? join(process.cwd(), "dependency-install.exit-code");
const dependencyInstallExecutedPath = process.env.DEPENDENCY_INSTALL_EXECUTED_PATH ?? join(process.cwd(), "dependency-install.executed");

function gitHead() {
	return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
}

function digestFile(path) {
	return sha256(readFileSync(join(root, path)));
}

function optionalDigest(path) {
	try { return sha256(readFileSync(path)); } catch (error) { if (error?.code === "ENOENT") return null; throw error; }
}

function candidateFor({ rawAudit, rawAuditStderr, auditExitCode, auditExecuted, unignoredAudit, unignoredAuditStderr, unignoredAuditExitCode, unignoredAuditExecuted, dependencyTree, dependencyTreeStderr, dependencyTreeExitCode, dependencyTreeExecuted, dependencyInstallStdout, dependencyInstallStderr, dependencyInstallExitCode, dependencyInstallExecuted, unignoredRootManifestBytes, existingException, pullRequest, decisionIssue, policy }) {
	const repository = process.env.GITHUB_REPOSITORY ?? "markd3ng/KIRARI";
	const prNumber = process.env.PR_NUMBER ? Number(process.env.PR_NUMBER) : null;
	const headSha = process.env.PR_HEAD_SHA || gitHead();
	const baseSha = process.env.PR_BASE_SHA || null;
	if (!/^[a-f0-9]{40}$/.test(headSha)) throw new Error("Candidate HEAD SHA is missing or malformed");
	if (prNumber !== null && (!Number.isSafeInteger(prNumber) || !/^[a-f0-9]{40}$/.test(baseSha ?? ""))) {
		throw new Error("Pull request candidate lacks its exact base SHA or PR number");
	}
	if (prNumber !== null && (repository !== policy.repository || prNumber !== 133 || headSha !== gitHead() || !pullRequest ||
		pullRequest.number !== prNumber || pullRequest.state !== "open" || pullRequest.baseRef !== "main" || pullRequest.baseRepository !== policy.repository ||
		pullRequest.headRepository !== policy.repository || pullRequest.baseSha !== baseSha || pullRequest.headSha !== headSha)) {
		throw new Error("PR event, checked-out source, and current public #133 API state do not match");
	}
	const r3Issue = prNumber === null ? null : validateDecisionIssue(decisionIssue, {
		authenticated: true,
		repository: policy.repository,
		issueNumber: policy.issueNumber,
	}, policy);
	const policyDigest = hashCanonical(policy);
	const auditReport = JSON.parse(rawAudit);
	const visibleHighCount = Object.values(auditReport.advisories)
		.filter((item) => item.severity === "high")
		.reduce((count, item) => count + (Array.isArray(item.findings) ? item.findings.length : 0), 0);
	const manifestPaths = ["package.json", "apps/site/package.json", "workers/kirari-edge/package.json", "packages/site-profile/package.json"];
	const manifestDigests = Object.fromEntries(manifestPaths.map((path) => [path, digestFile(path)]));
	const importerManifestPaths = manifestPaths.slice(1);
	const auditWorkspaceDigests = {
		rootManifest: sha256(unignoredRootManifestBytes),
		lockfile: sha256(readFileSync(join(dirname(unignoredRootManifestPath), "pnpm-lock.yaml"))),
		workspaceFile: sha256(readFileSync(join(dirname(unignoredRootManifestPath), "pnpm-workspace.yaml"))),
		importerManifests: Object.fromEntries(importerManifestPaths.map((path) => [path, sha256(readFileSync(join(dirname(unignoredRootManifestPath), path)))])),
		rootNpmrc: optionalDigest(join(root, ".npmrc")),
		workspaceNpmrc: optionalDigest(join(dirname(unignoredRootManifestPath), ".npmrc")),
	};
	if (auditWorkspaceDigests.lockfile !== digestFile("pnpm-lock.yaml") || auditWorkspaceDigests.workspaceFile !== digestFile("pnpm-workspace.yaml")) {
		throw new Error("The supplemental audit workspace lockfile/workspace file differs from source");
	}
	if (auditWorkspaceDigests.rootNpmrc !== auditWorkspaceDigests.workspaceNpmrc) throw new Error("Supplemental audit npmrc differs from source");
	for (const path of importerManifestPaths) {
		if (auditWorkspaceDigests.importerManifests[path] !== manifestDigests[path]) throw new Error(`Supplemental audit importer manifest differs from source: ${path}`);
	}
	const pnpmVersion = "9.14.4"; // Kept in sync with the pinned pnpm/action-setup version in CI.
	const binding = {
		repository,
		issueNumber: policy.issueNumber,
		prNumber,
		baseSha,
		headSha,
		lockfileDigest: digestFile("pnpm-lock.yaml"),
		manifestDigests,
		auditWorkspaceDigests,
		auditToolchain: { pnpmVersion, nodeVersion: process.version, nvmrc: readFileSync(join(root, ".nvmrc"), "utf8").trim() },
		policyDigest,
		evaluatorDigest: sha256(Buffer.concat([
			readFileSync(join(root, "scripts/root-audit/evaluator.mjs")),
			Buffer.from([0]),
			readFileSync(join(root, "scripts/root-audit/cli.mjs")),
		])),
		workflowDigest: digestFile(".github/workflows/ci.yml"),
		existingException: existingExceptionBinding(existingException),
		ignoredHighCount: auditReport.metadata.vulnerabilities.high - visibleHighCount,
		unignoredRootManifestDigest: sha256(unignoredRootManifestBytes),
		audit: {
			executed: auditExecuted,
			sha256: sha256(rawAudit),
			stderrSha256: sha256(rawAuditStderr),
			exitCode: auditExitCode,
			expectedR3Findings: policy.audit.expectedFindings,
		},
		unignoredAudit: {
			executed: unignoredAuditExecuted,
			sha256: sha256(unignoredAudit),
			stderrSha256: sha256(unignoredAuditStderr),
			exitCode: unignoredAuditExitCode,
		},
		dependencyTree: {
			executed: dependencyTreeExecuted,
			sha256: sha256(dependencyTree),
			stderrSha256: sha256(dependencyTreeStderr),
			exitCode: dependencyTreeExitCode,
		},
		dependencyInstall: {
			executed: dependencyInstallExecuted,
			stdoutSha256: sha256(dependencyInstallStdout),
			stderrSha256: sha256(dependencyInstallStderr),
			exitCode: dependencyInstallExitCode,
		},
		pullRequest: pullRequest ? { ...pullRequest } : null,
		r3Issue,
	};
	return { binding, candidateDigest: hashCanonical(binding), policyDigest, baseSha, headSha };
}

async function getAuthority(candidate, policy) {
	const decisionIssue = await fetchDecisionIssue({ issueNumber: 135 });
	const currentR3IssueBinding = validateDecisionIssue(decisionIssue, {
		authenticated: true,
		repository: "markd3ng/KIRARI",
		issueNumber: 135,
	}, policy);
	if (canonicalJson(currentR3IssueBinding) !== canonicalJson(candidate.binding.r3Issue)) {
		throw new Error("R3 Issue #135 changed after candidate binding");
	}
	const comments = await fetchIssueComments({ repository: "markd3ng/KIRARI", issueNumber: 135 });
	const evidence = latestOwnerEvidence(comments, candidate.candidateDigest);
	const decision = latestOwnerDecision(comments, candidate.candidateDigest);
	if (!evidence || !decision) return { authenticated: true, evidence: evidence?.record, evidenceSource: evidence?.source, latestDecision: decision?.record, latestDecisionSource: decision?.source };
	return {
		authenticated: true,
		evidence: evidence.record,
		evidenceSource: evidence.source,
		latestDecision: decision.record,
		latestDecisionSource: decision.source,
	};
}

function writeResult(result) {
	const text = `${JSON.stringify(result, null, 2)}\n`;
	writeFileSync(outputPath, text);
	process.stdout.write(text);
	if (process.env.GITHUB_STEP_SUMMARY) {
		writeFileSync(process.env.GITHUB_STEP_SUMMARY, [
			"## Root audit policy evaluation",
			"",
			`- RAW_AUDIT_EXECUTED=${result.rawAuditExecuted ? "YES" : "NO"}`,
			`- RAW_AUDIT_EXIT_CODE=${result.rawAuditExitCode}`,
			`- RAW_AUDIT_FINDINGS=${JSON.stringify(result.rawAuditVulnerabilityCounts ?? "UNPARSED")}`,
			`- RAW_AUDIT_FINDING_PATHS=${result.rawAuditFindingCount ?? "UNPARSED"}`,
			`- UNIGNORED_AUDIT_EXECUTED=${result.unignoredAuditExecuted ? "YES" : "NO"}`,
			`- UNIGNORED_AUDIT_EXIT_CODE=${result.unignoredAuditExitCode}`,
			`- AUDIT_SCHEMA_SUPPORTED=${result.auditSchemaSupported ? "YES" : "NO"}`,
			`- POLICY_EVALUATION=${result.policyEvaluation}`,
			`- EXCEPTION_CONSUMPTION_AUTHORIZATION=${result.consumptionAuthorization}`,
			`- REASON=${result.reason}`,
			"",
		].join("\n"), { flag: "a" });
	}
}

let result;
let rawAuditExecuted = false;
let rawAuditExitCode = null;
let unignoredAuditExecuted = false;
let unignoredAuditExitCode = null;
let dependencyTreeExecuted = false;
let dependencyTreeExitCode = null;
let dependencyInstallExecuted = false;
let dependencyInstallExitCode = null;
try {
	const policy = JSON.parse(readFileSync(join(root, "scripts/root-audit/policy.json"), "utf8"));
	const rawAudit = readFileSync(rawAuditPath, "utf8");
	const exitCodeText = readFileSync(auditExitCodePath, "utf8").trim();
	const parsedExitCode = /^\d+$/.test(exitCodeText) ? Number(exitCodeText) : null;
	const auditExitCode = Number.isSafeInteger(parsedExitCode) ? parsedExitCode : null;
	const rawAuditStderr = readFileSync(stderrPath, "utf8");
	rawAuditExecuted = readFileSync(executedPath, "utf8").trim() === "YES";
	rawAuditExitCode = rawAuditExecuted && Number.isSafeInteger(auditExitCode) ? auditExitCode : null;
	const unignoredAudit = readFileSync(unignoredAuditPath, "utf8");
	const unignoredExitText = readFileSync(unignoredAuditExitCodePath, "utf8").trim();
	const parsedUnignoredExitCode = /^\d+$/.test(unignoredExitText) ? Number(unignoredExitText) : null;
	const unignoredAuditStderr = readFileSync(unignoredAuditStderrPath, "utf8");
	unignoredAuditExecuted = readFileSync(unignoredAuditExecutedPath, "utf8").trim() === "YES";
	unignoredAuditExitCode = unignoredAuditExecuted && Number.isSafeInteger(parsedUnignoredExitCode) ? parsedUnignoredExitCode : null;
	const dependencyTree = readFileSync(dependencyTreePath, "utf8");
	const dependencyTreeExitCodeText = readFileSync(dependencyTreeExitCodePath, "utf8").trim();
	const parsedDependencyTreeExitCode = /^\d+$/.test(dependencyTreeExitCodeText) ? Number(dependencyTreeExitCodeText) : null;
	const dependencyTreeStderr = readFileSync(dependencyTreeStderrPath, "utf8");
	dependencyTreeExecuted = readFileSync(dependencyTreeExecutedPath, "utf8").trim() === "YES";
	dependencyTreeExitCode = dependencyTreeExecuted && Number.isSafeInteger(parsedDependencyTreeExitCode) ? parsedDependencyTreeExitCode : null;
	const dependencyInstallStdout = readFileSync(dependencyInstallStdoutPath, "utf8");
	const dependencyInstallStderr = readFileSync(dependencyInstallStderrPath, "utf8");
	const dependencyInstallExitText = readFileSync(dependencyInstallExitCodePath, "utf8").trim();
	const parsedDependencyInstallExitCode = /^\d+$/.test(dependencyInstallExitText) ? Number(dependencyInstallExitText) : null;
	dependencyInstallExecuted = readFileSync(dependencyInstallExecutedPath, "utf8").trim() === "YES";
	dependencyInstallExitCode = dependencyInstallExecuted && Number.isSafeInteger(parsedDependencyInstallExitCode) ? parsedDependencyInstallExitCode : null;
	const unignoredRootManifestBytes = readFileSync(unignoredRootManifestPath);
	const unignoredRootManifestDigest = sha256(unignoredRootManifestBytes);
	const unignoredRootManifest = JSON.parse(unignoredRootManifestBytes.toString("utf8"));
	const rootManifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
	const existingException = await fetchIssue({ issueNumber: policy.preservedExistingException.issueNumber });
	const existingExceptionSource = { authenticated: true, repository: policy.repository, issueNumber: policy.preservedExistingException.issueNumber };
	const repository = process.env.GITHUB_REPOSITORY ?? policy.repository;
	const prNumber = process.env.PR_NUMBER ? Number(process.env.PR_NUMBER) : null;
	const pullRequest = prNumber === null ? null : await fetchPullRequest({ repository, pullNumber: prNumber });
	const decisionIssue = prNumber === null ? null : await fetchDecisionIssue({ issueNumber: policy.issueNumber });
	const candidate = candidateFor({ rawAudit, rawAuditStderr, auditExitCode, auditExecuted: rawAuditExecuted, unignoredAudit, unignoredAuditStderr, unignoredAuditExitCode, unignoredAuditExecuted, dependencyTree, dependencyTreeStderr, dependencyTreeExitCode, dependencyTreeExecuted, dependencyInstallStdout, dependencyInstallStderr, dependencyInstallExitCode, dependencyInstallExecuted, unignoredRootManifestBytes, existingException, pullRequest, decisionIssue, policy });
	let authority = null;
	if (rawAudit.includes(policy.audit.advisory.githubAdvisoryId) && candidate.binding.repository === policy.repository && candidate.binding.prNumber === 133) {
		try {
			authority = await getAuthority(candidate, policy);
		} catch (error) {
			authority = { authenticated: false, sourceError: error instanceof Error ? error.message : "GitHub source failed" };
		}
	}
	result = evaluateAudit({
		rawAudit,
		auditExitCode,
		auditExecuted: rawAuditExecuted,
		unignoredAudit,
		unignoredAuditExitCode,
		unignoredAuditExecuted,
		dependencyTreeRaw: dependencyTree,
		dependencyTreeStderr,
		dependencyTreeExitCode,
		dependencyTreeExecuted,
		dependencyInstallStdout,
		dependencyInstallStderr,
		dependencyInstallExitCode,
		dependencyInstallExecuted,
		unignoredRootManifest,
		unignoredRootManifestDigest,
		policy,
		rootManifest,
		candidate: { ...candidate, policyDigest: candidate.policyDigest },
		existingException,
		existingExceptionSource,
		authority,
	});
	result.candidateDigest = candidate.candidateDigest;
	result.policyDigest = candidate.policyDigest;
	result.baseSha = candidate.baseSha;
	result.headSha = candidate.headSha;
	result.candidateBinding = candidate.binding;
	result.rawAuditSha256 = candidate.binding.audit.sha256;
	result.unignoredAuditSha256 = candidate.binding.unignoredAudit.sha256;
} catch (error) {
	result = {
		rawAuditExecuted,
		rawAuditExitCode,
		unignoredAuditExecuted,
		unignoredAuditExitCode,
		dependencyTreeExecuted,
		dependencyTreeExitCode,
		dependencyInstallExecuted,
		dependencyInstallExitCode,
		auditSchemaSupported: false,
		policyEvaluation: "FAIL",
		consumptionAuthorization: "NO",
		qualifyingFindings: [],
		reason: error instanceof Error ? error.message : "Unknown root audit evaluator failure",
	};
}

writeResult(result);
if (result.policyEvaluation !== "PASS") process.exitCode = 1;
