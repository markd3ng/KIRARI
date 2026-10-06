import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { decisionIssueBinding, evaluateAudit, existingExceptionBinding, fetchDecisionIssue, fetchIssueComments, fetchPullRequest, hashCanonical, latestOwnerDecision, sha256, validateDecisionIssue } from "../root-audit/evaluator.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const policy = JSON.parse(readFileSync(join(root, "scripts/root-audit/policy.json"), "utf8"));
const policyDigest = hashCanonical(policy);
const rootManifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const baseSha = "c79659046cf6ea73ba69e03c3937d904c07ba93b";
const headSha = "583c3511694ec4bf4772f27ffbb66aa97f97f8d5";
const expiry = "2026-10-07T04:00:00Z";
const now = Date.parse("2026-10-06T12:00:00Z");
const existingException = {
	number: 122,
	state: "open",
	title: policy.preservedExistingException.issueTitle,
	body: policy.preservedExistingException.requiredIssueBodyPhrases.join("\n"),
	updated_at: "2026-10-06T06:20:00Z",
};
const decisionIssue = {
	number: 135,
	state: "open",
	title: policy.issueTitle,
	body: policy.requiredIssueBodyPhrases.join("\n"),
	updated_at: "2026-10-06T06:19:55Z",
};

function advisory({
	id = 10001,
	github_advisory_id = policy.audit.advisory.githubAdvisoryId,
	module_name = policy.audit.advisory.package,
	severity = policy.audit.advisory.severity,
	findings = groupFindings(policy.audit.expectedFindings),
} = {}) {
	return {
		id,
		url: `https://github.com/advisories/${github_advisory_id}`,
		title: "Fixture advisory",
		module_name,
		severity,
		vulnerable_versions: "<7.1.6",
		patched_versions: ">=7.1.6",
		findings,
		cves: [],
		github_advisory_id,
	};
}

function groupFindings(findings) {
	const byVersion = new Map();
	for (const finding of findings) {
		const paths = byVersion.get(finding.version) ?? [];
		paths.push(finding.path);
		byVersion.set(finding.version, paths);
	}
	return [...byVersion].map(([version, paths]) => ({ version, paths }));
}

function treeRaw(extraFindings = []) {
	const rootNode = { name: "@kirari/site", version: "0.4.1", path: "/workspace/apps/site", private: true, dependencies: {} };
	const allFindings = [...policy.audit.expectedFindings, ...policy.preservedExistingException.expectedFindings, ...extraFindings];
	for (const finding of allFindings) {
		const parts = finding.path.split(">");
		assert.equal(parts.shift(), "apps__site");
		let dependencies = rootNode.dependencies;
		for (const [index, name] of parts.entries()) {
			const version = index === parts.length - 1 ? finding.version : "1.0.0";
			const node = dependencies[name] ?? {
				from: name,
				version,
				resolved: `https://registry.npmjs.org/${encodeURIComponent(name)}/-/${encodeURIComponent(name)}-${version}.tgz`,
				path: `/workspace/node_modules/${parts.slice(0, index + 1).join("/node_modules/")}`,
				dependencies: {},
			};
			assert.equal(node.version, version, `fixture dependency version conflict at ${name}`);
			dependencies[name] = node;
			dependencies = node.dependencies;
		}
	}
	return JSON.stringify([
		{ name: "kirari", version: "0.4.1", path: "/workspace", private: true, devDependencies: {} },
		rootNode,
		{ name: "@kirari/site-profile", version: "0.1.0", path: "/workspace/packages/site-profile", private: true },
		{ name: "@kirari/edge", version: "0.1.0", path: "/workspace/workers/kirari-edge", private: true, devDependencies: {} },
	]);
}

function exceptionAdvisory() {
	return {
		id: 10999,
		url: `https://github.com/advisories/${policy.preservedExistingException.githubAdvisoryId}`,
		title: "Fixture CVE-2026-93748 advisory",
		module_name: policy.preservedExistingException.package,
		severity: "high",
		vulnerable_versions: "<=4.2.0",
		patched_versions: ">=4.3.0",
		findings: groupFindings(policy.preservedExistingException.expectedFindings),
		cves: [policy.preservedExistingException.cve],
		github_advisory_id: policy.preservedExistingException.githubAdvisoryId,
	};
}

