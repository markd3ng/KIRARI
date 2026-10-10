import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
	assertProductionDeployment,
	assertProductionTargetSnapshot,
	deriveProductionIndexingPolicy,
	ProductionValidationError,
	verifyDeployedStaticOutput,
} from "../p4-production/production-validation.mjs";
import { assertProductionReleaseRecord, createProductionReleaseRecord } from "../p4-production/evidence.mjs";
import { productionApprovalDigest, normalizeProductionBinding, PRODUCTION_WORKFLOW_PATH } from "../production-authorization.mjs";
import { assertCanonicalLink } from "../p3-browser/production-browser-helpers.mjs";

const coreSha = "c".repeat(40);
const siteSha = "a".repeat(40);
const workflowSha = "b".repeat(40);
const archiveDigest = `sha256:${"1".repeat(64)}`;
const upstreamDigest = `sha256:${"2".repeat(64)}`;
const outputDigest = `sha256:${"3".repeat(64)}`;
const byteOutputDigest = `sha256:${"4".repeat(64)}`;
const inventoryDigest = `sha256:${"5".repeat(64)}`;
const targetDomain = "kirari-main.vercel.app";
const targetOrigin = `https://${targetDomain}`;
const currentDeploymentId = "dpl_current123";
const nextDeploymentId = "dpl_next456";

function temporaryDirectory() {
	const root = mkdtempSync(join(tmpdir(), "kirari-p4-validation-"));
	mkdirSync(join(root, ".vercel", "output", "static"), { recursive: true });
	return root;
}

function staticFixture(root, { canonicalOrigin = targetOrigin, robots = undefined, page = undefined, config = undefined } = {}) {
	mkdirSync(join(root, "posts", "welcome"), { recursive: true });
	writeFileSync(join(root, "index.html"), page ?? `<html><head><title>Welcome</title><link rel="canonical" href="${canonicalOrigin}/"></head><body><h1>Welcome</h1><link rel="stylesheet" href="/site.css"><a href="/posts/welcome/">Read</a></body></html>`);
	writeFileSync(join(root, "posts", "welcome", "index.html"), `<html><head><title>Post</title><link rel="canonical" href="${canonicalOrigin}/posts/welcome/"></head><body><h1>Post</h1></body></html>`);
	writeFileSync(join(root, "site.css"), "body{color:black}");
	writeFileSync(join(root, "robots.txt"), robots ?? `User-agent: *\nAllow: /\nDisallow: /llms-full.txt\n\nSitemap: ${canonicalOrigin}/sitemap-index.xml\n`);
	writeFileSync(join(root, "sitemap-index.xml"), "<sitemapindex></sitemapindex>");
	if (config !== undefined) {
		mkdirSync(join(root, ".."), { recursive: true });
		writeFileSync(join(root, "..", "config.json"), JSON.stringify(config));
	}
}

function binding(overrides = {}) {
	return normalizeProductionBinding({
		schema_version: 1,
		repository: "markd3ng/KIRARI",
		workflow_path: PRODUCTION_WORKFLOW_PATH,
		workflow_sha: workflowSha,
		main_sha: workflowSha,
		issued_at: 1_799_000_000,
		nonce: "1234567890abcdef1234567890abcdef",
		source: { run_id: "37189363285", run_attempt: 1, sha: coreSha },
		package: { artifact_id: "11297428920", archive_digest: archiveDigest },
		composition: { core_sha: coreSha, site_sha: siteSha },
		target: {
			team_id: "team_NsBZHGUVnyygP7veiROKLuUx",
			project: "kirari-main",
			project_id: "prj_QNMVdxTkPOad4ynN4fwFCYEST8Jk",
			environment: "production",
			domains: [targetDomain],
			canonical_origin: targetOrigin,
			current_deployment_id: currentDeploymentId,
			operation: "deploy",
		},
		rollback_record: null,
		...overrides,
	});
}

