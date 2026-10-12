import assert from "node:assert/strict";
import { test } from "node:test";
import {
	PRODUCTION_APPROVAL_MAX_AGE_SECONDS,
	PRODUCTION_AUTHORIZATION_ARTIFACT_PREFIX,
	assertAuthorizationClaimPresent,
	assertAuthorizationClaimUnused,
	assertProductionApproval,
	assertProductionDispatchContext,
	assertProductionSourceRun,
	assertProtectedProductionEnvironment,
	assertSourceShaIsMainAncestor,
	createProductionApprovalProposal,
	productionApprovalDigest,
	productionApprovalPhrase,
} from "../production-authorization.mjs";

const mainSha = "a".repeat(40);
const sourceSha = "b".repeat(40);

function binding(overrides = {}) {
	return {
		schema_version: 1,
		repository: "markd3ng/KIRARI",
		workflow_path: ".github/workflows/site-production.yml",
		workflow_sha: mainSha,
		main_sha: mainSha,
		issued_at: 1_800_000_000,
		nonce: "0123456789abcdef0123456789abcdef",
		source: { run_id: "37189363285", run_attempt: 1, sha: sourceSha },
		package: { artifact_id: "11297428920", archive_digest: `sha256:${"c".repeat(64)}` },
		composition: { core_sha: "d".repeat(40), site_sha: "e".repeat(40) },
		target: {
			team_id: "team_NsBZHGUVnyygP7veiROKLuUx",
			project: "kirari-main",
			project_id: "prj_QNMVdxTkPOad4ynN4fwFCYEST8Jk",
			environment: "production",
			domains: ["www.kirari.example", "kirari.example"],
			canonical_origin: "https://kirari.example",
			current_deployment_id: "dpl_abc123",
			operation: "deploy",
		},
		rollback_record: null,
		...overrides,
	};
}

function ownerRun(value = binding()) {
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
		repository: { full_name: value.repository },
		head_repository: { full_name: value.repository },
	};
}

function comparison(value = binding()) {
	return {
		status: "ahead",
		base_commit: { sha: value.source.sha },
		merge_base_commit: { sha: value.source.sha },
	};
}

test("approval phrase binds the complete production operation and canonical domain set", () => {
	const input = binding();
	const shuffled = binding({ target: { ...input.target, domains: [...input.target.domains].reverse() } });
	assert.equal(productionApprovalPhrase(input), productionApprovalPhrase(shuffled));
	assert.equal(productionApprovalDigest(input), productionApprovalDigest(shuffled));

	const changed = binding({ package: { ...input.package, archive_digest: `sha256:${"f".repeat(64)}` } });
	assert.notEqual(productionApprovalPhrase(input), productionApprovalPhrase(changed));
	assert.throws(() => assertProductionApproval(changed, productionApprovalPhrase(input), { nowSeconds: input.issued_at }), /does not match/);
	assert.match(productionApprovalPhrase(input), /^APPROVE KIRARI PRODUCTION DEPLOY TO kirari-main prj_[A-Za-z0-9]+ ARTIFACT 11297428920 sha256:[a-f0-9]{64} BINDING [a-f0-9]{64}$/);
});

test("local proposal produces a fresh nonce, exact phrase, digest, and short expiry", () => {
	const { issued_at: _issuedAt, nonce: _nonce, ...base } = binding();
	const proposed = createProductionApprovalProposal(base, { nowSeconds: 1_800_000_100, nonce: "f".repeat(32) });
	assert.equal(proposed.binding.issued_at, 1_800_000_100);
	assert.equal(proposed.binding.nonce, "f".repeat(32));
	assert.equal(proposed.phrase, productionApprovalPhrase(proposed.binding));
	assert.equal(proposed.digest, productionApprovalDigest(proposed.binding));
	assert.ok(proposed.artifact_name.startsWith(PRODUCTION_AUTHORIZATION_ARTIFACT_PREFIX));
	assert.equal(proposed.expires_at, 1_800_000_100 + PRODUCTION_APPROVAL_MAX_AGE_SECONDS);
});

test("approval requires an exact phrase within the issuance window", () => {
	const value = binding();
	const phrase = productionApprovalPhrase(value);
	assert.equal(assertProductionApproval(value, phrase, { nowSeconds: value.issued_at }).digest, productionApprovalDigest(value));
	assert.throws(() => assertProductionApproval(value, `${phrase} `, { nowSeconds: value.issued_at }), /does not match/);
	assert.throws(() => assertProductionApproval(value, phrase, { nowSeconds: value.issued_at + PRODUCTION_APPROVAL_MAX_AGE_SECONDS + 1 }), /expired/);
	assert.throws(() => assertProductionApproval(value, phrase, { nowSeconds: value.issued_at - 61 }), /future/);
});

test("production dispatch is owner-only, manual, current-main, and attempt one", () => {
	const value = binding();
	const context = {
		eventName: "workflow_dispatch",
		ref: "refs/heads/main",
		actor: "markd3ng",
		triggeringActor: "markd3ng",
		repositoryOwner: "markd3ng",
		repository: value.repository,
		workflowRef: `${value.repository}/${value.workflow_path}@refs/heads/main`,
		workflowSha: value.workflow_sha,
		sha: value.main_sha,
		runAttempt: "1",
		currentMainSha: value.main_sha,
	};
	assert.equal(assertProductionDispatchContext(context, value).main_sha, value.main_sha);
	for (const [key, invalid] of [
		["eventName", "push"],
		["ref", "refs/heads/preview"],
		["actor", "contributor"],
		["triggeringActor", "contributor"],
		["runAttempt", "2"],
		["workflowRef", "markd3ng/KIRARI/.github/workflows/other.yml@refs/heads/main"],
		["workflowSha", "f".repeat(40)],
		["currentMainSha", "9".repeat(40)],
	]) {
		assert.throws(() => assertProductionDispatchContext({ ...context, [key]: invalid }, value));
	}
});

