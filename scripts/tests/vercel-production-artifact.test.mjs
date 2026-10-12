import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
	productionValidationDigest,
	githubDeploymentMetadata,
	promoteStagedProduction,
	runVercelStage,
	stagePrebuiltProduction,
	validateVercelDeploymentIdentity,
	validateVercelProjectIdentity,
	validateVercelTrustedSources,
	verifyDeploymentFileInventory,
} from "../deploy-vercel-production.mjs";
import { createSiteArtifactFetchMock, createSiteArtifactFixture } from "./helpers/site-artifact-fixture.mjs";
import { verifySitePackageArchive } from "../site-artifact.mjs";

const target = {
	project: "kirari-main",
	project_id: "prj_1234567890",
	team_id: "team_1234567890",
	environment: "production",
	domains: ["kirari-main.vercel.app"],
	repository: "markd3ng/KIRARI",
	workflow_path: ".github/workflows/site-production.yml",
};

function project(overrides = {}) {
	return {
		id: target.project_id,
		name: target.project,
		accountId: target.team_id,
		trustedSources: {
			enableVercelCiSameRepository: false,
			projects: {},
			externalSources: [{
				issuer: "https://token.actions.githubusercontent.com",
				claims: {
					aud: ["https://github.com/markd3ng"],
					repository: ["markd3ng/KIRARI"],
					ref: ["refs/heads/main"],
					workflow_ref: ["markd3ng/KIRARI/.github/workflows/site-production.yml@refs/heads/main"],
				},
				to: { slugs: ["production"] },
			}],
		},
		...overrides,
	};
}

test("Vercel project identity and trusted source require one exact main Production workflow", () => {
	assert.deepEqual(validateVercelProjectIdentity(project(), target), {
		project: target.project,
		projectId: target.project_id,
		teamId: target.team_id,
		trustedSource: "PASS",
	});
	assert.throws(() => validateVercelProjectIdentity(project({ accountId: "team_other" }), target), /project\/team identity/);
	assert.throws(() => validateVercelTrustedSources({ trustedSources: {} }, target), /Trusted Sources/);
});

test("Vercel Trusted Sources reject preview, wildcard, branch and workflow substitutions", () => {
	const cases = [
		(source) => { source.to.slugs = ["preview"]; },
		(source) => { source.claims.ref = ["*"]; },
		(source) => { source.claims.workflow_ref = ["markd3ng/KIRARI/.github/workflows/other.yml@refs/heads/main"]; },
		(source) => { source.claims.aud.push("https://github.com/other"); },
		(source) => { source.issuer = "https://attacker.example"; },
	];
	for (const mutate of cases) {
		const candidate = project();
		mutate(candidate.trustedSources.externalSources[0]);
		assert.throws(() => validateVercelTrustedSources(candidate, target));
	}
	const duplicated = project();
	duplicated.trustedSources.externalSources.push({ ...duplicated.trustedSources.externalSources[0] });
	assert.throws(() => validateVercelTrustedSources(duplicated, target), /exactly one/);
});

test("Vercel Trusted Sources reject additional project rules and unknown CI trust", () => {
	for (const projects of [undefined, null, "", { prj_other: {} }, { [target.project_id]: { from: "preview", to: "production" } }, ["prj_other"]]) {
		const candidate = project();
		candidate.trustedSources.projects = projects;
		assert.throws(() => validateVercelTrustedSources(candidate, target), /additional project rules/);
	}
	for (const enabled of [undefined, null, true, "false", 0]) {
		const candidate = project();
		candidate.trustedSources.enableVercelCiSameRepository = enabled;
		assert.throws(() => validateVercelTrustedSources(candidate, target), /CI trust must be explicitly disabled/);
	}
	const emptyList = project();
	emptyList.trustedSources.projects = [];
	assert.equal(validateVercelTrustedSources(emptyList, target), true);
});

test("Vercel Trusted Sources reject shadowed provider containers", () => {
	for (const field of ["external_sources", "oidcProviders", "oidc_providers"]) {
		const candidate = project();
		candidate.trustedSources[field] = { "https://attacker.example": {} };
		assert.throws(() => validateVercelTrustedSources(candidate, target), /ambiguous/);
	}
	const duplicated = project();
	duplicated.trusted_sources = structuredClone(duplicated.trustedSources);
	assert.throws(() => validateVercelTrustedSources(duplicated, target), /ambiguous/);
	const documentedContainer = project();
	const [source] = documentedContainer.trustedSources.externalSources;
	delete documentedContainer.trustedSources.externalSources;
	documentedContainer.trustedSources.oidcProviders = { [source.issuer]: [{ claims: source.claims, to: source.to }] };
	assert.equal(validateVercelTrustedSources(documentedContainer, target), true);
});