function makePackageManifest(runAttempt = "1") {
	return {
		schema_version: 1,
		package_format: "vercel-build-output-api-v3",
		// The target remains the original P3 packaging descriptor.
		target: { platform: "vercel", project: "kirari-test", environment: "preview", deploy_mode: "prebuilt" },
		core: { kind: "git", repository: "https://github.com/markd3ng/KIRARI", requested_ref: "main", resolved_sha: coreSha },
		site: { kind: "git", repository: "https://github.com/markd3ng/KIRARI", requested_ref: "codex/p3-staging-source-sync", resolved_sha: siteSha, source_subdirectory: "site" },
		upstream_github_artifact: {
			id: "9988776655",
			name: `kirari-composition-37189363285-${runAttempt}`,
			run_id: "37189363285",
			run_attempt: runAttempt,
			digest: upstreamDigest,
		},
		output_digest: outputDigest,
	};
}

function packageVerification(manifest = makePackageManifest()) {
	return {
		result: "PASS",
		packageArchiveSha256: archiveDigest,
		manifest,
		outputDigest: manifest.output_digest,
		upstreamArtifact: {
			id: manifest.upstream_github_artifact.id,
			name: manifest.upstream_github_artifact.name,
			digest: manifest.upstream_github_artifact.digest,
		},
	};
}

function browserReport(overrides = {}) {
	return {
		result: "PASS",
		mode: "production",
		phase: "live",
		baseUrl: targetOrigin,
		canonicalOrigin: targetOrigin,
		indexable: true,
		canonicalDocuments: 2,
		robotsSitemapCount: 1,
		routes: 2,
		assets: { required: 1, loaded: 2 },
		expectedExternalCalls: 1,
		browserConsoleErrors: 0,
		pageErrors: 0,
		failedBrowserRequests: 0,
		badResponses: 0,
		unexpectedExternalCalls: 0,
		byteEquality: "PASS",
		artifactBytesVerified: true,
		byteOutputDigest,
		inventoryDigest,
		fileCount: 5,
		totalBytes: 1200,
		...overrides,
	};
}

function releaseRecordInputs({ approvalBinding = binding(), browser = browserReport(), deploymentId = nextDeploymentId, manifest } = {}) {
	manifest ??= makePackageManifest(String(approvalBinding.source.run_attempt));
	const authorization = approvalBinding;
	return {
		approvalBinding: authorization,
		bindingDigest: productionApprovalDigest(authorization),
		packageArtifact: { id: "11297428920", name: `kirari-site-package-37189363285-${authorization.source.run_attempt}`, digest: archiveDigest },
		packageVerification: packageVerification(manifest),
		deployment: {
			id: deploymentId,
			url: "kirari-main-production-abc123.vercel.app",
			projectId: "prj_QNMVdxTkPOad4ynN4fwFCYEST8Jk",
			target: "production",
			readyState: "READY",
		},
		aliasBindings: [{ domain: targetDomain, deployment_id: deploymentId }],
		browserReport: browser,
		workflow: {
			id: "8822334455",
			attempt: "1",
			workflow_sha: workflowSha,
			main_sha: workflowSha,
			path: PRODUCTION_WORKFLOW_PATH,
			actor: "markd3ng",
			triggering_actor: "markd3ng",
			created_at: "2026-10-04T08:00:00.000Z",
		},
	};
}

function expectCode(code, fn) {
	assert.throws(fn, (error) => error instanceof ProductionValidationError && error.code === code);
}

test("production policy derives canonical and robots expectations from immutable static output", () => {
	const root = temporaryDirectory();
	const staticRoot = join(root, ".vercel", "output", "static");
	try {
		staticFixture(staticRoot);
		const policy = deriveProductionIndexingPolicy({ staticRoot, canonicalOrigin: targetOrigin, domains: [targetDomain] });
		assert.deepEqual({
			canonicalOrigin: policy.canonicalOrigin,
			canonicalDocuments: policy.canonicalDocuments,
			robotsSitemapCount: policy.robotsSitemapCount,
			indexable: policy.indexable,
		}, {
			canonicalOrigin: targetOrigin,
			canonicalDocuments: 2,
			robotsSitemapCount: 1,
			indexable: true,
		});
	} finally { rmSync(root, { recursive: true, force: true }); }
});

