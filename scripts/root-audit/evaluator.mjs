import { createHash } from "node:crypto";

const SEVERITY = Object.freeze({ info: 0, low: 1, moderate: 2, high: 3, critical: 4 });
const TOP_LEVEL_KEYS = new Set(["actions", "advisories", "muted", "metadata"]);
const ACTION_KEYS = new Set(["action", "module", "resolves", "target", "depth"]);
const RESOLUTION_KEYS = new Set(["id", "path", "dev", "optional", "bundled"]);
const ADVISORY_KEYS = new Set([
	"id", "url", "title", "module_name", "severity", "vulnerable_versions", "patched_versions",
	"cwe", "cvss", "findings", "references", "created", "updated", "reported_by", "access",
	"recommendation", "cves", "metadata", "overview", "found_by", "deleted", "npm_advisory_id",
	"github_advisory_id",
]);

export function canonicalize(value) {
	if (value === null || typeof value === "string" || typeof value === "boolean") return value;
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (Array.isArray(value)) return value.map(canonicalize);
	if (typeof value === "object") {
		return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
	}
	throw new TypeError("Canonical JSON accepts only finite JSON values");
}

export function canonicalJson(value) {
	return JSON.stringify(canonicalize(value));
}

export function sha256(value) {
	return createHash("sha256").update(value).digest("hex");
}

export function hashCanonical(value) {
	return sha256(canonicalJson(value));
}

function isRecord(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, allowed, label) {
	if (!isRecord(value)) throw new Error(`${label} must be an object`);
	const unknown = Object.keys(value).filter((key) => !allowed.has(key));
	if (unknown.length) throw new Error(`${label} has unknown field(s): ${unknown.join(", ")}`);
}

function requireString(value, label) {
	if (typeof value !== "string" || value.length === 0) throw new Error(`${label} is missing or invalid`);
}

function expectedIgnoreConfig(rootManifest, policy) {
	const actual = rootManifest?.pnpm?.auditConfig?.ignoreCves;
	const expected = policy.preservedExistingException.manifestIgnoreValues;
	if (!Array.isArray(actual) || canonicalJson(actual) !== canonicalJson(expected)) {
		throw new Error("#122 audit ignore configuration changed from its exact existing scope");
	}
	const config = rootManifest?.pnpm?.auditConfig;
	if (Object.hasOwn(config, "ignoreGhsas") || Object.hasOwn(config, "ignore")) {
		throw new Error("Unexpected additional pnpm audit ignore configuration");
	}
}

function unignoredManifestFrom(rootManifest) {
	const manifest = structuredClone(rootManifest);
	delete manifest.pnpm.auditConfig.ignoreCves;
	if (Object.keys(manifest.pnpm.auditConfig).length === 0) delete manifest.pnpm.auditConfig;
	return manifest;
}

function validateExistingException(issue, source, policy) {
	const expected = policy.preservedExistingException;
	if (!issue || !source?.authenticated || source.repository !== policy.repository || source.issueNumber !== expected.issueNumber) {
		throw new Error("The existing #122 exception cannot be verified from its authenticated GitHub Issue");
	}
	if (issue.number !== expected.issueNumber || issue.state !== "open" || issue.title !== expected.issueTitle || typeof issue.body !== "string") {
		throw new Error("The existing #122 exception is closed or its approved issue identity changed");
	}
	if (typeof issue.updated_at !== "string" || !Number.isFinite(Date.parse(issue.updated_at))) throw new Error("The existing #122 issue timestamp is malformed");
	for (const phrase of expected.requiredIssueBodyPhrases) {
		if (!issue.body.includes(phrase)) throw new Error("The existing #122 exception contract changed or was revoked");
	}
}

export function existingExceptionBinding(issue) {
	return {
		issueNumber: issue.number,
		state: issue.state,
		title: issue.title,
		updatedAt: issue.updated_at,
		bodySha256: sha256(issue.body),
	};
}

export function decisionIssueBinding(issue) {
	return {
		issueNumber: issue.number,
		state: issue.state,
		title: issue.title,
		bodySha256: sha256(issue.body),
	};
}

export function validateDecisionIssue(issue, source, policy) {
	if (!issue || !source?.authenticated || source.repository !== policy.repository || source.issueNumber !== policy.issueNumber) {
		throw new Error("The R3 decision source cannot be verified from authenticated GitHub Issue #135");
	}
	if (issue.number !== policy.issueNumber || issue.state !== "open" || issue.title !== policy.issueTitle || typeof issue.body !== "string") {
		throw new Error("R3 Issue #135 is closed or its exact decision identity changed");
	}
	if (typeof issue.updated_at !== "string" || !Number.isFinite(Date.parse(issue.updated_at))) throw new Error("R3 Issue #135 timestamp is malformed");
	for (const phrase of policy.requiredIssueBodyPhrases) {
		if (!issue.body.includes(phrase)) throw new Error("R3 Issue #135 contract changed or was revoked");
	}
	return decisionIssueBinding(issue);
}