test("deployment identity requires the exact READY Production project, team and URL", () => {
	const deployment = { id: "dpl_AbCd1234", url: "kirari-main-abc123-markd3ngs-projects.vercel.app", projectId: target.project_id, ownerId: target.team_id, target: "production", readyState: "READY" };
	assert.equal(validateVercelDeploymentIdentity(deployment, target).url, `https://${deployment.url}`);
	for (const invalid of [
		{ ...deployment, target: null },
		{ ...deployment, projectId: "prj_other" },
		{ ...deployment, ownerId: "team_other" },
		{ ...deployment, readyState: "BUILDING" },
		{ ...deployment, url: "preview-other.vercel.app" },
		{ ...deployment, url: "https://kirari-main-abc123-markd3ngs-projects.vercel.app/path" },
	]) assert.throws(() => validateVercelDeploymentIdentity(invalid, target));
});

test("GitHub deployment metadata binds the approved main source SHA and repository", () => {
	const artifact = { source: { headSha: "a".repeat(40), ref: "refs/heads/main" } };
	const meta = githubDeploymentMetadata(target, artifact);
	assert.deepEqual(meta, {
		githubDeployment: "1",
		githubCommitRef: "main",
		githubCommitOrg: "markd3ng",
		githubCommitRepo: "KIRARI",
		githubCommitSha: artifact.source.headSha,
		githubOrg: "markd3ng",
		githubRepo: "KIRARI",
	});
	const deployment = { id: "dpl_AbCd1234", url: "kirari-main-abc123-markd3ngs-projects.vercel.app", projectId: target.project_id, ownerId: target.team_id, target: "production", readyState: "READY", meta };
	assert.equal(validateVercelDeploymentIdentity(deployment, target, { ...artifact, result: "PASS", outputDigest: "sha256:" + "a".repeat(64), manifest: { output_digest: "sha256:" + "a".repeat(64) } }).id, deployment.id);
	for (const [key, value] of [["githubCommitRef", "preview"], ["githubCommitSha", "b".repeat(40)], ["githubCommitRepo", "other"], ["githubDeployment", "0"]]) {
		assert.throws(() => validateVercelDeploymentIdentity({ ...deployment, meta: { ...meta, [key]: value } }, target, { ...artifact, result: "PASS", outputDigest: "sha256:" + "a".repeat(64), manifest: { output_digest: "sha256:" + "a".repeat(64) } }), /metadata/);
	}
	assert.throws(() => githubDeploymentMetadata(target, { source: { headSha: "a".repeat(40), ref: "refs/heads/feature" } }), /main branch/);
	assert.throws(() => githubDeploymentMetadata({ ...target, repository: "attacker/repo" }, artifact), /repository/);
});

test("remote file tree must match each expected Build Output path and file digest", () => {
	const html = Buffer.from("<main>immutable</main>");
	const config = Buffer.from('{"version":3,"routes":[]}');
	const digest = (bytes) => createHash("sha1").update(bytes).digest("hex");
	const expectedInventory = [
		{ file: ".vercel/output/config.json", sha: digest(config), size: config.length },
		{ file: ".vercel/output/static/index.html", sha: digest(html), size: html.length },
	];
	const tree = [
		{ name: ".vercel", type: "directory", children: [{ name: "output", type: "directory", children: [
			{ name: "config.json", type: "file", uid: digest(config) },
			{ name: "static", type: "directory", children: [{ name: "index.html", type: "file", uid: digest(html) }] },
		] }] },
	];
	assert.deepEqual(verifyDeploymentFileInventory({ deploymentFiles: tree, expectedInventory }), {
		fileCount: 2,
		inventorySha256: "sha256:" + createHash("sha256").update(JSON.stringify(expectedInventory.map(({ file, sha }) => ({ file, sha })).sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0))).digest("hex"),
		inventoryDigest: "sha256:" + createHash("sha256").update(JSON.stringify(expectedInventory.map(({ file, sha }) => ({ file, sha })).sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0))).digest("hex"),
	});
	const sourceWrappedTree = [{ name: "src", type: "directory", children: tree }];
	assert.deepEqual(verifyDeploymentFileInventory({ deploymentFiles: sourceWrappedTree, expectedInventory }), verifyDeploymentFileInventory({ deploymentFiles: tree, expectedInventory }));
	const wrapperWithExtraFile = [{ name: "src", type: "directory", children: [...tree, { name: "unexpected.txt", type: "file", uid: digest(Buffer.from("extra")) }] }];
	assert.throws(() => verifyDeploymentFileInventory({ deploymentFiles: wrapperWithExtraFile, expectedInventory }), /does not match/);
	assert.throws(() => verifyDeploymentFileInventory({ deploymentFiles: [{ name: "src", type: "directory", children: tree }, { name: "unexpected", type: "file", uid: digest(Buffer.from("extra")) }], expectedInventory }), /does not match/);
	assert.throws(() => verifyDeploymentFileInventory({ deploymentFiles: [{ name: "index.html", type: "symlink" }], expectedInventory }));
	assert.throws(() => verifyDeploymentFileInventory({ deploymentFiles: tree, expectedInventory: expectedInventory.slice(0, 1) }), /does not match/);
});

