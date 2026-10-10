import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { productionApprovalPhrase, productionApprovalDigest, productionAuthorizationArtifactName } from "../production-authorization.mjs";
import { verifyProductionPreflight } from "../p4-production/preflight.mjs";

const repository = "markd3ng/KIRARI";
const nowSeconds = 1_800_000_100;
const nowMs = nowSeconds * 1000;
const mainSha = "a".repeat(40);
const sourceSha = "b".repeat(40);
const packageDigest = `sha256:${"c".repeat(64)}`;
const compositionDigest = `sha256:${"d".repeat(64)}`;

function binding(overrides = {}) {
	return {
		schema_version: 1,
		repository,
		workflow_path: ".github/workflows/site-production.yml",
		workflow_sha: mainSha,
		main_sha: mainSha,
		issued_at: nowSeconds,
		nonce: "0123456789abcdef0123456789abcdef",
		source: { run_id: "37189363285", run_attempt: 1, sha: sourceSha },
		package: { artifact_id: "11297428920", archive_digest: packageDigest },
		composition: { core_sha: sourceSha, site_sha: "e".repeat(40) },
		target: {
			team_id: "team_NsBZHGUVnyygP7veiROKLuUx",
			project: "kirari-main",
			project_id: "prj_QNMVdxTkPOad4ynN4fwFCYEST8Jk",
			environment: "production",
			domains: ["kirari.example", "www.kirari.example"],
			canonical_origin: "https://kirari.example",
			current_deployment_id: "dpl_previous123",
			operation: "deploy",
		},
		rollback_record: null,
		...overrides,
	};
}

function run(value = binding()) {
	return {
		id: Number(value.source.run_id),
		run_attempt: value.source.run_attempt,
		event: "workflow_dispatch",
		head_branch: "main",
		status: "completed",
		conclusion: "success",
		path: ".github/workflows/ci.yml",
		head_sha: value.source.sha,
		actor: { login: "markd3ng" },
		triggering_actor: { login: "markd3ng" },
		repository: { full_name: repository },
		head_repository: { full_name: repository },
	};
}

function packageVerification(value = binding()) {
	const upstream = {
		id: "11999999999",
		name: `kirari-composition-${value.source.run_id}-${value.source.run_attempt}`,
		run_id: value.source.run_id,
		run_attempt: String(value.source.run_attempt),
		digest: compositionDigest,
	};
	return {
		result: "PASS",
		source: { runId: value.source.run_id, runAttempt: String(value.source.run_attempt), headSha: value.source.sha },
		packageArtifact: { id: value.package.artifact_id, name: `kirari-site-package-${value.source.run_id}-${value.source.run_attempt}`, digest: value.package.archive_digest },
		upstreamArtifact: upstream,
		packageArchiveSha256: value.package.archive_digest,
		upstreamArchiveSha256: compositionDigest,
		manifest: {
			schema_version: 1,
			core: { resolved_sha: value.composition.core_sha },
			site: { resolved_sha: value.composition.site_sha },
			output_digest: `sha256:${"f".repeat(64)}`,
			upstream_github_artifact: upstream,
		},
		outputDigest: `sha256:${"f".repeat(64)}`,
	};
}

function sourceWorkflowRun(value = binding()) {
	return run(value);
}

function context(value = binding(), overrides = {}) {
	return {
		eventName: "workflow_dispatch",
		ref: "refs/heads/main",
		actor: "markd3ng",
		triggeringActor: "markd3ng",
		repositoryOwner: "markd3ng",
		repository,
		workflowRef: `${repository}/.github/workflows/site-production.yml@refs/heads/main`,
		workflowSha: value.workflow_sha,
		sha: value.main_sha,
		runAttempt: "1",
		runId: "37190000001",
		...overrides,
	};
}

function environment() {
	return {
		name: "kirari-site-production",
		can_admins_bypass: false,
		protection_rules: [{
			type: "required_reviewers",
			prevent_self_review: false,
			reviewers: [{ type: "User", reviewer: { login: "markd3ng" } }],
		}],
		deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
	};
}

function artifact({ id, name, digest, runId, sha }) {
	return {
		id: Number(id),
		name,
		digest,
		expired: false,
		expires_at: "2030-01-01T00:00:00Z",
		workflow_run: { id: Number(runId), head_sha: sha, head_branch: "main" },
	};
}