function parseDependencyTree(rawTree, policy) {
	if (typeof rawTree === "string" && rawTree.length > 50_000_000) throw new Error("Dependency tree report exceeds its bounded size");
	let roots;
	try {
		roots = typeof rawTree === "string" ? JSON.parse(rawTree) : rawTree;
	} catch {
		throw new Error("Lock-resolved dependency tree JSON is malformed");
	}
	if (!Array.isArray(roots) || !Array.isArray(policy.audit.importers) || roots.length !== policy.audit.importers.length) {
		throw new Error("Dependency tree does not contain the exact lockfile workspace importer set");
	}
	const occurrences = [];
	let nodeCount = 0;
	function visit(dependencies, parents, depth, includeFindings = true) {
		if (depth > 100 || !isRecord(dependencies)) throw new Error("Dependency tree nesting or dependency map is invalid");
		for (const [name, node] of Object.entries(dependencies)) {
			nodeCount += 1;
			if (nodeCount > 100000) throw new Error("Dependency tree exceeds its bounded node count");
			exactKeys(node, new Set(["from", "version", "resolved", "path", "dependencies"]), `Dependency tree node ${name}`);
			if (typeof node.from !== "string" || !node.from.length || typeof node.version !== "string" || typeof node.resolved !== "string" || typeof node.path !== "string") {
				throw new Error(`Dependency tree node ${name} has an unsupported identity`);
			}
			const path = [...parents, name].join(">");
			if (includeFindings) occurrences.push({ name: node.from, version: node.version, path });
			if (Object.hasOwn(node, "dependencies")) visit(node.dependencies, [...parents, name], depth + 1, includeFindings);
		}
	}
	const seenImporters = new Set();
	for (const root of roots) {
		exactKeys(root, new Set(["name", "version", "path", "private", "dependencies", "devDependencies", "optionalDependencies", "unsavedDependencies"]), "Dependency tree root");
		if (typeof root.name !== "string" || typeof root.version !== "string" || typeof root.path !== "string" || typeof root.private !== "boolean") {
			throw new Error("Dependency tree root identity is unsupported");
		}
		const importer = policy.audit.importers.find((item) => item.name === root.name);
		if (!importer || seenImporters.has(importer.path)) throw new Error("Dependency tree contains an unknown or duplicate workspace root");
		seenImporters.add(importer.path);
		const slug = importer.path === "." ? "kirari" : importer.path.replaceAll("/", "__");
		if (Object.hasOwn(root, "unsavedDependencies")) {
			if (!isRecord(root.unsavedDependencies)) throw new Error(`Workspace importer ${importer.path} unsaved dependency field is invalid`);
			for (const [name, node] of Object.entries(root.unsavedDependencies)) {
				exactKeys(node, new Set(["from", "version", "path"]), `Unsaved dependency ${name}`);
				if (typeof node.from !== "string" || typeof node.version !== "string" || typeof node.path !== "string") {
					throw new Error(`Unsaved dependency ${name} has an unsupported identity`);
				}
			}
		}
		if (Object.hasOwn(root, "dependencies")) visit(root.dependencies, [slug], 1);
		for (const section of ["devDependencies", "optionalDependencies"]) {
			if (Object.hasOwn(root, section)) visit(root[section], [slug], 1, section === "optionalDependencies");
		}
	}
	if (seenImporters.size !== policy.audit.importers.length) throw new Error("Dependency tree is missing a lockfile workspace importer");
	return { roots, occurrences };
}

function parseActionList(actions) {
	if (!Array.isArray(actions)) throw new Error("Audit actions field is unsupported");
	return actions.map((action, index) => {
		exactKeys(action, ACTION_KEYS, `Audit action ${index}`);
		if (!["review", "update"].includes(action.action)) throw new Error(`Audit action ${index} type is unsupported`);
		requireString(action.module, `Audit action ${index} package`);
		if (!Array.isArray(action.resolves) || action.resolves.length === 0) throw new Error(`Audit action ${index} has no resolution records`);
		if (action.action === "review") {
			if (Object.hasOwn(action, "target") || Object.hasOwn(action, "depth")) throw new Error(`Audit review action ${index} has update-only fields`);
		} else {
			requireString(action.target, `Audit update action ${index} target`);
			if (!Number.isSafeInteger(action.depth) || action.depth < 0) throw new Error(`Audit update action ${index} depth is invalid`);
		}
		for (const [resolutionIndex, resolution] of action.resolves.entries()) {
			exactKeys(resolution, RESOLUTION_KEYS, `Audit action ${index} resolution ${resolutionIndex}`);
			if (!Number.isSafeInteger(resolution.id) || resolution.id < 0 || typeof resolution.path !== "string" || !resolution.path.length) {
				throw new Error(`Audit action ${index} resolution ${resolutionIndex} identity is invalid`);
			}
			for (const key of ["dev", "optional", "bundled"]) {
				if (Object.hasOwn(resolution, key) && typeof resolution[key] !== "boolean") throw new Error(`Audit action ${index} resolution ${resolutionIndex} ${key} is invalid`);
			}
		}
		return action;
	});
}

