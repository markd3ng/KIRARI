import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { coordinateProduction, writeOperationEvidence } from "../p4-production/run.mjs";

const d = (c) => `sha256:${c.repeat(64)}`;
function scenario(t, options = {}) {
	const root = mkdtempSync(join(tmpdir(), "kirari-p4-transaction-")); t.after(() => rmSync(root, { recursive: true, force: true }));
	const staticRoot = join(root, "static"); mkdirSync(staticRoot);
	writeFileSync(join(staticRoot, "index.html"), '<html><head><link rel="canonical" href="https://site.vercel.app/"></head><body>Site</body></html>');
	writeFileSync(join(staticRoot, "robots.txt"), 'User-agent: *\nAllow: /\nSitemap: https://site.vercel.app/sitemap-index.xml\n');
	writeFileSync(join(staticRoot, "sitemap-index.xml"), '<sitemapindex></sitemapindex>');
	const binding = { schema_version: 1, repository: "owner/repo", workflow_path: ".github/workflows/site-production.yml", workflow_sha: "c".repeat(40), main_sha: "c".repeat(40), issued_at: 1791072000, nonce: "a".repeat(32), source: { run_id: "10", run_attempt: 1, sha: "a".repeat(40) }, package: { artifact_id: "11", archive_digest: d("b") }, composition: { core_sha: "a".repeat(40), site_sha: "b".repeat(40) }, target: { team_id: "team_approved", project: "site", project_id: "prj_approved", environment: "production", domains: ["site.vercel.app"], canonical_origin: "https://site.vercel.app", current_deployment_id: "dpl_prior", operation: "deploy" }, rollback_record: null };
	const packageVerification = { result: "PASS", staticRoot, manifest: { core: { resolved_sha: binding.composition.core_sha }, site: { resolved_sha: binding.composition.site_sha } }, packageArtifact: { id: "11", name: "kirari-site-package-10-1", digest: d("b") } };
	const calls = []; let guards = 0;
	const deployment = { id: "dpl_new", projectId: "prj_approved", target: "production", readyState: "READY", url: "site-immutable.vercel.app" };
	const api = {
		snapshot: async () => ({ project: { id: options.wrongProject ? "prj_wrong" : "prj_approved", name: "site", accountId: "team_approved" }, domains: ["site.vercel.app"], currentDeployment: { ...deployment, id: options.rollback ? "dpl_new" : "dpl_prior" } }),
		stage: async () => { calls.push("stage-exact-prebuilt"); return deployment; },
		promote: async () => { calls.push("point-existing-production-traffic"); },
		aliases: async () => [{ domain: "site.vercel.app", deployment_id: "dpl_new" }],
		currentProductionId: async () => "dpl_new",
	};
	const guard = async () => { guards++; if (options.driftBeforePromotion && guards === 2) throw new Error("main changed; SECRET_RESPONSE_MUST_NOT_LEAK"); };
	const validateBrowser = async ({ phase }) => { calls.push(`validate-${phase}`); return { result: options.failPhase === phase ? "FAIL" : "PASS", phase, artifactBytesVerified: true }; };
	const createRecord = () => ({ result: "PASS", target: { deployment_id: "dpl_new" } });
	const restoreRollback = async () => { calls.push("restore-approved-existing-deployment"); return { result: options.recoveryFailed ? "INCOMPLETE" : "PASS", production_action: true, no_rebuild: true }; };
	let rollbackCandidate = null;
	if (options.recovery) {
		binding.rollback_record = { run_id: "20", run_attempt: 1, workflow_sha: "d".repeat(40), artifact_id: "21", archive_digest: d("c"), record_digest: d("d"), deployment_id: "dpl_prior" };
		rollbackCandidate = { approved: { record_digest: d("d") }, target: { deployment_id: "dpl_prior" } };
	}
	if (options.rollback) { binding.target.operation = "rollback"; binding.target.current_deployment_id = "dpl_new"; }
	return { root, calls, input: { binding, packageVerification, workflow: {}, api, guard, validateBrowser, createRecord, restoreRollback, rollbackCandidate } };
}

test("production stages, validates, rechecks authority, then promotes and validates live", async (t) => {
	const x = scenario(t); const result = await coordinateProduction(x.input);
	assert.equal(result.result, "PASS");
	assert.deepEqual(x.calls, ["stage-exact-prebuilt", "validate-staged", "point-existing-production-traffic", "validate-live"]);
});

test("target mismatch denies every production write", async (t) => {
	const x = scenario(t, { wrongProject: true }); const result = await coordinateProduction(x.input);
	assert.equal(result.result, "FAIL"); assert.deepEqual(x.calls, []);
});

for (const options of [{ failPhase: "staged" }, { driftBeforePromotion: true }]) test("pre-promotion failure leaves production aliases untouched", async (t) => {
	const x = scenario(t, options); const result = await coordinateProduction(x.input);
	assert.equal(result.result, "FAIL"); assert.equal(result.productionAliasChangeAttempted, false);
	assert.ok(!x.calls.includes("point-existing-production-traffic")); assert.ok(!x.calls.includes("restore-approved-existing-deployment"));
	assert.ok(!JSON.stringify(result).includes("SECRET_RESPONSE"));
});

test("failed live health recovers only the explicitly bound prior approved record", async (t) => {
	const x = scenario(t, { failPhase: "live", recovery: true }); const result = await coordinateProduction(x.input);
	assert.equal(result.result, "FAIL"); assert.equal(result.recovery.result, "PASS");
	assert.equal(x.calls.at(-1), "restore-approved-existing-deployment"); assert.equal(result.record, undefined);
});

test("failed live health without a known prior record stays failed", async (t) => {
	const x = scenario(t, { failPhase: "live" }); const result = await coordinateProduction(x.input);
	assert.equal(result.result, "FAIL"); assert.equal(result.recovery, null);
	assert.ok(!x.calls.includes("restore-approved-existing-deployment"));
});

test("failed recovery does not produce a successful release or rollback", async (t) => {
	const x = scenario(t, { failPhase: "live", recovery: true, recoveryFailed: true }); const result = await coordinateProduction(x.input);
	assert.equal(result.result, "FAIL"); assert.equal(result.recovery.result, "INCOMPLETE");
	writeOperationEvidence(join(x.root, "evidence"), result);
	assert.equal(existsSync(join(x.root, "evidence/production-record.json")), false);
	assert.equal(JSON.parse(readFileSync(join(x.root, "evidence/operation-result.json"))).result, "FAIL");
});

test("failed authorized rollback retains its post-write INCOMPLETE evidence", async (t) => {
	const x = scenario(t, { rollback: true, recovery: true, recoveryFailed: true });
	const result = await coordinateProduction(x.input);
	assert.equal(result.result, "FAIL");
	assert.equal(result.error_code, "PRODUCTION_ROLLBACK_VERIFICATION_INCOMPLETE");
	assert.equal(result.productionAliasChangeAttempted, true);
	assert.equal(result.rollback.result, "INCOMPLETE");
	assert.equal(result.recovery, null);
	assert.deepEqual(x.calls, ["restore-approved-existing-deployment"]);
	const directory = join(x.root, "evidence");
	writeOperationEvidence(directory, result);
	assert.equal(JSON.parse(readFileSync(join(directory, "operation-result.json"))).production_alias_change_attempted, true);
	assert.equal(JSON.parse(readFileSync(join(directory, "rollback-record.json"))).result, "INCOMPLETE");
	assert.equal(existsSync(join(directory, "production-record.json")), false);
});