test("pre-promotion digest binds the complete staged-validation envelope", () => {
	const validation = {
		result: "PASS", phase: "staged", deploymentId: "dpl_AbCd1234", outputDigest: "sha256:" + "a".repeat(64),
		browser: { result: "PASS", phase: "staged", byteEquality: "PASS", artifactBytesVerified: true },
		remoteInventory: { inventoryDigest: "sha256:" + "b".repeat(64) },
	};
	const digest = productionValidationDigest(validation);
	assert.match(digest, /^sha256:[a-f0-9]{64}$/);
	assert.equal(productionValidationDigest({ ...validation, validationDigest: digest }), digest);
	assert.notEqual(productionValidationDigest({ ...validation, remoteInventory: { inventoryDigest: "sha256:" + "c".repeat(64) } }), digest);
});

test("Vercel CLI subprocess is isolated to its token and temporary project home", async () => {
	const fixture = createSiteArtifactFixture();
	try {
		const cliPath = join(fixture.root, "vercel-test-bin");
		writeFileSync(cliPath, "test CLI placeholder\n");
		const url = "https://kirari-main-a1b2-markd3ngs-projects.vercel.app";
		const artifact = { source: { headSha: "a".repeat(40), ref: "refs/heads/main" } };
		const result = await runVercelStage({
			packageRoot: fixture.packageRoot,
			expected: { project: target.project, projectId: target.project_id, teamId: target.team_id },
			target,
			artifact,
			vercelCliPath: cliPath,
			env: {
				PATH: process.env.PATH,
				HOME: "/runner/home",
				CI: "true",
				VERCEL_TOKEN: "test-vercel-token",
				VERCEL_ORG_ID: target.team_id,
				VERCEL_PROJECT_ID: target.project_id,
				GH_TOKEN: "must-not-be-forwarded",
				GITHUB_TOKEN: "must-not-be-forwarded",
				OWNER_AUTHORIZATION: "must-not-be-forwarded",
				PRODUCTION_APPROVAL_BINDING_JSON: "must-not-be-forwarded",
				ACTIONS_ID_TOKEN_REQUEST_TOKEN: "must-not-be-forwarded",
				ACTIONS_ID_TOKEN_REQUEST_URL: "must-not-be-forwarded",
				VERCEL_TRUSTED_OIDC_TOKEN: "must-not-be-forwarded",
			},
			spawn: (command, args, options) => {
				assert.equal(command, cliPath);
				assert.deepEqual(args, ["deploy", "--prebuilt", "--prod", "--skip-domain", "--yes", ...Object.entries(githubDeploymentMetadata(target, artifact)).flatMap(([key, value]) => ["--meta", `${key}=${value}`])]);
				assert.match(options.cwd, /kirari-vercel-production-stage-/);
				assert.equal(options.env.HOME, join(options.cwd, "home"));
				assert.equal(options.env.VERCEL_TOKEN, "test-vercel-token");
				assert.equal(options.env.VERCEL_TELEMETRY_DISABLED, "1");
				assert.equal(options.env.VERCEL_CLI_USE_NATIVE_BINARY, "0");
				assert.equal(options.env.NO_UPDATE_NOTIFIER, "1");
				for (const key of ["GH_TOKEN", "GITHUB_TOKEN", "OWNER_AUTHORIZATION", "PRODUCTION_APPROVAL_BINDING_JSON", "ACTIONS_ID_TOKEN_REQUEST_TOKEN", "ACTIONS_ID_TOKEN_REQUEST_URL", "VERCEL_TRUSTED_OIDC_TOKEN"]) assert.equal(options.env[key], undefined, `${key} must not be exposed to the CLI`);
				assert.equal(existsSync(join(options.cwd, ".vercel/output/config.json")), true);
				return { status: 0, signal: null, stdout: `${url}\n`, stderr: "" };
			},
		});
		assert.equal(result, url);
	} finally {
		fixture.cleanup();
	}
});