function parseAudit(rawAudit, auditExitCode, policy, rootManifest, { ignoredCveExpected = true } = {}) {
	let report;
	try {
		report = typeof rawAudit === "string" ? JSON.parse(rawAudit) : rawAudit;
	} catch {
		throw new Error("Raw audit JSON is malformed");
	}
	exactKeys(report, TOP_LEVEL_KEYS, "Audit report");
	const actions = parseActionList(report.actions);
	if (!Array.isArray(report.muted) || report.muted.length !== 0) throw new Error("Audit muted field is unsupported");
	if (!isRecord(report.advisories) || !isRecord(report.metadata) || !isRecord(report.metadata.vulnerabilities)) {
		throw new Error("Audit report schema is unsupported");
	}
	exactKeys(report.metadata, new Set(["vulnerabilities", "dependencies", "devDependencies", "optionalDependencies", "totalDependencies"]), "Audit metadata");
	exactKeys(report.metadata.vulnerabilities, new Set(["info", "low", "moderate", "high", "critical"]), "Audit vulnerability counts");
	for (const key of ["dependencies", "devDependencies", "optionalDependencies", "totalDependencies"]) {
		if (!Number.isSafeInteger(report.metadata[key]) || report.metadata[key] < 0) throw new Error(`Audit metadata ${key} is invalid`);
	}
	for (const key of ["info", "low", "moderate", "high", "critical"]) {
		if (!Number.isSafeInteger(report.metadata.vulnerabilities[key]) || report.metadata.vulnerabilities[key] < 0) {
			throw new Error(`Audit vulnerability count ${key} is invalid`);
		}
	}
	if (ignoredCveExpected) {
		expectedIgnoreConfig(rootManifest, policy);
	} else {
		const config = rootManifest?.pnpm?.auditConfig;
		if (config && (Object.hasOwn(config, "ignoreCves") || Object.hasOwn(config, "ignoreGhsas") || Object.hasOwn(config, "ignore"))) {
			throw new Error("Supplemental audit workspace must not apply any audit ignore");
		}
	}
	if (!Number.isSafeInteger(auditExitCode) || auditExitCode < 0) throw new Error("Actual audit exit code is missing");
	const aboveThresholdCount = Object.values(report.advisories)
		.filter((advisory) => SEVERITY[advisory.severity] >= SEVERITY[policy.audit.minimumSeverity])
		.reduce((count, advisory) => count + (Array.isArray(advisory.findings) ? advisory.findings.length : 0), 0);
	if (auditExitCode !== (aboveThresholdCount > 0 ? 1 : 0)) throw new Error("Raw audit exit status disagrees with its structured report and moderate threshold");

	const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 };
	const qualifying = [];
	for (const [advisoryKey, advisory] of Object.entries(report.advisories)) {
		exactKeys(advisory, ADVISORY_KEYS, `Advisory ${advisoryKey}`);
		for (const key of ["id", "module_name", "severity", "findings", "cves", "github_advisory_id", "url"]) {
			if (!Object.hasOwn(advisory, key)) throw new Error(`Advisory ${advisoryKey} is missing ${key}`);
		}
		if (String(advisory.id) !== advisoryKey) throw new Error(`Advisory key ${advisoryKey} does not match its id`);
		if (!Number.isSafeInteger(advisory.id)) throw new Error(`Advisory ${advisoryKey} id is invalid`);
		if (!Object.hasOwn(SEVERITY, advisory.severity) || !Array.isArray(advisory.findings) || !Array.isArray(advisory.cves)) {
			throw new Error(`Advisory ${advisoryKey} has an unsupported shape`);
		}
		requireString(advisory.module_name, `Advisory ${advisoryKey} package`);
		requireString(advisory.github_advisory_id, `Advisory ${advisoryKey} GHSA`);
		requireString(advisory.url, `Advisory ${advisoryKey} URL`);
		if (advisory.cves.some((cve) => typeof cve !== "string")) throw new Error(`Advisory ${advisoryKey} CVE list is malformed`);
		const findings = findingsFor(advisory);
		if (findings.length === 0) throw new Error(`Advisory ${advisoryKey} has no affected package versions`);
		counts[advisory.severity] += advisory.findings.length;
		if (SEVERITY[advisory.severity] >= SEVERITY[policy.audit.minimumSeverity]) qualifying.push(advisory);
	}

	// pnpm 9 reports the #122 ignored CVE in metadata counts while omitting that advisory
	// from the JSON advisory map. Only the exact existing high-severity #122 delta is allowed.
	for (const severity of Object.keys(counts)) {
		const expectedIgnored = ignoredCveExpected && severity === "high" && report.metadata.vulnerabilities.high - counts.high === 1 ? 1 : 0;
		if (report.metadata.vulnerabilities[severity] - counts[severity] !== expectedIgnored) {
			throw new Error(`Audit metadata ${severity} count does not match the visible advisories and exact #122 exception`);
		}
	}
	if (counts.high > report.metadata.vulnerabilities.high || report.metadata.vulnerabilities.high - counts.high > 1) {
		throw new Error("Audit contains an unaccounted ignored high-severity finding");
	}
	return { report, actions, qualifying, ignoredHighCount: report.metadata.vulnerabilities.high - counts.high };
}

function pathsFor(advisory, dependencyTree, policy) {
	const occurrences = dependencyTree.occurrences.filter((item) => item.name === advisory.module_name);
	const expectedException = policy.preservedExistingException;
	const isException = advisory.github_advisory_id === expectedException.githubAdvisoryId;
	const result = [];
	for (const finding of advisory.findings) {
		const versionOccurrences = occurrences.filter((item) => item.version === finding.version);
		if (versionOccurrences.length === 0) throw new Error(`Dependency tree does not contain ${advisory.module_name}@${finding.version}`);
		for (const path of finding.paths) {
			if (!versionOccurrences.some((item) => item.path === path || item.path.endsWith(`>${path}`))) {
				throw new Error(`Audit path for ${advisory.module_name}@${finding.version} is absent from the lock-resolved dependency tree`);
			}
		}
		if (isException) {
			result.push(...versionOccurrences.filter((item) => expectedException.expectedFindings.some((expected) =>
				expected.version === item.version && expected.path === item.path,
			)).map((item) => ({ version: item.version, path: item.path })));
		} else {
			result.push(...versionOccurrences.map((item) => ({ version: item.version, path: item.path })));
		}
	}
	return result.sort((a, b) => `${a.version}\0${a.path}`.localeCompare(`${b.version}\0${b.path}`));
}