test("production policy fails closed on target canonical mismatch, noindex metadata, robots block, or noindex output headers", () => {
	const root = temporaryDirectory();
	const staticRoot = join(root, ".vercel", "output", "static");
	try {
		staticFixture(staticRoot, { canonicalOrigin: "https://example.com" });
		expectCode("PRODUCTION_CANONICAL_TARGET_MISMATCH", () => deriveProductionIndexingPolicy({ staticRoot, canonicalOrigin: targetOrigin, domains: [targetDomain] }));
	} finally { rmSync(root, { recursive: true, force: true }); }

	for (const [code, options] of [
		["PRODUCTION_CANONICAL_ROUTE_MISMATCH", { page: `<html><head><link rel="canonical" href="${targetOrigin}/wrong/"></head><body><h1>Welcome</h1></body></html>` }],
		["PRODUCTION_NOINDEX_METADATA", { page: `<html><head><meta name="robots" content="noindex"><link rel="canonical" href="${targetOrigin}/"></head><body><h1>Welcome</h1></body></html>` }],
		["PRODUCTION_ROBOTS_DISALLOWS_INDEXING", { robots: `User-agent: *\nDisallow: /\nSitemap: ${targetOrigin}/sitemap-index.xml\n` }],
		["PRODUCTION_NOINDEX_HEADER_POLICY", { config: { version: 3, routes: [{ src: "/.*", headers: { "X-Robots-Tag": "noindex, nofollow" } }] } }],
	]) {
		const root = temporaryDirectory();
		const staticRoot = join(root, ".vercel", "output", "static");
		try {
			staticFixture(staticRoot, options);
			expectCode(code, () => deriveProductionIndexingPolicy({ staticRoot, canonicalOrigin: targetOrigin, domains: [targetDomain] }));
		} finally { rmSync(root, { recursive: true, force: true }); }
	}
});

test("production browser canonical must match the complete approved route URL", async () => {
	const route = { path: "/posts/welcome/", title: "Welcome" };
	const page = (href) => ({ locator: () => ({ getAttribute: async () => href }) });
	await assertCanonicalLink(page(`${targetOrigin}${route.path}`), route, targetOrigin);
	await assertCanonicalLink(page(`${targetOrigin}/posts/welcome`), route, targetOrigin);
	for (const href of [`${targetOrigin}/wrong/`, `${targetOrigin}${route.path}?other=1`, `${targetOrigin}${route.path}#other`, `https://user@${targetDomain}${route.path}`]) {
		await assert.rejects(assertCanonicalLink(page(href), route, targetOrigin), (error) => error instanceof ProductionValidationError && error.code === "PRODUCTION_BROWSER_CANONICAL_MISMATCH");
	}
});

test("production target snapshot, staged target and live aliases bind to the exact approved project state", () => {
	const approved = binding();
	const project = { id: approved.target.project_id, name: approved.target.project, accountId: approved.target.team_id };
	assertProductionTargetSnapshot({ binding: approved, project, domains: [targetDomain], currentDeployment: { id: currentDeploymentId, projectId: approved.target.project_id, target: "production", readyState: "READY" } });
	expectCode("PRODUCTION_DOMAIN_SNAPSHOT_MISMATCH", () => assertProductionTargetSnapshot({ binding: approved, project, domains: ["other.vercel.app"], currentDeployment: { id: currentDeploymentId, projectId: approved.target.project_id, target: "production", readyState: "READY" } }));

	const deployment = { id: nextDeploymentId, url: "kirari-main-production-abc123.vercel.app", projectId: approved.target.project_id, target: "production", readyState: "READY" };
	assertProductionDeployment({ baseUrl: `https://${deployment.url}`, binding: approved, deployment, aliasBindings: [{ domain: targetDomain, deployment_id: currentDeploymentId }], phase: "staged" });
	assertProductionDeployment({ baseUrl: targetOrigin, binding: approved, deployment, aliasBindings: [{ domain: targetDomain, deployment_id: nextDeploymentId }], phase: "live" });
	expectCode("PRODUCTION_ALIAS_DEPLOYMENT_MISMATCH", () => assertProductionDeployment({ baseUrl: targetOrigin, binding: approved, deployment, aliasBindings: [{ domain: targetDomain, deployment_id: currentDeploymentId }], phase: "live" }));
	expectCode("INVALID_PRODUCTION_BASE_URL", () => assertProductionDeployment({ baseUrl: "http://kirari-main.vercel.app", binding: approved, deployment, aliasBindings: [{ domain: targetDomain, deployment_id: nextDeploymentId }], phase: "live" }));
});