function makeFetch(overrides = {}) {
	const calls = [];
	const fetchImpl = async (input, init = {}) => {
		const url = new URL(input);
		calls.push({ url, init });
		assert.equal(init.method, "GET");
		assert.equal(init.redirect, "error");
		assert.equal(init.headers.Authorization, "Bearer github-test-token");
		const path = url.pathname;
		let data;
		if (path.endsWith("/branches/main")) data = { commit: { sha: mainSha } };
		else if (path.endsWith(`/actions/runs/${binding().source.run_id}/attempts/1`)) data = overrides.sourceRun ?? sourceWorkflowRun();
		else if (path.endsWith(`/compare/${sourceSha}...${mainSha}`)) data = overrides.comparison ?? { status: "ahead", base_commit: { sha: sourceSha }, merge_base_commit: { sha: sourceSha } };
		else if (path.endsWith("/environments/kirari-site-production")) data = overrides.environment ?? environment();
		else if (path.endsWith("/deployment-branch-policies")) data = overrides.branchPolicies ?? { branch_policies: [{ id: 1, name: "main" }] };
		else if (path.endsWith("/actions/artifacts")) data = overrides.claimListing ?? { total_count: 0, artifacts: [] };
		else if (path.endsWith("/actions/artifacts/11297428920")) data = overrides.packageArtifact ?? artifact({ id: "11297428920", name: `kirari-site-package-${binding().source.run_id}-1`, digest: packageDigest, runId: binding().source.run_id, sha: sourceSha });
		else if (path.endsWith("/actions/artifacts/11999999999")) data = overrides.upstreamArtifact ?? artifact({ id: "11999999999", name: `kirari-composition-${binding().source.run_id}-1`, digest: compositionDigest, runId: binding().source.run_id, sha: sourceSha });
		else throw new Error(`unexpected GitHub endpoint ${path}`);
		return { ok: true, status: 200, text: async () => JSON.stringify(data) };
	};
	return { fetchImpl, calls };
}

function makeClaimArchive(value, { actor = "markd3ng", triggeringActor = "markd3ng" } = {}) {
	const claim = {
		schema_version: 1,
		binding_digest: productionApprovalDigest(value),
		artifact_name: productionAuthorizationArtifactName(value),
		run_id: "37190000001",
		run_attempt: 1,
		actor,
		triggering_actor: triggeringActor,
		workflow_sha: value.workflow_sha,
		main_sha: value.main_sha,
		issued_at: value.issued_at,
	};
	const temp = mkdtempSync(join(tmpdir(), "kirari-p4-claim-test-"));
	const archivePath = join(temp, "claim.zip");
	execFileSync("python3", ["-c", "import sys,zipfile; z=zipfile.ZipFile(sys.argv[1],'w',compression=zipfile.ZIP_DEFLATED); z.writestr('authorization-claim.json',sys.argv[2]); z.close()", archivePath, JSON.stringify(claim)]);
	const bytes = execFileSync("python3", ["-c", "import sys;sys.stdout.buffer.write(open(sys.argv[1],'rb').read())", archivePath]);
	rmSync(temp, { recursive: true, force: true });
	return bytes;
}

function claimFetch(value, archiveBytes) {
	const artifactId = "99200000001";
	const artifactName = productionAuthorizationArtifactName(value);
	const digest = `sha256:${createHash("sha256").update(archiveBytes).digest("hex")}`;
	const record = {
		id: Number(artifactId),
		name: artifactName,
		digest,
		expired: false,
		expires_at: "2030-01-01T00:00:00Z",
		workflow_run: { id: 37190000001, head_sha: value.main_sha, head_branch: "main" },
		archive_download_url: `https://api.github.com/repos/${repository}/actions/artifacts/${artifactId}/zip`,
	};
	const metadata = makeFetch({ claimListing: { total_count: 1, artifacts: [record] } }).fetchImpl;
	const fetchImpl = async (input, init = {}) => {
		const url = new URL(input);
		if (url.hostname === "api.github.com" && url.pathname.endsWith(`/actions/artifacts/${artifactId}`)) return new Response(JSON.stringify(record));
		if (url.hostname === "api.github.com" && url.pathname.endsWith(`/actions/artifacts/${artifactId}/zip`)) return new Response(null, { status: 302, headers: { location: "https://downloads.example.test/claim.zip" } });
		if (url.hostname === "downloads.example.test") return new Response(archiveBytes, { headers: { "content-length": String(archiveBytes.length) } });
		return metadata(input, init);
	};
	return { fetchImpl, artifactId, digest };
}