function actionsFor(advisories) {
	const byModule = new Map();
	for (const item of Object.values(advisories)) {
		const paths = item.github_advisory_id === policy.audit.advisory.githubAdvisoryId
			? policy.audit.advisory.expectedAuditResolutionPaths
			: item.github_advisory_id === policy.preservedExistingException.githubAdvisoryId
				? policy.preservedExistingException.expectedAuditResolutionPaths
				: item.findings.flatMap((finding) => finding.paths);
		const action = byModule.get(item.module_name) ?? { action: "review", module: item.module_name, resolves: [] };
		for (const path of paths) action.resolves.push({ id: item.id, path, dev: false, optional: false, bundled: false });
		byModule.set(item.module_name, action);
	}
	return [...byModule.values()];
}

function report({ advisories = { 10001: advisory() }, counts = {}, ignoredCve = true } = {}) {
	const countsBySeverity = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, ...counts };
	for (const item of Object.values(advisories)) countsBySeverity[item.severity] += item.findings.length;
	// pnpm 9 filters #122's exact CVE from advisories but leaves it in metadata.
	if (ignoredCve) countsBySeverity.high += 1;
	const actionAdvisories = { ...advisories };
	if (ignoredCve && !Object.values(actionAdvisories).some((item) => item.github_advisory_id === policy.preservedExistingException.githubAdvisoryId)) {
		actionAdvisories[10999] = exceptionAdvisory();
	}
	return {
		actions: actionsFor(actionAdvisories),
		advisories,
		muted: [],
		metadata: {
			vulnerabilities: countsBySeverity,
			dependencies: 20,
			devDependencies: 20,
			optionalDependencies: 0,
			totalDependencies: 20,
		},
	};
}

function unignoredReport() {
	return report({ advisories: { 10001: advisory(), 10999: exceptionAdvisory() }, ignoredCve: false });
}

function unignoredFromPrimary(raw) {
	try {
		const reportValue = JSON.parse(raw);
		reportValue.advisories[10999] = exceptionAdvisory();
		reportValue.actions = actionsFor(reportValue.advisories);
		return JSON.stringify(reportValue);
	} catch {
		return JSON.stringify(unignoredReport());
	}
}

const unignoredRootManifest = structuredClone(rootManifest);
delete unignoredRootManifest.pnpm.auditConfig.ignoreCves;
delete unignoredRootManifest.pnpm.auditConfig;
const unignoredRootManifestDigest = sha256(JSON.stringify(unignoredRootManifest));
const dependencyTreeRaw = treeRaw();

function candidate(overrides = {}) {
	const issue = overrides.existingException ?? existingException;
	const binding = {
		repository: "markd3ng/KIRARI",
		issueNumber: 135,
		prNumber: 133,
		baseSha,
		headSha,
		lockfileDigest: sha256("lockfile"),
		manifestDigests: { "package.json": sha256("root"), "apps/site/package.json": sha256("site") },
		policyDigest,
		evaluatorDigest: sha256("evaluator"),
		workflowDigest: sha256("workflow"),
		existingException: existingExceptionBinding(issue),
		ignoredHighCount: 1,
		unignoredRootManifestDigest,
		audit: { executed: true, sha256: sha256(JSON.stringify(report())), exitCode: 1, expectedR3Findings: policy.audit.expectedFindings },
		unignoredAudit: { executed: true, sha256: sha256(JSON.stringify(unignoredReport())), exitCode: 1 },
		dependencyTree: { executed: true, sha256: sha256(dependencyTreeRaw), stderrSha256: sha256(""), exitCode: 0 },
		dependencyInstall: { executed: true, stdoutSha256: sha256("install stdout"), stderrSha256: sha256("install stderr"), exitCode: 0 },
		...overrides.binding,
	};
	return {
		binding,
		candidateDigest: hashCanonical(binding),
		policyDigest,
		baseSha,
		headSha,
		existingException: issue,
		...Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== "binding" && key !== "existingException")),
	};
}