function validateAuditActions(primary, supplemental, dependencyTree, policy) {
	if (canonicalJson(primary.actions) !== canonicalJson(supplemental.actions)) throw new Error("Primary and unignored audit action resolutions differ");
	const advisoriesById = new Map(Object.values(supplemental.report.advisories).map((advisory) => [advisory.id, advisory]));
	for (const action of primary.actions) {
		for (const resolution of action.resolves) {
			const advisory = advisoriesById.get(resolution.id);
			if (!advisory || advisory.module_name !== action.module) throw new Error("Audit action resolution does not match a visible advisory identity");
			const matchingPackage = dependencyTree.occurrences.filter((item) => item.name === action.module && item.path === resolution.path ||
				item.name === action.module && item.path.endsWith(`>${resolution.path}`));
			if (matchingPackage.length === 0) throw new Error(`Audit action path is absent from the lock-resolved dependency tree: ${resolution.path}`);
			if (!advisory.findings.some((finding) => matchingPackage.some((item) => item.version === finding.version))) {
				throw new Error(`Audit action package version does not match advisory ${resolution.id}`);
			}
		}
	}
	for (const [ghsa, expectedPaths, required] of [
		[policy.audit.advisory.githubAdvisoryId, policy.audit.advisory.expectedAuditResolutionPaths, false],
		[policy.preservedExistingException.githubAdvisoryId, policy.preservedExistingException.expectedAuditResolutionPaths, true],
	]) {
		const target = [...advisoriesById.values()].find((advisory) => advisory.github_advisory_id === ghsa);
		if (!target && !required) continue;
		if (!target || !Array.isArray(expectedPaths)) throw new Error(`Audit action policy is missing the exact ${ghsa} identity`);
		const paths = primary.actions.flatMap((action) => action.resolves.filter((resolution) => resolution.id === target.id).map((resolution) => resolution.path)).sort();
		if (canonicalJson(paths) !== canonicalJson([...expectedPaths].sort())) throw new Error(`Audit action resolution paths changed for ${ghsa}`);
	}
}

function validateUnignoredAudit(primary, supplemental, dependencyTree, policy) {
	const { report: fullReport, ignoredHighCount } = supplemental;
	if (ignoredHighCount !== 0) throw new Error("Supplemental audit still hides an ignored advisory");
	if (canonicalJson(primary.report.metadata) !== canonicalJson(fullReport.metadata)) throw new Error("Primary and unignored audit metadata differ");
	validateAuditActions(primary, supplemental, dependencyTree, policy);
	const existing = Object.entries(fullReport.advisories).filter(([, advisory]) =>
		advisory.github_advisory_id === policy.preservedExistingException.githubAdvisoryId || advisory.cves.includes(policy.preservedExistingException.cve),
	);
	if (existing.length !== 1) throw new Error("Unignored audit does not contain exactly one #122 advisory record");
	const [existingKey, advisory] = existing[0];
	const expected = policy.preservedExistingException;
	if (advisory.github_advisory_id !== expected.githubAdvisoryId || advisory.module_name !== expected.package || advisory.severity !== "high" || canonicalJson(advisory.cves) !== canonicalJson([expected.cve])) {
		throw new Error("The hidden audit advisory no longer matches exact #122 identity and severity");
	}
	const paths = pathsFor(advisory, dependencyTree, policy);
	if (canonicalJson(paths) !== canonicalJson(expected.expectedFindings)) throw new Error("The hidden #122 package version or dependency path changed");
	if (Object.hasOwn(primary.report.advisories, existingKey)) throw new Error("The primary audit unexpectedly included the filtered #122 advisory");
	if (primary.ignoredHighCount !== 1) throw new Error("The primary audit did not report exactly the one existing #122 high finding as ignored");
	const expectedPrimary = { ...fullReport.advisories };
	delete expectedPrimary[existingKey];
	const core = (items) => Object.fromEntries(Object.entries(items).map(([key, item]) => [key, {
		id: item.id,
		github_advisory_id: item.github_advisory_id,
		module_name: item.module_name,
		severity: item.severity,
		cves: item.cves,
		findings: pathsFor(item, dependencyTree, policy),
	}]).sort(([a], [b]) => a.localeCompare(b)));
	if (canonicalJson(core(expectedPrimary)) !== canonicalJson(core(primary.report.advisories))) {
		throw new Error("The primary and unignored audit advisory sets differ beyond the exact #122 filter");
	}
	return { finding: { githubAdvisoryId: expected.githubAdvisoryId, cve: expected.cve, package: expected.package, severity: advisory.severity, findings: paths } };
}

function findingsFor(advisory) {
	const output = [];
	for (const finding of advisory.findings) {
		exactKeys(finding, new Set(["version", "paths"]), "Advisory finding");
		if (typeof finding.version !== "string" || !finding.version.length || !Array.isArray(finding.paths)) {
			throw new Error("Advisory finding shape is unsupported");
		}
		for (const path of finding.paths) {
			if (typeof path !== "string" || path.length === 0) throw new Error("Advisory path is missing or invalid");
		}
		if (new Set(finding.paths).size !== finding.paths.length) throw new Error("Advisory finding contains a duplicate path");
		output.push({ version: finding.version, paths: [...finding.paths].sort() });
	}
	const sorted = output.sort((a, b) => a.version.localeCompare(b.version));
	if (new Set(sorted.map((item) => item.version)).size !== sorted.length) throw new Error("Advisory finding contains a duplicate version record");
	return sorted;
}