test("deployed static output is checked byte-for-byte and credentials stay on the exact origin", async () => {
	const root = temporaryDirectory();
	const staticRoot = join(root, ".vercel", "output", "static");
	try {
		staticFixture(staticRoot);
		const requests = [];
		const result = await verifyDeployedStaticOutput({
			staticRoot,
			baseUrl: targetOrigin,
			oidcToken: "test-sensitive-oidc-token",
			fetchImpl: async (url, options) => {
				requests.push({ url: url.href, headers: options.headers, redirect: options.redirect });
				let path = decodeURIComponent(url.pathname).slice(1);
				if (!path || path.endsWith("/")) path = join(path, "index.html");
				const bytes = readFileSync(join(staticRoot, path));
				return new Response(bytes, { status: 200 });
			},
		});
		assert.equal(result.byteEquality, "PASS");
		assert.equal(result.artifactBytesVerified, true);
		assert.equal(requests.length, result.fileCount);
		assert.ok(requests.every((request) => new URL(request.url).origin === targetOrigin && request.redirect === "manual"));
		assert.ok(requests.every((request) => request.headers["x-vercel-trusted-oidc-idp-token"] === "test-sensitive-oidc-token"));
		assert.equal(JSON.stringify(requests.map((request) => request.url)).includes("test-sensitive-oidc-token"), false);

		let fetches = 0;
		const redirectFetchUrls = [];
		await assert.rejects(verifyDeployedStaticOutput({
			staticRoot,
			baseUrl: targetOrigin,
			oidcToken: "test-sensitive-oidc-token",
			fetchImpl: async () => {
				fetches += 1;
				redirectFetchUrls.push(targetOrigin);
				return new Response(null, { status: 302, headers: { location: "https://attacker.example/collect" } });
			},
		}), (error) => error.code === "PRODUCTION_STATIC_FETCH_FAILED");
		assert.ok(fetches >= 1 && fetches <= 4);
		assert.ok(redirectFetchUrls.every((url) => new URL(url).origin === targetOrigin));
	} finally { rmSync(root, { recursive: true, force: true }); }
});

test("deployed byte verification fails closed when a Build Output redirect shadows a physical static file", async () => {
	const root = temporaryDirectory();
	const staticRoot = join(root, ".vercel", "output", "static");
	try {
		staticFixture(staticRoot);
		mkdirSync(join(staticRoot, "en-US"), { recursive: true });
		writeFileSync(join(staticRoot, "en-US", "index.html"), "<html><body>English tombstone bytes</body></html>");
		writeFileSync(join(root, ".vercel", "output", "config.json"), JSON.stringify({ version: 3, routes: [{ src: "^/en-US/$", dest: "/", status: 301 }] }));
		const fetched = [];
		await assert.rejects(verifyDeployedStaticOutput({
			staticRoot,
			baseUrl: targetOrigin,
			oidcToken: "test-sensitive-oidc-token",
			fetchImpl: async (url, options) => {
				fetched.push({ url: url.href, redirect: options.redirect });
				if (url.pathname === "/en-US/") return new Response(null, { status: 301, headers: { location: "/" } });
			let path = decodeURIComponent(url.pathname).slice(1);
				if (!path || path.endsWith("/")) path = join(path, "index.html");
				return new Response(readFileSync(join(staticRoot, path)), { status: 200 });
			},
		}), (error) => error.code === "PRODUCTION_STATIC_OUTPUT_MISMATCH");
		assert.ok(fetched.some(({ url }) => new URL(url).pathname === "/en-US/"));
		assert.ok(fetched.every(({ url, redirect }) => new URL(url).origin === targetOrigin && redirect === "manual"));
	} finally { rmSync(root, { recursive: true, force: true }); }
});