function evidenceFor(sourceCandidate, overrides = {}) {
	const body = {
		schemaVersion: 1,
		repository: "markd3ng/KIRARI",
		issueNumber: 135,
		candidateDigest: sourceCandidate.candidateDigest,
		policyDigest: sourceCandidate.policyDigest,
		codeReviewDigest: sha256("independent-code-review"),
		securityReviewDigest: sha256("independent-security-review"),
		codeReviewVerdict: "PASS_NO_ACTIONABLE_FINDINGS",
		securityReviewVerdict: "READY_FOR_OWNER_CONSUMPTION_REVIEW",
		expiresAt: expiry,
		...overrides,
	};
	for (const key of Object.keys(body)) if (body[key] === undefined) delete body[key];
	body.reviewDigest = hashCanonical({
		codeReviewDigest: body.codeReviewDigest,
		codeReviewVerdict: body.codeReviewVerdict,
		securityReviewDigest: body.securityReviewDigest,
		securityReviewVerdict: body.securityReviewVerdict,
	});
	body.evidenceDigest = hashCanonical(body);
	return body;
}

function approvedAuthority(sourceCandidate, overrides = {}) {
	const evidence = evidenceFor(sourceCandidate, overrides.evidence);
	const evidenceId = 6010604001;
	const decision = {
		schemaVersion: 1,
		repository: "markd3ng/KIRARI",
		issueNumber: 135,
		decision: "APPROVE",
		consumptionAuthorization: "YES",
		candidateDigest: sourceCandidate.candidateDigest,
		policyDigest: sourceCandidate.policyDigest,
		reviewDigest: evidence.reviewDigest,
		evidenceDigest: evidence.evidenceDigest,
		evidenceCommentId: evidenceId,
		baseSha,
		headSha,
		expiresAt: evidence.expiresAt,
		...overrides.decision,
	};
	return {
		authenticated: true,
		evidence,
		evidenceSource: { authenticated: true, repository: "markd3ng/KIRARI", issueNumber: 135, commentId: evidenceId },
		latestDecision: decision,
		latestDecisionSource: {
			authenticated: true,
			repository: "markd3ng/KIRARI",
			issueNumber: 135,
			commentId: 6010604002,
			author: "markd3ng",
			authorAssociation: "OWNER",
			commentBody: JSON.stringify(decision),
		},
	};
}

function evaluate(overrides = {}) {
	const rawAudit = overrides.rawAudit ?? JSON.stringify(report());
	const exitCode = overrides.auditExitCode ?? 1;
	const supplementalRaw = overrides.unignoredAudit ?? unignoredFromPrimary(rawAudit);
	const supplementalExitCode = overrides.unignoredAuditExitCode ?? 1;
	const currentTreeRaw = overrides.dependencyTreeRaw ?? dependencyTreeRaw;
	const installStdout = overrides.dependencyInstallStdout ?? "install stdout";
	const installStderr = overrides.dependencyInstallStderr ?? "install stderr";
	const sourceCandidate = overrides.candidate ?? candidate({ binding: {
		audit: { executed: overrides.auditExecuted ?? true, sha256: sha256(rawAudit), exitCode, expectedR3Findings: policy.audit.expectedFindings },
		unignoredAudit: { executed: overrides.unignoredAuditExecuted ?? true, sha256: sha256(supplementalRaw), exitCode: supplementalExitCode },
		dependencyTree: { executed: overrides.dependencyTreeExecuted ?? true, sha256: sha256(currentTreeRaw), stderrSha256: sha256(overrides.dependencyTreeStderr ?? ""), exitCode: overrides.dependencyTreeExitCode ?? 0 },
		dependencyInstall: { executed: overrides.dependencyInstallExecuted ?? true, stdoutSha256: sha256(installStdout), stderrSha256: sha256(installStderr), exitCode: overrides.dependencyInstallExitCode ?? 0 },
	} });
	return evaluateAudit({
		rawAudit,
		auditExitCode: exitCode,
		auditExecuted: overrides.auditExecuted ?? true,
		policy: overrides.policy ?? policy,
		rootManifest: overrides.rootManifest ?? rootManifest,
		candidate: sourceCandidate,
		unignoredAudit: supplementalRaw,
		unignoredAuditExitCode: supplementalExitCode,
		unignoredAuditExecuted: overrides.unignoredAuditExecuted ?? true,
		dependencyTreeRaw: currentTreeRaw,
		dependencyTreeExitCode: overrides.dependencyTreeExitCode ?? 0,
		dependencyTreeExecuted: overrides.dependencyTreeExecuted ?? true,
		dependencyTreeStderr: overrides.dependencyTreeStderr ?? "",
		dependencyInstallStdout: installStdout,
		dependencyInstallStderr: installStderr,
		dependencyInstallExitCode: overrides.dependencyInstallExitCode ?? 0,
		dependencyInstallExecuted: overrides.dependencyInstallExecuted ?? true,
		unignoredRootManifest,
		unignoredRootManifestDigest,
		existingException: overrides.existingException ?? existingException,
		existingExceptionSource: overrides.existingExceptionSource ?? { authenticated: true, repository: "markd3ng/KIRARI", issueNumber: 122 },
		authority: overrides.authority ?? null,
		now: overrides.now ?? now,
	});
}