function allAuditFindings(report, dependencyTree, policy) {
	return Object.values(report.advisories).flatMap((advisory) => pathsFor(advisory, dependencyTree, policy).map((finding) => ({
		githubAdvisoryId: advisory.github_advisory_id,
		package: advisory.module_name,
		severity: advisory.severity,
		...finding,
	}))).sort((a, b) => `${a.githubAdvisoryId}\0${a.version}\0${a.path}`.localeCompare(`${b.githubAdvisoryId}\0${b.version}\0${b.path}`));
}

function exactR3(advisory, dependencyTree, policy) {
	const expected = policy.audit.advisory;
	if (advisory.github_advisory_id !== expected.githubAdvisoryId || advisory.module_name !== expected.package || advisory.severity !== expected.severity) {
		throw new Error("Qualifying advisory is not the exact reviewed R3 identity");
	}
	const actual = pathsFor(advisory, dependencyTree, policy);
	const wanted = [...policy.audit.expectedFindings].sort((a, b) => `${a.version}\0${a.path}`.localeCompare(`${b.version}\0${b.path}`));
	if (canonicalJson(actual) !== canonicalJson(wanted)) throw new Error("R3 versions or complete dependency paths changed");
	if (advisory.url !== `https://github.com/advisories/${expected.githubAdvisoryId}`) throw new Error("R3 advisory URL does not match its exact GHSA");
	return actual;
}

const EVIDENCE_KEYS = new Set([
	"schemaVersion", "repository", "issueNumber", "candidateDigest", "policyDigest", "reviewDigest",
	"codeReviewDigest", "securityReviewDigest", "codeReviewVerdict", "securityReviewVerdict", "expiresAt", "evidenceDigest",
]);
const DECISION_KEYS = new Set([
	"schemaVersion", "repository", "issueNumber", "decision", "consumptionAuthorization", "candidateDigest",
	"policyDigest", "reviewDigest", "evidenceDigest", "evidenceCommentId", "baseSha", "headSha", "expiresAt",
]);

function utcExpiry(value, now) {
	if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)) return false;
	const parsed = Date.parse(value);
	return Number.isFinite(parsed) && new Date(parsed).toISOString().replace(/\.000Z$/, "Z") === value.replace(/\.000Z$/, "Z") && now < parsed;
}

function validateEvidence(evidence, source, candidate, policy, now) {
	if (!evidence || !source?.authenticated) throw new Error("A locally supplied or unauthenticated evidence record cannot authorize R3");
	exactKeys(evidence, EVIDENCE_KEYS, "Evidence record");
	for (const key of ["codeReviewDigest", "securityReviewDigest"]) requireString(evidence[key], `Evidence ${key}`);
	if (evidence.schemaVersion !== 1 || evidence.repository !== policy.repository || evidence.issueNumber !== policy.issueNumber) throw new Error("Evidence source scope is wrong");
	if (source.repository !== policy.repository || source.issueNumber !== policy.issueNumber || !Number.isSafeInteger(source.commentId)) {
		throw new Error("Evidence comment source is not the authenticated #135 comment");
	}
	if (evidence.candidateDigest !== candidate.candidateDigest || evidence.policyDigest !== candidate.policyDigest) throw new Error("Evidence is for another candidate or policy");
	if (!utcExpiry(evidence.expiresAt, now)) throw new Error("Evidence expiry is missing, malformed, or expired");
	if (!["PASS_NO_ACTIONABLE_FINDINGS", "PASS_WITH_NONBLOCKING_NOTES"].includes(evidence.codeReviewVerdict) || evidence.securityReviewVerdict !== "READY_FOR_OWNER_CONSUMPTION_REVIEW") {
		throw new Error("Independent code or security review is not ready for Owner consumption review");
	}
	const reviewDigest = hashCanonical({
		codeReviewDigest: evidence.codeReviewDigest,
		codeReviewVerdict: evidence.codeReviewVerdict,
		securityReviewDigest: evidence.securityReviewDigest,
		securityReviewVerdict: evidence.securityReviewVerdict,
	});
	if (reviewDigest !== evidence.reviewDigest) throw new Error("Independent review digest does not match evidence");
	const { evidenceDigest, ...payload } = evidence;
	if (hashCanonical(payload) !== evidenceDigest) throw new Error("Evidence digest does not match its canonical payload");
	return evidence;
}