async function verify({ value = binding(), overrides = {}, contextOverrides = {}, verification = packageVerification(value) } = {}) {
	const { fetchImpl, calls } = makeFetch(overrides);
	const result = await verifyProductionPreflight({
		binding: value,
		ownerAuthorization: productionApprovalPhrase(value),
		requireClaim: false,
		expectedCurrentRunId: "37190000001",
		packageVerification: verification,
		token: "github-test-token",
		repository,
		context: context(value, contextOverrides),
		fetchImpl,
		nowSeconds,
		nowMs,
		apiBaseUrl: "https://github.invalid",
	});
	return { result, calls };
}

test("no-secret preflight rechecks current main, exact source ancestry, protected environment, and package artifact APIs using GET only", async () => {
	const { result, calls } = await verify();
	assert.equal(result.currentMainSha, mainSha);
	assert.equal(result.claimArtifactName, `kirari-p4-authorization-${result.bindingDigest.slice(7)}`);
	assert.equal(result.packageVerification.result, "PASS");
	assert.deepEqual(calls.map(({ url }) => url.pathname), [
		"/repos/markd3ng/KIRARI/branches/main",
		`/repos/markd3ng/KIRARI/actions/runs/${binding().source.run_id}/attempts/1`,
		`/repos/markd3ng/KIRARI/compare/${sourceSha}...${mainSha}`,
		"/repos/markd3ng/KIRARI/environments/kirari-site-production",
		"/repos/markd3ng/KIRARI/environments/kirari-site-production/deployment-branch-policies",
		"/repos/markd3ng/KIRARI/actions/artifacts",
		"/repos/markd3ng/KIRARI/actions/artifacts/11297428920",
		"/repos/markd3ng/KIRARI/actions/artifacts/11999999999",
	]);
	assert.ok(calls.every(({ init }) => init.method === "GET"));
});

test("preflight rejects a changed main SHA before source, environment, or artifact reads", async () => {
	const { fetchImpl, calls } = makeFetch();
	const alteredContext = context(binding(), { sha: "f".repeat(40) });
	await assert.rejects(verifyProductionPreflight({
		binding: binding(), ownerAuthorization: productionApprovalPhrase(binding()), requireClaim: false,
		expectedCurrentRunId: alteredContext.runId, token: "github-test-token", repository,
		context: alteredContext, fetchImpl, nowSeconds, nowMs, apiBaseUrl: "https://github.invalid",
	}), /exact current main SHA/);
	assert.equal(calls.length, 1);
});

test("preflight fails closed when the protected environment is missing or its reviewer/branch rules drift", async (t) => {
	for (const [name, overrides] of [
		["missing owner reviewer", { environment: { ...environment(), protection_rules: [] } }],
		["additional reviewer", { environment: { ...environment(), protection_rules: [{ ...environment().protection_rules[0], reviewers: [...environment().protection_rules[0].reviewers, { type: "User", reviewer: { login: "someone-else" } }] }] } }],
		["sole owner cannot review own dispatch", { environment: { ...environment(), protection_rules: [{ ...environment().protection_rules[0], prevent_self_review: true }] } }],
		["unknown self-review protection", { environment: { ...environment(), protection_rules: [{ ...environment().protection_rules[0], prevent_self_review: undefined }] } }],
		["non-main branch policy", { branchPolicies: { branch_policies: [{ id: 1, name: "release" }] } }],
		["tag policy", { branchPolicies: { branch_policies: [{ id: 1, name: "main", type: "tag" }] } }],
		["unknown administrator bypass", { environment: { ...environment(), can_admins_bypass: undefined } }],
		["admin bypass", { environment: { ...environment(), can_admins_bypass: true } }],
	]) {
		await t.test(name, async () => {
			const { fetchImpl, calls } = makeFetch(overrides);
			await assert.rejects(verifyProductionPreflight({
				binding: binding(), ownerAuthorization: productionApprovalPhrase(binding()), requireClaim: false,
				expectedCurrentRunId: "37190000001", token: "github-test-token", repository,
				context: context(), fetchImpl, nowSeconds, nowMs, apiBaseUrl: "https://github.invalid",
			}));
			assert.equal(calls.some(({ url }) => url.pathname.endsWith("/actions/artifacts")), false);
		});
	}
});