function assertFail(result) {
	assert.equal(result.policyEvaluation, "FAIL", result.reason);
	assert.equal(result.consumptionAuthorization, "NO");
}

test("exact current R3 paths can pass only with a matching authenticated future Owner decision", () => {
	const sourceCandidate = candidate();
	const result = evaluate({ candidate: sourceCandidate, authority: approvedAuthority(sourceCandidate) });
	assert.equal(result.auditSchemaSupported, true);
	assert.equal(result.policyEvaluation, "PASS", result.reason);
	assert.equal(result.consumptionAuthorization, "YES");
	assert.equal(result.decision.sourceCommentId, 6010604002);
});

test("the current engineering-only Owner decision cannot consume R3", () => {
	const result = evaluate();
	assertFail(result);
	assert.match(result.reason, /no current authenticated concrete Owner consumption approval/i);
});

test("missing, malformed, and expired approvals fail closed at the expiry instant", () => {
	const sourceCandidate = candidate();
	assertFail(evaluate({ candidate: sourceCandidate, authority: approvedAuthority(sourceCandidate, { evidence: { expiresAt: undefined } }) }));
	assertFail(evaluate({ candidate: sourceCandidate, authority: approvedAuthority(sourceCandidate, { evidence: { expiresAt: "next Tuesday" } }) }));
	assertFail(evaluate({ candidate: sourceCandidate, authority: approvedAuthority(sourceCandidate), now: Date.parse(expiry) }));
});

test("wrong or missing GHSA identity fails", () => {
	for (const ghsa of ["GHSA-rj75", undefined]) {
		const item = advisory(ghsa === undefined ? {} : { github_advisory_id: ghsa });
		if (ghsa === undefined) delete item.github_advisory_id;
		const result = evaluate({ rawAudit: JSON.stringify(report({ advisories: { 10001: item } })) });
		assertFail(result);
	}
});

test("additional moderate, high, and critical advisories are never covered by R3 approval", () => {
	for (const severity of ["moderate", "high", "critical"]) {
		const advisories = { 10001: advisory() };
		const extra = advisory({ id: 10002, github_advisory_id: "GHSA-aaaa-bbbb-cccc", module_name: "other-package", severity, findings: [{ version: "1.0.0", paths: ["apps__site>other-package"] }] });
		advisories[10002] = extra;
		const sourceCandidate = candidate();
		assertFail(evaluate({ rawAudit: JSON.stringify(report({ advisories })), candidate: sourceCandidate, authority: approvedAuthority(sourceCandidate), dependencyTreeRaw: treeRaw([{ version: "1.0.0", path: "apps__site>other-package" }]) }));
	}
});

test("changed parser version, parent, extra path, or missing path invalidates the exact topology", () => {
	const changed = [
		policy.audit.expectedFindings.map((item, index) => index === 0 ? { ...item, version: "6.0.11" } : item),
		policy.audit.expectedFindings.map((item, index) => index === 0 ? { ...item, path: item.path.replace("@tailwindcss/typography", "@another/parent") } : item),
		[...policy.audit.expectedFindings, { version: "6.1.4", path: "apps__site>new-parent>postcss-selector-parser" }],
		policy.audit.expectedFindings.slice(1),
	];
	for (const expectedFindings of changed) {
		const result = evaluate({ rawAudit: JSON.stringify(report({ advisories: { 10001: advisory({ findings: groupFindings(expectedFindings) }) } })) });
		assertFail(result);
	}
});

