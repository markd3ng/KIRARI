import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const workflow = readFileSync(join(repoRoot, ".github/workflows/ci.yml"), "utf8");
const triggers = workflow.match(/^on:\n([\s\S]*?)^permissions:/m)?.[1] ?? "";
const dispatchInputs = workflow.match(/^  workflow_dispatch:\n([\s\S]*?)^permissions:/m)?.[1] ?? "";
const verifyJob = workflow.match(/^  verify:\n([\s\S]*?)(?=^  [a-zA-Z0-9_-]+:|$(?![\s\S]))/m)?.[1] ?? "";
const verifyCheckout = verifyJob.match(/^      - uses: actions\/checkout@v4\n([\s\S]*?)(?=^      - |$(?![\s\S]))/m)?.[1] ?? "";
const rootAuditJob = workflow.match(/^  root-audit:\n([\s\S]*?)(?=^  [a-zA-Z0-9_-]+:|$(?![\s\S]))/m)?.[1] ?? "";
const rootAuditCli = readFileSync(join(repoRoot, "scripts/root-audit/cli.mjs"), "utf8");
const compositionJob = workflow.match(/^  composition:\n([\s\S]*)$/m)?.[1] ?? "";

function step(name) {
	const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return compositionJob.match(new RegExp(`^      - name: ${escaped}\\n([\\s\\S]*?)(?=^      - |$(?![\\s\\S]))`, "m"))?.[1] ?? "";
}

test("normal deterministic CI remains intact and composition is limited to manual/config events", () => {
	assert.match(triggers, /^  push:\n    branches: \[main, dev, config\]\n    tags: \["v\*"\]$/m);
	assert.match(triggers, /^  pull_request:\s*$/m, "verify must continue to run for all pull requests");
	assert.match(triggers, /^  workflow_dispatch:/m, "manual composition must remain available");
	assert.match(dispatchInputs, /^      core_ref:[\s\S]*?        default: main/m);
	assert.match(dispatchInputs, /^      site_repository:[\s\S]*?        default: markd3ng\/KIRARI/m);
	assert.match(dispatchInputs, /^      site_ref:[\s\S]*?        default: config/m);
	assert.match(dispatchInputs, /^      site_subdirectory:[\s\S]*?        default: site/m);
	assert.ok(verifyJob, "regular deterministic verify job must remain");
	assert.match(verifyCheckout, /fetch-depth: 0[\s\S]*?persist-credentials: false/, "verify checkout must retain full history without persisting credentials");
	assert.doesNotMatch(verifyJob, /^\s+if:/m, "verify must not be event-gated");
	for (const command of ["pnpm install --frozen-lockfile", "pnpm site:test", "pnpm edge:test", "pnpm build", "pnpm release:check"]) {
		assert.ok(verifyJob.includes(command), `verify job must retain ${command}`);
	}
	assert.doesNotMatch(verifyJob, /pnpm audit/, "the complete root audit runs in its own evidence-retaining job");
	const nodeTests = verifyJob.match(/^      - run: node --test (.+)$/m)?.[1]?.split(/\s+/) ?? [];
	for (const file of [
		"scripts/tests/ci-profile-contract.test.mjs",
		"scripts/tests/ci-composed-artifact-contract.test.mjs",
		"scripts/tests/root-audit-source-integrity.test.mjs",
		"scripts/tests/root-audit-evaluator.test.mjs",
		"scripts/tests/root-audit-prepare.test.mjs",
		"scripts/tests/composed-build.test.mjs",
		"scripts/tests/ocr-review-workflow-contract.test.mjs",
		"scripts/tests/p3-browser-contract.test.mjs",
		"scripts/tests/p3-browser-oidc.test.mjs",
		"scripts/tests/p3-staging-workflow-contract.test.mjs",
		"scripts/tests/vercel-preview-deployment.test.mjs",
	]) assert.ok(nodeTests.includes(file), `verify must run ${file}`);
	assert.match(compositionJob, /^    if: >-\n([\s\S]*?)^    runs-on:/m);
	const condition = compositionJob.match(/^    if: >-\n([\s\S]*?)^    runs-on:/m)?.[1]?.replaceAll(/\s+/g, " ").trim();
	assert.equal(condition, "github.event_name == 'workflow_dispatch' || (github.event_name == 'push' && github.ref == 'refs/heads/config') || (github.event_name == 'pull_request' && github.base_ref == 'config')");
});