test("preflight rejects a non-owner source run, an unproven ancestor, reused claims, and provenance substitution", async (t) => {
	await t.test("source run actor", async () => {
		const { fetchImpl } = makeFetch({ sourceRun: { ...sourceWorkflowRun(), triggering_actor: { login: "other" } } });
		await assert.rejects(verifyProductionPreflight({ binding: binding(), ownerAuthorization: productionApprovalPhrase(binding()), requireClaim: false, expectedCurrentRunId: "37190000001", token: "github-test-token", repository, context: context(), fetchImpl, nowSeconds, nowMs, apiBaseUrl: "https://github.invalid" }), /repository owner/);
	});
	await t.test("ancestry proof", async () => {
		const { fetchImpl } = makeFetch({ comparison: { status: "diverged", base_commit: { sha: sourceSha }, merge_base_commit: { sha: sourceSha } } });
		await assert.rejects(verifyProductionPreflight({ binding: binding(), ownerAuthorization: productionApprovalPhrase(binding()), requireClaim: false, expectedCurrentRunId: "37190000001", token: "github-test-token", repository, context: context(), fetchImpl, nowSeconds, nowMs, apiBaseUrl: "https://github.invalid" }), /not an ancestor/);
	});
	await t.test("reused claim", async () => {
		const value = binding();
		const claim = `kirari-p4-authorization-${productionApprovalDigest(value).slice(7)}`;
		const { fetchImpl: exactFetch } = makeFetch({ claimListing: { total_count: 1, artifacts: [{ name: claim }] } });
		await assert.rejects(verifyProductionPreflight({ binding: value, ownerAuthorization: productionApprovalPhrase(value), requireClaim: false, expectedCurrentRunId: "37190000001", token: "github-test-token", repository, context: context(), fetchImpl: exactFetch, nowSeconds, nowMs, apiBaseUrl: "https://github.invalid" }), /already been consumed/);
	});
	await t.test("package Core substitution", async () => {
		const value = binding();
		const verification = packageVerification(value);
		verification.manifest.core.resolved_sha = "f".repeat(40);
		const { fetchImpl } = makeFetch();
		await assert.rejects(verifyProductionPreflight({ binding: value, ownerAuthorization: productionApprovalPhrase(value), requireClaim: false, packageVerification: verification, expectedCurrentRunId: "37190000001", token: "github-test-token", repository, context: context(value), fetchImpl, nowSeconds, nowMs, apiBaseUrl: "https://github.invalid" }), /Core\/Site provenance/);
	});
});

test("claim consumer downloads the exact same-run archive and rejects a non-owner actor inside it", async (t) => {
	const value = binding();
	for (const [label, actor, expectedError] of [
		["exact claim", "markd3ng", null],
		["tampered claim actor", "attacker", /not owner-triggered/],
	]) {
		await t.test(label, async () => {
			const { fetchImpl, artifactId, digest } = claimFetch(value, makeClaimArchive(value, { actor }));
			const verifyClaim = verifyProductionPreflight({
				binding: value,
				ownerAuthorization: productionApprovalPhrase(value),
				requireClaim: true,
				expectedClaimArtifactId: artifactId,
				expectedClaimDigest: digest,
				expectedCurrentRunId: "37190000001",
				token: "github-test-token",
				repository,
				context: context(value),
				fetchImpl,
				nowSeconds,
				nowMs,
				apiBaseUrl: "https://github.invalid",
			});
			if (expectedError) {
				await assert.rejects(verifyClaim, expectedError);
				return;
			}
			const result = await verifyClaim;
			assert.equal(result.claimArtifact.id, artifactId);
			assert.equal(result.claimArtifact.digest, digest);
		});
	}
});