test("lockfile, HEAD, base, policy, and evidence binding drift invalidates approval", () => {
	const sourceCandidate = candidate();
	const authority = approvedAuthority(sourceCandidate);
	const changedBinding = candidate({ binding: { lockfileDigest: sha256("changed lockfile") } });
	assertFail(evaluate({ candidate: changedBinding, authority }));
	for (const field of ["headSha", "baseSha", "policyDigest", "evidenceDigest"]) {
		const changedDecision = approvedAuthority(sourceCandidate, { decision: { [field]: "f".repeat(40) } });
		assertFail(evaluate({ candidate: sourceCandidate, authority: changedDecision }));
	}
	const changedPolicy = { ...policy, policyVersion: "different" };
	assertFail(evaluate({ candidate: sourceCandidate, policy: changedPolicy, authority }));
});

test("malformed JSON, empty failed audit, unknown schema, and evaluator exceptions fail", () => {
	assertFail(evaluate({ rawAudit: "{not json", auditExitCode: 1 }));
	const empty = evaluate({ rawAudit: "", auditExitCode: 1 });
	assert.equal(empty.rawAuditExecuted, true);
	assertFail(empty);
	const unknown = report();
	unknown.futureSchemaField = true;
	assertFail(evaluate({ rawAudit: JSON.stringify(unknown) }));
	const unknownAdvisory = report();
	unknownAdvisory.advisories[10001].unrecognized = "future";
	assertFail(evaluate({ rawAudit: JSON.stringify(unknownAdvisory) }));
	assertFail(evaluate({ rawAudit: JSON.stringify(report()), policy: null }));
});

test("exact #122 remains separate: it cannot authorize unresolved R3, and exact R3 plus #122 can pass only with R3 approval", () => {
	const unresolved = evaluate();
	assertFail(unresolved);
	const sourceCandidate = candidate();
	const accepted = evaluate({ candidate: sourceCandidate, authority: approvedAuthority(sourceCandidate) });
	assert.equal(accepted.policyEvaluation, "PASS", accepted.reason);
	const changedIgnore = { ...rootManifest, pnpm: { ...rootManifest.pnpm, auditConfig: { ignoreCves: ["CVE-2099-12345"] } } };
	assertFail(evaluate({ candidate: sourceCandidate, authority: approvedAuthority(sourceCandidate), rootManifest: changedIgnore }));
	const revokedIssue = { ...existingException, state: "closed" };
	assertFail(evaluate({ candidate: candidate({ existingException: revokedIssue }), existingException: revokedIssue, authority: approvedAuthority(sourceCandidate) }));
	const narrowedIssue = { ...existingException, body: "Issue scope removed." };
	assertFail(evaluate({ candidate: candidate({ existingException: narrowedIssue }), existingException: narrowedIssue }));
});

test("the supplemental unignored audit must keep #122's exact package, version, CVE, and path", () => {
	for (const mutate of [
		(item) => { item.module_name = "another-package"; },
		(item) => { item.findings = [{ version: "4.1.0", paths: [policy.preservedExistingException.expectedFindings[0].path] }]; },
		(item) => { item.findings = [{ version: "4.2.0", paths: ["apps__site>new-parent>http-cache-semantics"] }]; },
		(item) => { item.cves = ["CVE-2099-00001"]; },
	]) {
		const supplemental = unignoredReport();
		mutate(supplemental.advisories[10999]);
		assertFail(evaluate({ unignoredAudit: JSON.stringify(supplemental) }));
	}
});