test("stages exact prebuilt output without domain assignment, then promotes only after bound validation", async () => {
	const fixture = createSiteArtifactFixture();
	try {
		const artifact = await verifySitePackageArchive({
			expected: fixture.expected,
			repository: "markd3ng/KIRARI",
			token: "test-github-token",
			fetchImpl: createSiteArtifactFetchMock(fixture),
			outputDirectory: join(fixture.root, "verified-package"),
		});
		const deploymentMeta = githubDeploymentMetadata(target, artifact);
		const deploymentId = "dpl_Immutable123";
		const deploymentHost = "kirari-main-a1b2-markd3ngs-projects.vercel.app";
		const requests = [];
		const apiFetch = async (input, options = {}) => {
			const url = new URL(input);
			requests.push({ method: options.method ?? "GET", path: url.pathname });
			if (url.pathname === `/v9/projects/${target.project_id}`) return jsonResponse(project());
			if (url.pathname === `/v13/deployments/${deploymentHost}` || url.pathname === `/v13/deployments/${deploymentId}`) {
				return jsonResponse({ id: deploymentId, url: deploymentHost, projectId: target.project_id, teamId: target.team_id, target: "production", readyState: "READY", aliasAssigned: false, meta: deploymentMeta });
			}
			if (url.pathname === `/v6/deployments/${deploymentId}/files`) return jsonResponse(inventoryTree(artifact.deploymentFiles));
			if (url.pathname === "/v4/aliases") return jsonResponse({ aliases: [], pagination: { next: null } });
			if (url.pathname === `/v10/projects/${target.project_id}/promote/${deploymentId}` && options.method === "POST") return jsonResponse({ job: { id: "promotion-job" } });
			return new Response("not found", { status: 404 });
		};
		const cliCalls = [];
		const staged = await stagePrebuiltProduction({
			packageRoot: artifact.outputDirectory,
			target,
			artifact,
			vercelCliPath: "/tmp/fake-vercel-cli",
			env: { VERCEL_TOKEN: "test-vercel-token" },
			token: "test-vercel-token",
			teamId: target.team_id,
			fetchImpl: apiFetch,
			spawn: async ({ args }) => {
				cliCalls.push(args);
				return `https://${deploymentHost}`;
			},
		});
		assert.equal(staged.result, "STAGED");
		assert.equal(staged.artifact.packageArchiveDigest, artifact.packageArchiveSha256);
		assert.equal(staged.remoteInventory.fileCount, artifact.deploymentFiles.length);
		assert.deepEqual(cliCalls, [["deploy", "--prebuilt", "--prod", "--skip-domain", "--yes", ...Object.entries(deploymentMeta).flatMap(([key, value]) => ["--meta", `${key}=${value}`])]]);
		assert.equal(requests.some(({ method }) => method !== "GET"), false, "staging must not write production aliases or promote");

		const validation = {
			result: "PASS",
			phase: "staged",
			deploymentId,
			outputDigest: artifact.outputDigest,
			browser: { result: "PASS", phase: "staged", baseUrl: `https://${deploymentHost}`, byteEquality: "PASS", artifactBytesVerified: true },
			remoteInventory: { inventoryDigest: staged.remoteInventory.inventoryDigest },
		};
		validation.validationDigest = productionValidationDigest(validation);
		const promoted = await promoteStagedProduction({ deploymentId, target, artifact, packageRoot: artifact.outputDirectory, prePromotionValidation: validation, token: "test-vercel-token", teamId: target.team_id, fetchImpl: apiFetch });
		assert.equal(promoted.result, "PROMOTION_REQUESTED");
		assert.deepEqual(requests.filter(({ method }) => method !== "GET"), [{ method: "POST", path: `/v10/projects/${target.project_id}/promote/${deploymentId}` }]);
	} finally {
		fixture.cleanup();
	}
});

function jsonResponse(value) {
	return new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
}

function inventoryTree(files) {
	const root = [];
	for (const file of files) {
		const segments = file.file.split("/");
		let nodes = root;
		for (const [index, name] of segments.entries()) {
			const isFile = index === segments.length - 1;
			let node = nodes.find((item) => item.name === name);
			if (!node) {
				node = isFile ? { name, type: "file", uid: file.sha } : { name, type: "directory", children: [] };
				nodes.push(node);
			}
			if (!isFile) nodes = node.children;
		}
	}
	return root;
}