function validateDecision(decision, source, evidence, evidenceSource, candidate, policy, now) {
	if (!decision || !source?.authenticated) throw new Error("No authenticated Owner decision is available");
	exactKeys(decision, DECISION_KEYS, "Decision record");
	if (source.repository !== policy.repository || source.issueNumber !== policy.issueNumber || source.author !== "markd3ng" || source.authorAssociation !== "OWNER" || !Number.isSafeInteger(source.commentId)) {
		throw new Error("Decision source is not the authenticated repository Owner comment on #135");
	}
	if (decision.schemaVersion !== 1 || decision.repository !== policy.repository || decision.issueNumber !== policy.issueNumber) throw new Error("Decision scope is wrong");
	if (decision.decision !== "APPROVE" || decision.consumptionAuthorization !== "YES") throw new Error(`Latest Owner decision is ${String(decision.decision)}; consumption remains unauthorized`);
	if (decision.candidateDigest !== candidate.candidateDigest || decision.policyDigest !== candidate.policyDigest || decision.baseSha !== candidate.baseSha || decision.headSha !== candidate.headSha) {
		throw new Error("Owner decision does not match the current source candidate");
	}
	if (decision.evidenceCommentId !== evidenceSource.commentId || decision.reviewDigest !== evidence.reviewDigest || decision.evidenceDigest !== evidence.evidenceDigest || decision.expiresAt !== evidence.expiresAt) {
		throw new Error("Owner decision does not match the reviewed evidence package");
	}
	if (!utcExpiry(decision.expiresAt, now)) throw new Error("Owner approval is missing, malformed, or expired");
	return { ...decision, sourceCommentId: source.commentId, sourceAuthor: source.author, decisionDigest: hashCanonical({ sourceCommentId: source.commentId, commentBody: source.commentBody ?? "", decision }) };
}

