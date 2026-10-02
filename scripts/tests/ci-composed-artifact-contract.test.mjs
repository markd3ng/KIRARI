import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("manual composition CI pins both inputs and uploads only the composed artifact", () => {
	const workflow = readFileSync(join(repoRoot, ".github/workflows/ci.yml"), "utf8");
	const compositionJob = workflow.match(/^  composition:\n([\s\S]*?)(?=^  [\w-]+:\s*$|(?![\s\S]))/m)?.[1] ?? "";
	const dispatchInputs = workflow.match(/^  workflow_dispatch:\n([\s\S]*?)(?=^permissions:)/m)?.[1] ?? "";
	assert.ok(compositionJob, "workflow_dispatch composition job must exist");

	const permissions = workflow.match(/^permissions:\n((?: {2}[\w-]+:\s*\w+\n)+)/m)?.[1]?.trim();
	assert.equal(permissions, "contents: read", "workflow permissions must remain read-only");
	assert.match(workflow, /^  push:/m, "normal push CI trigger must remain");
	assert.match(workflow, /^  pull_request:\s*$/m, "normal pull request CI trigger must remain");
	assert.match(dispatchInputs, /^      core_ref:[\s\S]*?        default: main/m);
	assert.match(dispatchInputs, /^      site_repository:[\s\S]*?        default: markd3ng\/KIRARI/m);
	assert.match(dispatchInputs, /^      site_ref:[\s\S]*?        default: main/m);
	assert.match(dispatchInputs, /^      site_subdirectory:[\s\S]*?        default: packages\/site-profile/m);
	assert.match(compositionJob, /if: github\.event_name == 'workflow_dispatch'/);

	const coreCheckout = compositionJob.match(/- name: Checkout Core\n([\s\S]*?)(?=\n      - |$)/)?.[1] ?? "";
	const siteCheckout = compositionJob.match(/- name: Checkout Site\n([\s\S]*?)(?=\n      - |$)/)?.[1] ?? "";
	assert.match(coreCheckout, /uses: actions\/checkout@v4[\s\S]*?repository: \$\{\{ github\.repository \}\}[\s\S]*?ref: \$\{\{ inputs\.core_ref \}\}[\s\S]*?path: core[\s\S]*?fetch-depth: 0[\s\S]*?persist-credentials: false/);
	assert.match(siteCheckout, /uses: actions\/checkout@v4[\s\S]*?repository: \$\{\{ inputs\.site_repository \}\}[\s\S]*?ref: \$\{\{ inputs\.site_ref \}\}[\s\S]*?path: site[\s\S]*?fetch-depth: 0[\s\S]*?persist-credentials: false/);
	assert.match(compositionJob, /package_json_file: core\/package\.json/);
	assert.match(compositionJob, /node-version-file: core\/\.nvmrc/);
	assert.match(compositionJob, /cache-dependency-path: core\/pnpm-lock\.yaml/);
	const installIndex = compositionJob.indexOf("run: pnpm install --frozen-lockfile");
	const testsIndex = compositionJob.indexOf("run: pnpm composition:test");
	assert.ok(installIndex >= 0 && testsIndex > installIndex, "Core must install frozen before composition tests run");

	const buildStep = compositionJob.match(/- name: Compose selected revisions\n([\s\S]*?)(?=\n      - name: Upload composed artifact)/)?.[1] ?? "";
	assert.match(buildStep, /\.\/build\.sh --compose[\s\S]*?--core-ref "\$CORE_REF"[\s\S]*?--site "\$site_source"[\s\S]*?--site-ref "\$SITE_REF"[\s\S]*?--artifact-dir "\$artifact_dir"/);

	const uploadStep = compositionJob.match(/- name: Upload composed artifact\n([\s\S]*?)(?=\n      - |$)/)?.[1] ?? "";
	assert.match(uploadStep, /id: upload/);
	assert.match(uploadStep, /uses: actions\/upload-artifact@v4/);
	const uploadPaths = uploadStep.match(/path: \|\n((?: {12}.*\n)+)/)?.[1]?.trim().split("\n").map((path) => path.trim());
	assert.deepEqual(uploadPaths, [
		"${{ runner.temp }}/kirari-composed-artifact/dist",
		"${{ runner.temp }}/kirari-composed-artifact/provenance.json",
	]);
	assert.match(uploadStep, /if-no-files-found: error/);
	assert.match(uploadStep, /retention-days: 30/);
	assert.match(compositionJob, /steps\.upload\.outputs\.artifact-url/);
	assert.match(compositionJob, /steps\.upload\.outputs\.artifact-id/);
	assert.match(compositionJob, /steps\.upload\.outputs\.artifact-digest/);
	assert.match(compositionJob, /GITHUB_STEP_SUMMARY/);
	assert.doesNotMatch(compositionJob, /\$\{\{\s*secrets\./i, "composition must not receive secrets");
	assert.doesNotMatch(compositionJob, /^\s+contents:\s*write\b/m, "composition permissions must not allow writes");
	assert.doesNotMatch(compositionJob, /\b(?:deploy|indexnow|indexing|promotion)\b/i, "composition must not deploy or submit indexing");
});