test("root audit binds the exact PR head, saves raw output and exit status, and receives no token", () => {
	assert.ok(rootAuditJob, "a dedicated root audit job must run");
	assert.match(rootAuditJob, /uses: actions\/checkout@11bd71901bbe5b1630ceea73d27597364c9af683[\s\S]*?repository: \$\{\{ github\.event\.pull_request\.head\.repo\.full_name \|\| github\.repository \}\}[\s\S]*?ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}[\s\S]*?persist-credentials: false/);
	assert.match(rootAuditJob, /pnpm --config\.ignore-pnpmfile=true audit --json --audit-level moderate > "\$RUNNER_TEMP\/kirari-root-audit\/audit\.raw\.json" 2> "\$RUNNER_TEMP\/kirari-root-audit\/audit\.stderr"/);
	assert.match(rootAuditJob, /audit_exit_code=\$\?[\s\S]*?printf '%s\\n' "\$audit_exit_code" > "\$RUNNER_TEMP\/kirari-root-audit\/audit\.exit-code"/);
	assert.match(rootAuditJob, /name: Evaluate the exact raw audit[\s\S]*?if: always\(\) && steps\.checkout\.outcome == 'success' && steps\.source_integrity\.outcome == 'success'[\s\S]*?run: node scripts\/root-audit\/cli\.mjs/);
	assert.match(rootAuditJob, /name: Upload raw audit and policy evaluation evidence[\s\S]*?if: always\(\)[\s\S]*?uses: actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02[\s\S]*?path: \|\n[\s\S]*?kirari-root-audit\/audit\.raw\.json[\s\S]*?kirari-root-audit\/dependency-tree\.raw\.json/);
	assert.match(rootAuditJob, /retention-days: 30/);
	assert.match(rootAuditJob, /Prepare a temporary audit workspace without the existing #122 ignore[\s\S]*?run: node scripts\/root-audit\/prepare-unignored-audit\.mjs/);
	assert.match(rootAuditJob, /working-directory: \$\{\{ runner\.temp \}\}\/kirari-root-audit-unignored-project[\s\S]*?pnpm --config\.ignore-pnpmfile=true audit --json --audit-level moderate > "\$RUNNER_TEMP\/kirari-root-audit\/unignored\.audit\.raw\.json"/);
	assert.match(rootAuditJob, /unignored\.audit\.exit-code[\s\S]*?unignored\.audit\.executed/);
	const pnpmCommands = [...rootAuditJob.matchAll(/^\s+(pnpm .+)$/gm)].map((match) => match[1]);
	assert.equal(pnpmCommands.length, 4, "the evidence job must run exactly two audits, install, and dependency-tree capture");
	for (const command of pnpmCommands) assert.ok(command.includes("--config.ignore-pnpmfile=true"), `pnpm hooks must be disabled for: ${command}`);
	const setupPnpmVersion = rootAuditJob.match(/uses: pnpm\/action-setup@v4\n\s+with:\n\s+version: ([^\s]+)/)?.[1];
	const evaluatorPnpmVersion = rootAuditCli.match(/const pnpmVersion = "([^\"]+)"/)?.[1];
	assert.equal(setupPnpmVersion, "9.14.4", "the root audit job must pin the pnpm toolchain");
	assert.equal(evaluatorPnpmVersion, setupPnpmVersion, "candidate toolchain binding must match the workflow pin without invoking pnpm after integrity verification");
	assert.match(rootAuditJob, /name: Install the exact frozen lockfile[\s\S]*?pnpm --config\.ignore-pnpmfile=true install --frozen-lockfile --ignore-scripts --ignore-pnpmfile/);
	assert.match(rootAuditJob, /name: Capture all lock-resolved workspace dependency trees[\s\S]*?pnpm --config\.ignore-pnpmfile=true ls --recursive --depth Infinity --json/);
	assert.match(rootAuditJob, /name: Verify the checkout stayed at the exact Git tree before evaluation[\s\S]*?git ls-tree -r -z[\s\S]*?expected_mode[\s\S]*?entry_type[\s\S]*?100644[\s\S]*?100755[\s\S]*?Unsupported tracked Git entry type or mode/);
	for (const integrityCheck of ['-L "$parent"', '-L "./$source_path"', 'git cat-file blob "$EXPECTED_PR_HEAD_SHA:$source_path" | cmp -s - "./$source_path"', "git diff --name-only HEAD --", "git ls-files --others --exclude-standard"]) {
		assert.ok(rootAuditJob.includes(integrityCheck), `source integrity gate must include ${integrityCheck}`);
	}
	assert.ok(rootAuditJob.indexOf("- name: Capture all lock-resolved workspace dependency trees") < rootAuditJob.indexOf("- name: Verify the checkout stayed at the exact Git tree before evaluation"));
	assert.ok(rootAuditJob.indexOf("- name: Verify the checkout stayed at the exact Git tree before evaluation") < rootAuditJob.indexOf("- name: Evaluate the exact raw audit"));
	assert.match(rootAuditJob, /name: Evaluate the exact raw audit[\s\S]*?steps\.source_integrity\.outcome == 'success'/);
	assert.match(rootAuditJob, /DEPENDENCY_TREE_PATH: \$\{\{ runner\.temp \}\}\/kirari-root-audit\/dependency-tree\.raw\.json/);
	assert.match(rootAuditJob, /kirari-root-audit\/source-tree-integrity/);
	assert.doesNotMatch(rootAuditJob, /GITHUB_TOKEN|issues:\s*read|\$\{\{\s*secrets\./i, "the public comment reader must not receive a token or secret");
	assert.doesNotMatch(rootAuditJob, /^\s+contents:\s*write\b/m);
});

test("manual selectors and config events resolve exact Site and immutable Core revisions", () => {
	const workflowCheckout = step("Checkout workflow source");
	const selectSite = step("Select Site revision");
	const checkoutSite = step("Checkout Site");
	const validateSite = step("Validate Site boundary and resolve Core ref");
	const checkoutCore = step("Checkout Core");
	assert.ok(workflowCheckout && selectSite && checkoutSite && validateSite && checkoutCore, "composition must check out workflow source, select Site, validate its boundary, and check out both inputs");
	assert.match(workflowCheckout, /uses: actions\/checkout@11bd71901bbe5b1630ceea73d27597364c9af683[\s\S]*?ref: \$\{\{ github\.sha \}\}[\s\S]*?fetch-depth: 1[\s\S]*?persist-credentials: false/);
	assert.ok(compositionJob.indexOf("- name: Checkout workflow source") < compositionJob.indexOf("- name: Select Site revision"));

	assert.match(selectSite, /site_repository="\$MANUAL_SITE_REPOSITORY"[\s\S]*?site_ref="\$MANUAL_SITE_REF"[\s\S]*?site_subdirectory="\$MANUAL_SITE_SUBDIRECTORY"/);
	assert.match(selectSite, /site_repository="\$EVENT_REPOSITORY"[\s\S]*?site_ref="\$EVENT_SHA"[\s\S]*?site_subdirectory="site"/);
	assert.match(selectSite, /site_repository="\$PR_HEAD_REPOSITORY"[\s\S]*?site_ref="\$PR_HEAD_SHA"[\s\S]*?site_subdirectory="site"/);
	assert.match(selectSite, /PR_HEAD_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
	assert.match(selectSite, /PR_HEAD_REPOSITORY: \$\{\{ github\.event\.pull_request\.head\.repo\.full_name \}\}/);
	assert.match(selectSite, /EVENT_SHA: \$\{\{ github\.sha \}\}/);
	assert.match(selectSite, /! "\$site_ref" =~ \^\[a-f0-9\]\{40\}\$/);

	assert.match(checkoutSite, /uses: actions\/checkout@v4[\s\S]*?repository: \$\{\{ steps\.site_selection\.outputs\.repository \}\}[\s\S]*?ref: \$\{\{ steps\.site_selection\.outputs\.ref \}\}[\s\S]*?path: site[\s\S]*?submodules: recursive[\s\S]*?fetch-depth: 0[\s\S]*?persist-credentials: false/);
	assert.match(validateSite, /MANUAL_CORE_REF: \$\{\{ inputs\.core_ref \}\}/);
	assert.match(validateSite, /site_candidate="\$site_root"/);
	assert.match(validateSite, /case "\/\$SITE_SUBDIRECTORY\/" in[\s\S]*?\*\/\.\.\/\*/);
	assert.match(validateSite, /\[\[ -L "\$site_candidate" \]\]/);
	assert.match(validateSite, /site_source="\$\(realpath "\$site_candidate"\)"/);
	assert.match(validateSite, /"\$site_source" != "\$site_root" && "\$site_source" != "\$site_root\/"\*/);
	assert.match(validateSite, /gitlink_root="\$\{SITE_SUBDIRECTORY%\/\}"[\s\S]*?gitlink_root" == "\."[\s\S]*?gitlink_path="\.kirari\/core"/);
	assert.match(validateSite, /git -C "\$site_checkout" ls-tree HEAD -- "\$gitlink_path"/);
	assert.match(validateSite, /gitlink_mode" != "160000"[\s\S]*?gitlink_sha" =~ \^\[a-f0-9\]\{40\}\$/);
	assert.match(validateSite, /core_ref="\$gitlink_sha"/);

	assert.ok(compositionJob.indexOf("- name: Checkout workflow source") < compositionJob.indexOf("- name: Package verified Site output for Vercel Preview"));
	assert.ok(compositionJob.indexOf("- name: Checkout Site") < compositionJob.indexOf("- name: Validate Site boundary and resolve Core ref"));
	assert.ok(compositionJob.indexOf("- name: Validate Site boundary and resolve Core ref") < compositionJob.indexOf("- name: Checkout Core"));
	assert.match(checkoutCore, /uses: actions\/checkout@v4[\s\S]*?repository: \$\{\{ github\.repository \}\}[\s\S]*?ref: \$\{\{ steps\.site_contract\.outputs\.core_ref \}\}[\s\S]*?path: core[\s\S]*?fetch-depth: 0[\s\S]*?persist-credentials: false/);
});

test("composition uses the canonical builder, requires Contract v2 on config events, and uploads provenance", () => {
	const sourceDependencies = step("Install workflow source dependencies");
	const packageSite = step("Package verified Site output for Vercel Preview");
	const build = step("Compose selected revisions");
	const upload = step("Upload composed artifact");
	const summary = step("Add artifact details to summary");
	assert.ok(sourceDependencies && packageSite && build && upload && summary, "composition must install workflow source dependencies, package, build, upload, and summarize its artifact");
	assert.match(sourceDependencies, /run: pnpm install --frozen-lockfile --filter kirari/);
	assert.match(packageSite, /SOURCE_ARTIFACT_DIGEST: sha256:\$\{\{ steps\.upload\.outputs\.artifact-digest \}\}/);
	assert.ok(compositionJob.indexOf("- name: Install workflow source dependencies") < compositionJob.indexOf("- name: Package verified Site output for Vercel Preview"));
	assert.match(build, /working-directory: core/);
	assert.match(build, /CORE_REF: \$\{\{ steps\.site_contract\.outputs\.core_ref \}\}/);
	assert.match(build, /SITE_REF: \$\{\{ steps\.site_selection\.outputs\.ref \}\}/);
	assert.match(build, /SITE_SOURCE: \$\{\{ steps\.site_contract\.outputs\.source \}\}/);
	assert.match(build, /compose_args=\([\s\S]*?--core-ref "\$CORE_REF"[\s\S]*?--site "\$SITE_SOURCE"[\s\S]*?--site-ref "\$SITE_REF"[\s\S]*?--artifact-dir "\$artifact_dir"[\s\S]*?\)/);
	assert.match(compositionJob, /^    env:\n      ARTIFACT_NAME: kirari-composition-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}$/m);
	assert.match(build, /--artifact-id "\$ARTIFACT_NAME"/);
	assert.match(build, /if \[\[ "\$EVENT_NAME" != "workflow_dispatch" \]\]; then\n\s+compose_args\+\=\(--require-site-contract-v2\)/);
	assert.match(build, /\.\/build\.sh --compose "\$\{compose_args\[@\]\}"/);
	assert.match(compositionJob, /run: pnpm install --frozen-lockfile[\s\S]*?working-directory: core[\s\S]*?run: pnpm composition:test/);

	assert.match(upload, /id: upload/);
	assert.match(upload, /uses: actions\/upload-artifact@v4/);
	assert.match(upload, /name: \$\{\{ env\.ARTIFACT_NAME \}\}/);
	const uploadPaths = upload.match(/path: \|\n((?: {12}.*\n)+)/)?.[1]?.trim().split("\n").map((path) => path.trim());
	assert.deepEqual(uploadPaths, [
		"${{ runner.temp }}/kirari-composed-artifact/dist",
		"${{ runner.temp }}/kirari-composed-artifact/provenance.json",
	]);
	assert.match(upload, /if-no-files-found: error/);
	assert.match(upload, /retention-days: 30/);
	assert.match(summary, /steps\.upload\.outputs\.artifact-url/);
	assert.match(summary, /steps\.upload\.outputs\.artifact-id/);
	assert.match(summary, /steps\.upload\.outputs\.artifact-digest/);
	assert.match(summary, /Provenance\/upload name:[\s\S]*?GitHub artifact ID:/);
	assert.match(summary, /GITHUB_STEP_SUMMARY/);

	assert.match(workflow, /^permissions:\n  contents: read$/m);
	assert.match(checkoutSiteAndCore(), /persist-credentials: false/);
	assert.doesNotMatch(compositionJob, /\$\{\{\s*secrets\./i, "composition must not receive secrets");
	assert.doesNotMatch(compositionJob, /^\s+contents:\s*write\b/m, "composition permissions must not allow writes");
	assert.doesNotMatch(compositionJob, /\b(?:deploy|indexnow|indexing|promotion)\b/i, "composition must not deploy or submit indexing");
});

function checkoutSiteAndCore() {
	return `${step("Checkout Site")}\n${step("Checkout Core")}`;
}