export function evaluateAudit({ rawAudit, auditExitCode, auditExecuted = Number.isSafeInteger(auditExitCode), unignoredAudit, unignoredAuditExitCode, unignoredAuditExecuted = Number.isSafeInteger(unignoredAuditExitCode), dependencyTreeRaw, dependencyTreeExitCode, dependencyTreeExecuted = Number.isSafeInteger(dependencyTreeExitCode), dependencyTreeStderr = "", dependencyInstallStdout = "", dependencyInstallStderr = "", dependencyInstallExitCode, dependencyInstallExecuted = Number.isSafeInteger(dependencyInstallExitCode), unignoredRootManifest, unignoredRootManifestDigest, policy, rootManifest, candidate, existingException, existingExceptionSource, authority = null, now = Date.now() }) {
	const result = {
		rawAuditExecuted: auditExecuted === true,
		rawAuditExitCode: auditExitCode,
		unignoredAuditExecuted: unignoredAuditExecuted === true,
		unignoredAuditExitCode,
		dependencyTreeExecuted: dependencyTreeExecuted === true,
		dependencyTreeExitCode,
		dependencyInstallExecuted: dependencyInstallExecuted === true,
		dependencyInstallExitCode,
		auditSchemaSupported: false,
		policyEvaluation: "FAIL",
		consumptionAuthorization: "NO",
		qualifyingFindings: [],
		reason: "Evaluation did not complete",
	};
	try {
		if (!result.rawAuditExecuted) throw new Error("Raw audit output is empty");
		const primary = parseAudit(rawAudit, auditExitCode, policy, rootManifest);
		if (dependencyInstallExecuted !== true || dependencyInstallExitCode !== 0) throw new Error("Frozen-lockfile dependency install did not complete successfully");
		if (dependencyTreeExecuted !== true || dependencyTreeExitCode !== 0 || typeof dependencyTreeRaw !== "string" || !dependencyTreeRaw.length) {
			throw new Error("Lock-resolved dependency tree command did not complete successfully");
		}
		const dependencyTree = parseDependencyTree(dependencyTreeRaw, policy);
		const { qualifying, ignoredHighCount } = primary;
		if (unignoredAuditExecuted !== true || typeof unignoredAudit !== "string" || !unignoredAudit.length) throw new Error("The supplemental #122 identity audit did not execute or has no raw output");
		const supplemental = parseAudit(unignoredAudit, unignoredAuditExitCode, policy, unignoredRootManifest, { ignoredCveExpected: false });
		const existingExceptionFinding = validateUnignoredAudit(primary, supplemental, dependencyTree, policy);
		result.auditSchemaSupported = true;
		result.rawAuditAdvisoryCount = Object.keys(primary.report.advisories).length;
		result.rawAuditFindingCount = allAuditFindings(primary.report, dependencyTree, policy).length;
		result.rawAuditVulnerabilityCounts = primary.report.metadata.vulnerabilities;
		result.rawAuditFindings = allAuditFindings(primary.report, dependencyTree, policy);
		result.unignoredAuditAdvisoryCount = Object.keys(supplemental.report.advisories).length;
		result.unignoredAuditFindingCount = allAuditFindings(supplemental.report, dependencyTree, policy).length;
		result.unignoredAuditVulnerabilityCounts = supplemental.report.metadata.vulnerabilities;
		result.unignoredAuditFindings = allAuditFindings(supplemental.report, dependencyTree, policy);
		result.qualifyingFindings = qualifying.map((advisory) => ({ githubAdvisoryId: advisory.github_advisory_id, package: advisory.module_name, severity: advisory.severity }));
		const r3Records = Object.values(primary.report.advisories).filter((advisory) => advisory.github_advisory_id === policy.audit.advisory.githubAdvisoryId);
		if (r3Records.length > 1) throw new Error("The exact R3 advisory appears more than once");
		if (r3Records.length === 1) exactR3(r3Records[0], dependencyTree, policy);
		validateExistingException(existingException, existingExceptionSource, policy);
		if (canonicalJson(unignoredRootManifest) !== canonicalJson(unignoredManifestFrom(rootManifest))) {
			throw new Error("Supplemental audit manifest is not an exact copy with only the #122 ignore removed");
		}
		if (!candidate || !isRecord(candidate.binding) || candidate.policyDigest !== hashCanonical(policy) || candidate.binding.policyDigest !== candidate.policyDigest || candidate.candidateDigest !== hashCanonical(candidate.binding)) {
			throw new Error("Candidate is missing or policy/source digest changed");
		}
		if (candidate.binding.audit?.executed !== auditExecuted || candidate.binding.audit?.sha256 !== sha256(rawAudit) || candidate.binding.audit?.exitCode !== auditExitCode) {
			throw new Error("Candidate raw audit execution, digest, or exit code changed");
		}
		if (candidate.binding.unignoredAudit?.executed !== unignoredAuditExecuted || candidate.binding.unignoredAudit?.sha256 !== sha256(unignoredAudit) || candidate.binding.unignoredAudit?.exitCode !== unignoredAuditExitCode) {
			throw new Error("Candidate unignored audit execution, digest, or exit code changed");
		}
		if (candidate.binding.dependencyTree?.executed !== dependencyTreeExecuted || candidate.binding.dependencyTree?.sha256 !== sha256(dependencyTreeRaw) || candidate.binding.dependencyTree?.stderrSha256 !== sha256(dependencyTreeStderr) || candidate.binding.dependencyTree?.exitCode !== dependencyTreeExitCode) {
			throw new Error("Candidate dependency tree execution, digest, or exit code changed");
		}
		if (candidate.binding.dependencyInstall?.executed !== dependencyInstallExecuted || candidate.binding.dependencyInstall?.stdoutSha256 !== sha256(dependencyInstallStdout) || candidate.binding.dependencyInstall?.stderrSha256 !== sha256(dependencyInstallStderr) || candidate.binding.dependencyInstall?.exitCode !== dependencyInstallExitCode) {
			throw new Error("Candidate frozen-lockfile install execution, digest, or exit code changed");
		}
		if (candidate.binding.unignoredRootManifestDigest !== unignoredRootManifestDigest) throw new Error("Candidate unignored root manifest digest changed");
		if (candidate.binding.baseSha !== candidate.baseSha || candidate.binding.headSha !== candidate.headSha || candidate.binding.repository !== policy.repository || candidate.binding.issueNumber !== policy.issueNumber) {
			throw new Error("Candidate repository, Issue, base, or HEAD binding is inconsistent");
		}
		if (canonicalJson(candidate.binding.existingException) !== canonicalJson(existingExceptionBinding(existingException)) || candidate.binding.ignoredHighCount !== ignoredHighCount) {
			throw new Error("Candidate #122 control-plane state or ignored finding count changed");
		}
		if (canonicalJson(candidate.binding.audit.expectedR3Findings) !== canonicalJson(policy.audit.expectedFindings)) throw new Error("Candidate dependency-path binding differs from policy");
		if (qualifying.length === 0) {
			if (r3Records.length !== 0) throw new Error("The R3 advisory changed identity or severity below the reviewed moderate threshold");
			result.existingExceptionFinding = existingExceptionFinding.finding;
			result.policyEvaluation = "PASS";
			result.reason = "No unapproved finding meets the existing moderate audit threshold";
			return result;
		}
		if (qualifying.length !== 1) throw new Error("Additional moderate, high, or critical advisories are present");
		const expectedFindings = exactR3(qualifying[0], dependencyTree, policy);
		result.qualifyingFindings = expectedFindings;
		if (policy.state !== "OWNER_REVIEWED_FOR_ENGINEERING" || policy.consumptionAuthorization !== "NO") {
			throw new Error("Committed R3 policy must remain in the engineering-only, consumption-pending state");
		}
		if (!authority || !authority.authenticated || authority.latestDecision?.decision !== "APPROVE") {
			throw new Error("No current authenticated concrete Owner consumption approval exists");
		}
		const evidence = validateEvidence(authority.evidence, authority.evidenceSource, candidate, policy, now);
		const approval = validateDecision(authority.latestDecision, authority.latestDecisionSource, evidence, authority.evidenceSource, candidate, policy, now);
		result.policyEvaluation = "PASS";
		result.existingExceptionFinding = existingExceptionFinding.finding;
		result.consumptionAuthorization = "YES";
		result.reason = "The exact R3 finding is covered by a current authenticated and unexpired Owner decision";
		result.decision = approval;
		return result;
	} catch (error) {
		result.reason = error instanceof Error ? error.message : "Unknown evaluator failure";
		return result;
	}
}