test("low-only findings preserve the existing moderate threshold", () => {
	const low = advisory({ id: 10002, github_advisory_id: "GHSA-low0-low0-low0", module_name: "low-package", severity: "low", findings: [{ version: "1.0.0", paths: ["apps__site>low-package"] }] });
	const result = evaluate({ rawAudit: JSON.stringify(report({ advisories: { 10002: low } })), auditExitCode: 0, dependencyTreeRaw: treeRaw([{ version: "1.0.0", path: "apps__site>low-package" }]) });
	assert.equal(result.policyEvaluation, "PASS", result.reason);
	assert.equal(result.qualifyingFindings.length, 0);
	const filteredReport = report({ advisories: {} });
	const filtered = evaluate({ rawAudit: JSON.stringify(filteredReport), auditExitCode: 0 });
	assert.equal(filtered.policyEvaluation, "PASS", filtered.reason);
	assert.equal(filtered.qualifyingFindings.length, 0);
});

test("revocation, local fake approval, wrong Issue, wrong source comment, and superseded HEAD fail", () => {
	const sourceCandidate = candidate();
	assertFail(evaluate({ candidate: sourceCandidate, authority: approvedAuthority(sourceCandidate, { decision: { decision: "REVOKE", consumptionAuthorization: "NO" } }) }));
	assertFail(evaluate({ candidate: sourceCandidate, authority: { ...approvedAuthority(sourceCandidate), authenticated: false } }));
	assertFail(evaluate({ candidate: sourceCandidate, authority: approvedAuthority(sourceCandidate, { decision: { issueNumber: 122 } }) }));
	assertFail(evaluate({ candidate: sourceCandidate, authority: approvedAuthority(sourceCandidate, { decision: { evidenceCommentId: 1 } }) }));
	assertFail(evaluate({ candidate: sourceCandidate, authority: approvedAuthority(sourceCandidate, { decision: { headSha: "a".repeat(40) } }) }));
	assertFail(evaluate({ candidate: sourceCandidate, authority: approvedAuthority(sourceCandidate, { decision: { candidateDigest: "old-r1-r2-candidate" } }) }));
	assertFail(evaluate({ candidate: sourceCandidate, authority: approvedAuthority(sourceCandidate, { evidence: { securityReviewVerdict: "NOT_READY_FOR_OWNER_CONSUMPTION_REVIEW" } }) }));
});

test("latest structured Owner action for this candidate supersedes an earlier approval", () => {
	const comments = [
		{ id: 10, body: `<!-- KIRARI-R3-DECISION:v1 -->\n${JSON.stringify({ candidateDigest: "candidate", decision: "APPROVE" })}`, updated_at: "2026-10-06T10:00:00Z", user: { login: "markd3ng" }, author_association: "OWNER" },
		{ id: 11, body: `<!-- KIRARI-R3-DECISION:v1 -->\n${JSON.stringify({ candidateDigest: "candidate", decision: "REVOKE" })}`, updated_at: "2026-10-06T11:00:00Z", user: { login: "markd3ng" }, author_association: "OWNER" },
		{ id: 12, body: `<!-- KIRARI-R3-DECISION:v1 -->\n${JSON.stringify({ candidateDigest: "candidate", decision: "APPROVE" })}`, updated_at: "2026-10-06T12:00:00Z", user: { login: "contributor" }, author_association: "CONTRIBUTOR" },
	];
	const latest = latestOwnerDecision(comments, "candidate");
	assert.equal(latest.record.decision, "REVOKE");
	assert.equal(latest.source.commentId, 11);
});

test("wrong audit exit status and unknown metadata fields fail", () => {
	assertFail(evaluate({ auditExitCode: 0 }));
	const reportWithFutureMetadata = report();
	reportWithFutureMetadata.metadata.vulnerabilities.future = 0;
	assertFail(evaluate({ rawAudit: JSON.stringify(reportWithFutureMetadata) }));
	const missingVisibleModerate = report({ advisories: {}, counts: { moderate: 1 } });
	assertFail(evaluate({ rawAudit: JSON.stringify(missingVisibleModerate) }));
});

