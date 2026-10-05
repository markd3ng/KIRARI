import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const workflow = readFileSync(join(repoRoot, ".github/workflows/site-production.yml"), "utf8");
const ciWorkflow = readFileSync(join(repoRoot, ".github/workflows/ci.yml"), "utf8");
const preflight = readFileSync(join(repoRoot, "scripts/p4-production/preflight.mjs"), "utf8");
const runtime = readFileSync(join(repoRoot, "scripts/p4-production/run.mjs"), "utf8");
const cli = readFileSync(join(repoRoot, "scripts/deploy-vercel-production.mjs"), "utf8");
const qaRegression = readFileSync(join(repoRoot, "apps/site/scripts/qa-regression-check.mjs"), "utf8");
const rootVercelConfig = JSON.parse(readFileSync(join(repoRoot, "vercel.json"), "utf8"));
const appLocalVercelPath = join(repoRoot, "apps/site/vercel.json");

test("Production workflow is manual, main-owner-only, no-rerun, and serialized", () => {
	assert.match(workflow, /^  workflow_dispatch:/m);
	assert.doesNotMatch(workflow, /^  (?:push|pull_request|workflow_run|schedule):/m);
	assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
	assert.match(workflow, /github\.actor == github\.repository_owner/);
	assert.match(workflow, /github\.triggering_actor == github\.repository_owner/);
	assert.match(workflow, /github\.run_attempt == 1/);
	assert.match(workflow, /group: kirari-site-production\n\s+cancel-in-progress: false/);
	assert.match(workflow, /approval_binding:[\s\S]*?owner_authorization:/);
	assert.match(workflow, /ref: \$\{\{ github\.sha \}\}/);
});

test("the no-secret preflight consumes one exact claim before the protected environment job", () => {
	const prepareBlock = workflow.match(/^  prepare:[\s\S]*?(?=^  production:)/m)?.[0] ?? "";
	const productionBlock = workflow.match(/^  production:[\s\S]*$/m)?.[0] ?? "";
	assert.ok(prepareBlock && productionBlock);
	assert.match(prepareBlock, /permissions:\n\s+actions: read\n\s+contents: read/);
	assert.doesNotMatch(prepareBlock, /id-token: write|VERCEL_TOKEN|secrets\.VERCEL|vars\.VERCEL/);
	assert.ok(prepareBlock.indexOf("node scripts/p4-production/preflight.mjs claim") < prepareBlock.indexOf("actions/upload-artifact@"));
	assert.ok(prepareBlock.indexOf("actions/upload-artifact@") < prepareBlock.indexOf("node scripts/p4-production/preflight.mjs prepare"));
	assert.match(prepareBlock, /name: \$\{\{ steps\.claim_prepare\.outputs\.claim_artifact_name \}\}/);
	assert.match(prepareBlock, /retention-days: 90/);
	assert.match(preparationActionPin(prepareBlock), /^actions\/upload-artifact@[a-f0-9]{40}$/);
	assert.match(productionBlock, /environment:\n\s+name: kirari-site-production/);
	assert.match(preproductionConsume(productionBlock), /node scripts\/p4-production\/preflight\.mjs consume/);
	assert.match(preflight, /assertProtectedProductionEnvironment/);
	assert.match(preflight, /assertAuthorizationClaimUnused/);
	assert.match(preflight, /assertAuthorizationClaimPresent/);
	assert.match(preflight, /verifySitePackageArchive/);
});

