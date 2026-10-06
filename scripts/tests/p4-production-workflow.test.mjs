import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { test } from "node:test";

import { tmpdir } from "node:os";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const workflowSource = readFileSync(join(repoRoot, ".github/workflows/site-production.yml"), "utf8");
const ciWorkflowSource = readFileSync(join(repoRoot, ".github/workflows/ci.yml"), "utf8");
const trustedNode = '"${{ runner.tool_cache }}/node/22.12.0/x64/bin/node"';
const workflow = workflowSource.replaceAll(trustedNode, "node").replaceAll(/run: >-\n          /g, "run: ");
const ciWorkflow = ciWorkflowSource.replaceAll(trustedNode, "node").replaceAll(/run: >-\n          /g, "run: ");
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
	for (const step of ["Install and audit production browser validator", "Install browser runtime", "Install pinned Vercel CLI before credentials are mapped", "Audit full pinned CLI and evaluate separate concrete T1 acceptance", "Verify separate concrete C1 approval and sanitized credential evidence", "Recheck authorization and consume the exact immutable package"]) {
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
	const toolingInstall = fixtures.indexOf("node scripts/p4-production/tooling-install.mjs");
	const toolingAudit = fixtures.indexOf("node scripts/p4-production/tooling-gate.mjs");
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


test("concrete manifest admission is separate from raw audit and rechecked before Production writes", () => {
	const gate = readFileSync(join(repoRoot, "scripts/p4-production/tooling-gate.mjs"), "utf8");
	assert.match(gate, /TOOLING_RAW_AUDIT_RESULT: result.rawAuditResult/);
	assert.match(gate, /TOOLING_P4_ACCEPTANCE_RESULT: result.p4AcceptanceResult/);
	assert.match(gate, /collectFullToolingAudit/);
	assert.match(workflow, /node scripts\/p4-production\/credential-gate.mjs/);
	assert.match(runtime, /await assertConcreteProductionContracts\(\)/);
	const adapter = readFileSync(join(repoRoot, "scripts/p4-production/runtime-adapter.mjs"), "utf8");
	assert.match(adapter, /await assertConcreteProductionContracts\(\{ env, fetchImpl \}\)/);
	assert.doesNotMatch(gate, /--omit|ignoreAdvisories|ignoredAdvisories|--audit-level.*(?:critical|high)/);
});


test("later Production commands use the setup-node absolute executable despite a poisoned PATH", () => {
	const production = workflowSource.split("  production:")[1];
	const fixtures = ciWorkflowSource.split("  production-fixtures:")[1].split("  composition:")[0];
	assert.doesNotMatch(production, /run: node /);
	assert.doesNotMatch(fixtures, /run: node /);
	for (const file of ["tooling-install", "tooling-gate", "credential-gate", "preflight", "run"]) {
		assert.ok(production.includes(`run: >-\n          ${trustedNode} scripts/p4-production/${file}.mjs`));
	}
	assert.match(production, /issues: read/);
	assert.match(fixtures, /issues: read/);
});


test("installer-supplied shell preload cannot execute before the credential-bearing runtime", () => {
	const production = workflowSource.split("  production:")[1];
	for (const block of production.split(/^      - /m).filter(x => /^\s+run:/m.test(x))) {
		for (const key of ["BASH_ENV", "ENV"]) assert.match(block, new RegExp(`^          ${key}: /dev/null$`, "m"));
		for (const key of ["NODE_OPTIONS", "NODE_PATH", "LD_PRELOAD", "LD_LIBRARY_PATH"]) assert.match(block, new RegExp(`^          ${key}: ''$`, "m"));
	}
	const root = mkdtempSync(join(tmpdir(), "kirari-shell-preload-"));
	try {
		const marker = join(root, "preload-ran");
		const loader = join(root, "loader.sh");
		writeFileSync(loader, `echo ran > "${marker}"\n`);
		const inherited = { ...process.env, BASH_ENV: loader };
		assert.equal(spawnSync("/bin/bash", ["--noprofile", "--norc", "-c", ":"], { env: inherited }).status, 0);
		assert.equal(existsSync(marker), true, "demonstrate the inherited shell startup vector");
		rmSync(marker);
		const operation = stepBlock(production, "Stage, validate and explicitly promote approved Production output");
		const overrides = Object.fromEntries([...operation.matchAll(/^          (BASH_ENV|ENV|NODE_OPTIONS|NODE_PATH|LD_PRELOAD|LD_LIBRARY_PATH): (.*)$/gm)].map(([, k, v]) => [k, v === "''" ? "" : v]));
		assert.equal(spawnSync("/bin/bash", ["--noprofile", "--norc", "-c", ":"], { env: { ...inherited, ...overrides } }).status, 0);
		assert.equal(existsSync(marker), false);
	} finally { rmSync(root, { recursive: true, force: true }); }
});


test("both amended workflows parse as YAML with executable absolute Node commands", () => {
	const siteRequire = createRequire(new URL("../../apps/site/package.json", import.meta.url));
	const YAML = createRequire(siteRequire.resolve("astro/package.json"))("yaml");
	const production = YAML.parse(workflowSource).jobs.production;
	const fixtures = YAML.parse(ciWorkflowSource).jobs["production-fixtures"];
	for (const job of [production, fixtures]) {
		assert.equal(job.permissions.issues, "read");
		for (const step of job.steps.filter(x => x.run?.includes("scripts/p4-production/"))) {
			assert.ok(step.run.startsWith(trustedNode + " scripts/p4-production/"));
			assert.equal(step.env.BASH_ENV, "/dev/null");
		}
	}
});