test("dependency tree and nested pnpm 9 schema records are exact and fail closed", () => {
	const withUnknownFinding = report();
	withUnknownFinding.advisories[10001].findings[0].unexpected = "ignored";
	assertFail(evaluate({ rawAudit: JSON.stringify(withUnknownFinding) }));
	const withUnknownResolution = report();
	withUnknownResolution.actions[0].resolves[0].future = true;
	assertFail(evaluate({ rawAudit: JSON.stringify(withUnknownResolution) }));
	const treeWithUnknownField = JSON.parse(dependencyTreeRaw);
	treeWithUnknownField[0].unreviewed = true;
	assertFail(evaluate({ dependencyTreeRaw: JSON.stringify(treeWithUnknownField) }));
	assertFail(evaluate({ dependencyTreeExecuted: false }));
	assertFail(evaluate({ dependencyTreeExitCode: 1 }));
	assertFail(evaluate({ dependencyInstallExitCode: 1 }));
	const ok = evaluate();
	assert.equal(ok.rawAuditFindingCount, policy.audit.expectedFindings.length);
	assert.deepEqual(ok.rawAuditVulnerabilityCounts, { info: 0, low: 0, moderate: 2, high: 1, critical: 0 });
});

test("GitHub evidence reads use only the fixed unauthenticated public API source", async () => {
	const requests = [];
	const response = { ok: true, json: async () => [] };
	const comments = await fetchIssueComments({
		repository: "markd3ng/KIRARI",
		issueNumber: 135,
		fetchImpl: async (url, options) => {
			requests.push({ url, options });
			return response;
		},
	});
	assert.deepEqual(comments, []);
	assert.equal(requests[0].url, "https://api.github.com/repos/markd3ng/KIRARI/issues/135/comments?per_page=100&page=1");
	assert.deepEqual(requests[0].options.headers, { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" });
	assert.equal(Object.hasOwn(requests[0].options.headers, "authorization"), false);
	await assert.rejects(fetchIssueComments({ repository: "attacker/repo", issueNumber: 135, fetchImpl: async () => response }));
});

test("current PR source is read from the fixed public API and must identify PR #133", async () => {
	const requests = [];
	const pull = {
		number: 133,
		state: "open",
		base: { ref: "main", sha: baseSha, repo: { full_name: "markd3ng/KIRARI" } },
		head: { ref: "codex/p4-authorized-production", sha: headSha, repo: { full_name: "markd3ng/KIRARI" } },
	};
	const source = await fetchPullRequest({
		repository: "markd3ng/KIRARI",
		pullNumber: 133,
		fetchImpl: async (url, options) => {
			requests.push({ url, options });
			return { ok: true, json: async () => pull };
		},
	});
	assert.deepEqual(source, { number: 133, state: "open", baseRef: "main", headRef: "codex/p4-authorized-production", baseSha, headSha, baseRepository: "markd3ng/KIRARI", headRepository: "markd3ng/KIRARI" });
	assert.equal(requests[0].url, "https://api.github.com/repos/markd3ng/KIRARI/pulls/133");
	assert.equal(Object.hasOwn(requests[0].options.headers, "authorization"), false);
	await assert.rejects(fetchPullRequest({ repository: "attacker/repo", pullNumber: 133, fetchImpl: async () => ({ ok: true, json: async () => pull }) }));
});

test("R3 authority is bound to the exact open #135 decision contract", async () => {
	const source = { authenticated: true, repository: "markd3ng/KIRARI", issueNumber: 135 };
	assert.deepEqual(validateDecisionIssue(decisionIssue, source, policy), decisionIssueBinding(decisionIssue));
	assert.throws(() => validateDecisionIssue({ ...decisionIssue, state: "closed" }, source, policy), /closed or its exact decision identity changed/i);
	assert.throws(() => validateDecisionIssue({ ...decisionIssue, body: "unrelated" }, source, policy), /contract changed or was revoked/i);
	assert.throws(() => validateDecisionIssue(decisionIssue, { ...source, repository: "attacker/repo" }, policy), /cannot be verified/i);
	const requests = [];
	const fetched = await fetchDecisionIssue({
		issueNumber: 135,
		fetchImpl: async (url, options) => {
			requests.push({ url, options });
			return { ok: true, json: async () => decisionIssue };
		},
	});
	assert.equal(fetched.number, 135);
	assert.equal(requests[0].url, "https://api.github.com/repos/markd3ng/KIRARI/issues/135");
	assert.equal(Object.hasOwn(requests[0].options.headers, "authorization"), false);
});