test("production credentials exist only on the final runtime step after browser setup and package revalidation", () => {
	const productionBlock = workflow.match(/^  production:[\s\S]*$/m)?.[0] ?? "";
	const runtimeStep = stepBlock(productionBlock, "Stage, validate and explicitly promote approved Production output");
	assert.ok(runtimeStep, "runtime operation must be a dedicated final step");
	assert.match(runtimeStep, /VERCEL_TOKEN: \$\{\{ secrets\.VERCEL_PRODUCTION_TOKEN \}\}/);
	assert.match(runtimeStep, /VERCEL_ORG_ID: \$\{\{ vars\.VERCEL_PRODUCTION_ORG_ID \}\}/);
	assert.match(runtimeStep, /VERCEL_PROJECT_ID: \$\{\{ vars\.VERCEL_PRODUCTION_PROJECT_ID \}\}/);
	assert.doesNotMatch(workflow, /secrets\.VERCEL_TOKEN\b|vars\.VERCEL_(?:ORG|PROJECT)_ID\b/);
	assert.match(runtimeStep, /PRODUCTION_BINDING: \$\{\{ steps\.consume\.outputs\.binding_path \}\}/);
	assert.match(runtimeStep, /PRODUCTION_PACKAGE_VERIFICATION: \$\{\{ steps\.consume\.outputs\.package_verification_path \}\}/);
	assert.match(runtimeStep, /PRODUCTION_EVIDENCE_DIR: \$\{\{ steps\.consume\.outputs\.evidence_dir \}\}/);
	assert.match(runtimeStep, /VERCEL_CLI_PATH:/);
	for (const step of ["Install and audit production browser validator", "Install browser runtime", "Install pinned Vercel CLI before credentials are mapped", "Recheck authorization and consume the exact immutable package"]) {
		const block = stepBlock(productionBlock, step);
		assert.ok(block, `missing step ${step}`);
		assert.doesNotMatch(block, /VERCEL_TOKEN|secrets\.VERCEL/);
		assert.ok(productionBlock.indexOf(block) < productionBlock.indexOf(runtimeStep));
	}
	assert.match(productionBlock, /id-token: write/);
	assert.doesNotMatch(preflight, /VERCEL_TOKEN|VERCEL_ORG_ID|VERCEL_PROJECT_ID/);
	assert.match(runtime, /process\.env\.VERCEL_ORG_ID === binding\.target\.team_id/);
	assert.match(runtime, /process\.env\.VERCEL_PROJECT_ID === binding\.target\.project_id/);
	assert.match(cli, /\["deploy", "--prebuilt", "--prod", "--skip-domain", "--yes", \.\.\./);
	assert.match(cli, /githubDeploymentMetadata\(target, artifact\)/);
});

test("only bounded 90-day evidence is retained as a named successful production release artifact", () => {
	assert.match(workflow, /if: always\(\) && steps\.consume\.outcome == 'success'/);
	assert.match(workflow, /name: kirari-p4-production-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/);
	assert.match(workflow, /path: \$\{\{ runner\.temp \}\}\/kirari-p4-evidence/);
	assert.match(workflow, /retention-days: 90/);
	assert.match(workflow, /node scripts\/p4-production\/run\.mjs/);
	assert.match(preflight, /retainArchiveDirectory: archiveDirectory/);
	assert.doesNotMatch(workflow, /contents: write|actions: write|deployments: write|workflow_run:/);
});

test("main Git deployment stays disabled and Production never edits settings or submits indexing", () => {
	assert.deepEqual(rootVercelConfig.git?.deploymentEnabled, { main: false });
	assert.equal(existsSync(appLocalVercelPath), false, "the app-local Vercel config must remain absent so the generated root config is authoritative");
	assert.match(ciWorkflow, /node apps\/site\/scripts\/generate-vercel-config\.mjs --check/);
	assert.match(ciWorkflow, /node apps\/site\/scripts\/qa-regression-check\.mjs/);
	assert.match(qaRegression, /deploymentEnabled\?\.main === false && Object\.keys\(deploymentEnabled\)\.length === 1/);
	assert.match(readFileSync(join(repoRoot, "scripts/release-regression-check.mjs"), "utf8"), /apps\/site\/vercel\.json/);
	assert.doesNotMatch(workflow, /generate-vercel-config|vercel\s+(?:project|settings)\s+(?:update|add|remove)|api\.indexnow\.org|indexing\.googleapis\.com|\bIndexNow\b|Google Indexing API/i);
});

test("CI runs audited local Production Chromium before the independent deployment-tool audit", () => {
	const fixtures = ciWorkflow.match(/^  production-fixtures:[\s\S]*?(?=^  \w)/m)?.[0] ?? "";
	assert.ok(fixtures, "Production fixture job must exist");
	const browserAudit = fixtures.indexOf("npm audit --prefix scripts/p3-browser --audit-level moderate");
	const browserTest = fixtures.indexOf("node --test scripts/tests/p4-production-browser-fixture.test.mjs");
	const toolingInstall = fixtures.indexOf("npm ci --prefix scripts/p4-production/tooling");
	const toolingAudit = fixtures.indexOf("npm audit --prefix scripts/p4-production/tooling --audit-level moderate");
	assert.ok(browserAudit >= 0 && browserAudit < browserTest, "audit browser dependencies before executing Chromium");
	assert.ok(browserTest < toolingInstall && toolingInstall < toolingAudit, "a deployment-tool failure must not skip local browser proof");
	assert.match(fixtures, /REQUIRE_PRODUCTION_BROWSER: 'true'/);
	assert.doesNotMatch(fixtures, /continue-on-error|--audit-level (?:high|critical)|secrets\.|id-token: write/);
});

function preparationActionPin(block) {
	const claim = stepBlock(block, "Consume this approval before the protected credential job");
	return /^\s+uses: ([^\n]+)$/m.exec(claim)?.[1] ?? "";
}

function preproductionConsume(block) {
	const index = block.indexOf("environment:");
	return index < 0 ? "" : block.slice(index);
}

function stepBlock(block, name) {
	const marker = `      - name: ${name}`;
	const start = block.indexOf(marker);
	if (start < 0) return "";
	const next = block.indexOf("\n      - name:", start + marker.length);
	return block.slice(start, next < 0 ? block.length : next);
}