test("source CI run must be successful, manual, main, exact, and owner-triggered", () => {
	const value = binding();
	assert.deepEqual(assertProductionSourceRun(ownerRun(value), value), { runId: value.source.run_id, runAttempt: 1, sha: sourceSha });
	for (const [key, invalid] of [
		["event", "push"],
		["head_branch", "feature"],
		["status", "in_progress"],
		["conclusion", "failure"],
		["path", ".github/workflows/other.yml"],
		["head_sha", "f".repeat(40)],
	]) {
		assert.throws(() => assertProductionSourceRun({ ...ownerRun(value), [key]: invalid }, value));
	}
	assert.throws(() => assertProductionSourceRun({ ...ownerRun(value), actor: { login: "contributor" } }, value), /repository owner/);
	assert.throws(() => assertProductionSourceRun({ ...ownerRun(value), triggering_actor: { login: "contributor" } }, value), /repository owner/);
});

test("old successful source commits must remain ancestors of exact current main", () => {
	const value = binding();
	assert.equal(assertSourceShaIsMainAncestor(comparison(value), sourceSha), true);
	assert.throws(() => assertSourceShaIsMainAncestor({ ...comparison(value), status: "diverged" }, sourceSha), /not an ancestor/);
	assert.throws(() => assertSourceShaIsMainAncestor({ ...comparison(value), merge_base_commit: { sha: "f".repeat(40) } }, sourceSha), /does not prove/);
});

test("production environment must require only the owner, explicitly disable bypass, and allow only the main branch", () => {
	const environment = {
		name: "kirari-site-production",
		can_admins_bypass: false,
		protection_rules: [{
			type: "required_reviewers",
			prevent_self_review: false,
			reviewers: [{ type: "User", reviewer: { login: "markd3ng" } }],
		}],
		deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
	};
	assert.deepEqual(assertProtectedProductionEnvironment(environment, { branch_policies: [{ id: 1, name: "main", type: "branch" }] }, { owner: "markd3ng" }), {
		name: "kirari-site-production",
		ownerReviewerConfigured: true,
		allowedBranches: ["main"],
	});
	assert.throws(() => assertProtectedProductionEnvironment({ ...environment, can_admins_bypass: undefined }, [], { owner: "markd3ng" }), /explicitly disable administrator bypass/);
	assert.throws(() => assertProtectedProductionEnvironment({ ...environment, protection_rules: [] }, [{ name: "main" }], { owner: "markd3ng" }), /exactly one required reviewer/);
	assert.throws(() => assertProtectedProductionEnvironment({ ...environment, protection_rules: [{ ...environment.protection_rules[0], reviewers: [{ type: "User", reviewer: { login: "someone-else" } }] }] }, [{ name: "main" }], { owner: "markd3ng" }), /sole User reviewer/);
	assert.throws(() => assertProtectedProductionEnvironment({ ...environment, protection_rules: [{ ...environment.protection_rules[0], reviewers: [...environment.protection_rules[0].reviewers, { type: "User", reviewer: { login: "someone-else" } }] }] }, [{ name: "main" }], { owner: "markd3ng" }), /exactly one required reviewer/);
	assert.throws(() => assertProtectedProductionEnvironment({ ...environment, protection_rules: [{ ...environment.protection_rules[0], reviewers: [{ type: "Team", reviewer: { login: "markd3ng" } }] }] }, [{ name: "main" }], { owner: "markd3ng" }), /sole User reviewer/);
	assert.throws(() => assertProtectedProductionEnvironment(environment, [{ name: "main" }, { name: "release/*" }], { owner: "markd3ng" }), /allow only main/);
	assert.throws(() => assertProtectedProductionEnvironment({ ...environment, can_admins_bypass: true }, [{ name: "main" }], { owner: "markd3ng" }), /explicitly disable administrator bypass/);
	assert.throws(() => assertProtectedProductionEnvironment(environment, [{ name: "main", type: "tag" }], { owner: "markd3ng" }), /target a branch, not a tag/);
	for (const prevent_self_review of [true, undefined]) {
		assert.throws(() => assertProtectedProductionEnvironment({ ...environment, protection_rules: [{ ...environment.protection_rules[0], prevent_self_review }] }, [{ name: "main", type: "branch" }], { owner: "markd3ng" }), /explicitly permit the sole owner dispatcher/);
	}
});

test("authorization claim prevents a second dispatch from using the same proposal", () => {
	const value = binding();
	const name = assertAuthorizationClaimUnused([], value);
	assert.equal(name, `${PRODUCTION_AUTHORIZATION_ARTIFACT_PREFIX}${productionApprovalDigest(value).slice(7)}`);
	assert.throws(() => assertAuthorizationClaimUnused([name], value), /already been consumed/);
	assert.equal(assertAuthorizationClaimPresent([name], value), name);
	assert.throws(() => assertAuthorizationClaimPresent([], value), /claim artifact is missing/);
});