export async function fetchIssueComments({ fetchImpl = fetch, repository, issueNumber }) {
	if (repository !== "markd3ng/KIRARI" || issueNumber !== 135) throw new Error("Only the fixed public #135 decision source is supported");
	const comments = [];
	for (let page = 1; page <= 100; page += 1) {
		const url = `https://api.github.com/repos/markd3ng/KIRARI/issues/135/comments?per_page=100&page=${page}`;
		const response = await fetchImpl(url, {
			headers: { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" },
		});
		if (!response.ok) throw new Error(`GitHub comment source returned HTTP ${response.status}`);
		const pageComments = await response.json();
		if (!Array.isArray(pageComments)) throw new Error("GitHub comment response schema is unsupported");
		comments.push(...pageComments);
		if (pageComments.length < 100) return comments;
	}
	throw new Error("GitHub comment source exceeded the bounded pagination limit");
}

export async function fetchIssue({ fetchImpl = fetch, issueNumber }) {
	if (issueNumber !== 122) throw new Error("Only the fixed existing #122 exception source is supported");
	const response = await fetchImpl("https://api.github.com/repos/markd3ng/KIRARI/issues/122", {
		headers: { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" },
	});
	if (!response.ok) throw new Error(`GitHub #122 source returned HTTP ${response.status}`);
	const issue = await response.json();
	if (!isRecord(issue) || issue.number !== 122 || typeof issue.title !== "string" || typeof issue.body !== "string" || typeof issue.state !== "string" || typeof issue.updated_at !== "string") {
		throw new Error("GitHub #122 response schema is unsupported");
	}
	return issue;
}

export async function fetchDecisionIssue({ fetchImpl = fetch, issueNumber }) {
	if (issueNumber !== 135) throw new Error("Only the fixed public #135 decision source is supported");
	const response = await fetchImpl("https://api.github.com/repos/markd3ng/KIRARI/issues/135", {
		headers: { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" },
	});
	if (!response.ok) throw new Error(`GitHub #135 source returned HTTP ${response.status}`);
	const issue = await response.json();
	if (!isRecord(issue) || issue.number !== 135 || typeof issue.title !== "string" || typeof issue.body !== "string" ||
		typeof issue.state !== "string" || typeof issue.updated_at !== "string") {
		throw new Error("GitHub #135 response schema is unsupported");
	}
	return issue;
}

export async function fetchPullRequest({ fetchImpl = fetch, repository, pullNumber }) {
	if (repository !== "markd3ng/KIRARI" || pullNumber !== 133) throw new Error("Only the fixed public #133 pull request source is supported");
	const response = await fetchImpl("https://api.github.com/repos/markd3ng/KIRARI/pulls/133", {
		headers: { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" },
	});
	if (!response.ok) throw new Error(`GitHub #133 source returned HTTP ${response.status}`);
	const pull = await response.json();
	if (!isRecord(pull) || pull.number !== 133 || typeof pull.state !== "string" || !isRecord(pull.base) || !isRecord(pull.head) ||
		typeof pull.base.sha !== "string" || typeof pull.head.sha !== "string" || !isRecord(pull.base.repo) || !isRecord(pull.head.repo) ||
		typeof pull.base.ref !== "string" || typeof pull.head.ref !== "string" || typeof pull.base.repo.full_name !== "string" || typeof pull.head.repo.full_name !== "string") {
		throw new Error("GitHub #133 response schema is unsupported");
	}
	return {
		number: pull.number,
		state: pull.state,
		baseRef: pull.base.ref,
		headRef: pull.head.ref,
		baseSha: pull.base.sha,
		headSha: pull.head.sha,
		baseRepository: pull.base.repo.full_name,
		headRepository: pull.head.repo.full_name,
	};
}

export function latestOwnerDecision(comments, candidateDigest) {
	const records = [];
	for (const comment of comments) {
		if (comment?.user?.login !== "markd3ng" || comment?.author_association !== "OWNER") continue;
		const body = typeof comment.body === "string" ? comment.body : "";
		if (!body.includes("<!-- KIRARI-R3-DECISION:v1 -->")) continue;
		if (!Number.isSafeInteger(comment.id) || !Number.isFinite(Date.parse(comment.updated_at))) throw new Error("Owner decision source metadata is malformed");
		const markerBody = body.split("<!-- KIRARI-R3-DECISION:v1 -->")[1]?.trim().replace(/^```json\s*/i, "").replace(/\s*```\s*$/, "");
		let record;
		try {
			record = JSON.parse(markerBody);
		} catch {
			throw new Error("Latest Owner decision marker is malformed");
		}
		if (record?.candidateDigest === candidateDigest) records.push({ record, comment });
	}
	records.sort((a, b) => Date.parse(a.comment.updated_at) - Date.parse(b.comment.updated_at) || Number(a.comment.id) - Number(b.comment.id));
	const latest = records.at(-1);
	if (!latest) return null;
	return {
		record: latest.record,
		source: {
			authenticated: true,
			repository: "markd3ng/KIRARI",
			issueNumber: 135,
			commentId: latest.comment.id,
			author: latest.comment.user.login,
			authorAssociation: latest.comment.author_association,
			commentBody: latest.comment.body,
		},
	};
}

export function latestOwnerEvidence(comments, candidateDigest) {
	const marker = "<!-- KIRARI-R3-EVIDENCE:v1 -->";
	const records = [];
	for (const comment of comments) {
		if (comment?.user?.login !== "markd3ng" || comment?.author_association !== "OWNER") continue;
		const body = typeof comment.body === "string" ? comment.body : "";
		if (!body.includes(marker)) continue;
		if (!Number.isSafeInteger(comment.id) || !Number.isFinite(Date.parse(comment.updated_at))) throw new Error("Owner evidence source metadata is malformed");
		let record;
		try {
			record = JSON.parse(body.split(marker)[1]?.trim().replace(/^```json\s*/i, "").replace(/\s*```\s*$/, ""));
		} catch {
			throw new Error("Owner evidence package marker is malformed");
		}
		if (record?.candidateDigest === candidateDigest) records.push({ record, comment });
	}
	records.sort((a, b) => Date.parse(a.comment.updated_at) - Date.parse(b.comment.updated_at) || Number(a.comment.id) - Number(b.comment.id));
	const latest = records.at(-1);
	if (!latest) return null;
	return {
		record: latest.record,
		source: { authenticated: true, repository: "markd3ng/KIRARI", issueNumber: 135, commentId: latest.comment.id },
	};
}