test("release record binds safe production evidence and retains the historical Preview package descriptor", () => {
	const inputs = releaseRecordInputs();
	inputs.packageVerification.manifest.secret = "must-not-appear-in-release-record";
	const record = createProductionReleaseRecord(inputs);
	assert.equal(record.result, "PASS");
	assert.equal(record.target.canonical_origin, targetOrigin);
	assert.equal(record.target.deployment_target, "production");
	assert.equal(record.package_artifact.id, "11297428920");
	assert.deepEqual(record.core, { kind: "git", repository: "https://github.com/markd3ng/KIRARI", requested_ref: "main", resolved_sha: coreSha });
	assert.deepEqual(record.site, { kind: "git", repository: "https://github.com/markd3ng/KIRARI", requested_ref: "codex/p3-staging-source-sync", resolved_sha: siteSha, source_subdirectory: "site" });
	assert.equal(record.site.resolved_sha, siteSha);
	assert.equal(record.browser.phase, "live");
	assert.equal(JSON.stringify(record).includes("must-not-appear-in-release-record"), false);
	assert.equal(assertProductionReleaseRecord(record), record);

	const invalidSameCommitPair = structuredClone(record);
	invalidSameCommitPair.core.resolved_sha = "invalid";
	invalidSameCommitPair.site.resolved_sha = "invalid";
	expectCode("PRODUCTION_RELEASE_COMPOSITION_INVALID", () => assertProductionReleaseRecord(invalidSameCommitPair));

	const failedBrowser = releaseRecordInputs({ browser: browserReport({ result: "FAIL" }) });
	expectCode("PRODUCTION_BROWSER_REPORT_NOT_PASS", () => createProductionReleaseRecord(failedBrowser));
	const stagedBrowser = releaseRecordInputs({ browser: browserReport({ phase: "staged", baseUrl: "https://kirari-main-production-abc123.vercel.app" }) });
	expectCode("BROWSER_TARGET_MISMATCH", () => createProductionReleaseRecord(stagedBrowser));
	const browserExtra = releaseRecordInputs({ browser: browserReport({ token: "must-not-be-recorded" }) });
	expectCode("PRODUCTION_BROWSER_REPORT_INVALID", () => createProductionReleaseRecord(browserExtra));
	const wrongDigest = releaseRecordInputs();
	wrongDigest.bindingDigest = `sha256:${"0".repeat(64)}`;
	expectCode("AUTHORIZATION_BINDING_DIGEST_MISMATCH", () => createProductionReleaseRecord(wrongDigest));

	const extraRecordData = structuredClone(record);
	extraRecordData.token = "not-allowlisted";
	expectCode("PRODUCTION_RELEASE_RECORD_INVALID", () => assertProductionReleaseRecord(extraRecordData));
	const unsafeDomain = structuredClone(record);
	unsafeDomain.target.domains[0] = "kirari_main.vercel.app";
	expectCode("PRODUCTION_RELEASE_TARGET_INVALID", () => assertProductionReleaseRecord(unsafeDomain));
	const wrongSiteRepository = releaseRecordInputs();
	wrongSiteRepository.packageVerification.manifest.site.repository = "https://github.com/attacker/other";
	expectCode("PACKAGE_COMPOSITION_MISMATCH", () => createProductionReleaseRecord(wrongSiteRepository));

	const rerunBinding = binding({ source: { run_id: "37189363285", run_attempt: 2, sha: coreSha } });
	const rerunManifest = makePackageManifest("2");
	const rerunRecord = createProductionReleaseRecord(releaseRecordInputs({ approvalBinding: rerunBinding, manifest: rerunManifest }));
	assert.equal(rerunRecord.source_run.attempt, "2");
	assert.equal(rerunRecord.package_artifact.name, "kirari-site-package-37189363285-2");
});
