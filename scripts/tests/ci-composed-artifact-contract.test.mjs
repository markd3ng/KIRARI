import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const workflow = readFileSync(join(repoRoot, ".github/workflows/ci.yml"), "utf8");
const triggers = workflow.match(/^on:\n([\s\S]*?)^permissions:/m)?.[1] ?? "";
const dispatchInputs = workflow.match(/^  workflow_dispatch:\n([\s\S]*?)^permissions:/m)?.[1] ?? "";
const verifyJob = workflow.match(/^  verify:\n([\s\S]*?)(?=^  composition:)/m)?.[1] ?? "";
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
	assert.doesNotMatch(verifyJob, /^\s+if:/m, "verify must not be event-gated");
	for (const command of ["pnpm install --frozen-lockfile", "pnpm site:test", "pnpm edge:test", "pnpm build", "pnpm release:check", "pnpm audit --audit-level moderate"]) {
		assert.ok(verifyJob.includes(command), `verify job must retain ${command}`);
	}
	assert.match(verifyJob, /node --test scripts\/tests\/ci-profile-contract\.test\.mjs scripts\/tests\/ci-composed-artifact-contract\.test\.mjs scripts\/tests\/ocr-review-workflow-contract\.test\.mjs/);
	assert.match(compositionJob, /^    if: >-\n([\s\S]*?)^    runs-on:/m);
	const condition = compositionJob.match(/^    if: >-\n([\s\S]*?)^    runs-on:/m)?.[1]?.replaceAll(/\s+/g, " ").trim();
	assert.equal(condition, "github.event_name == 'workflow_dispatch' || (github.event_name == 'push' && github.ref == 'refs/heads/config') || (github.event_name == 'pull_request' && github.base_ref == 'config')");
});

test("manual selectors and config events resolve exact Site and immutable Core revisions", () => {
	const selectSite = step("Select Site revision");
	const checkoutSite = step("Checkout Site");
	const validateSite = step("Validate Site boundary and resolve Core ref");
	const checkoutCore = step("Checkout Core");
	assert.ok(selectSite && checkoutSite && validateSite && checkoutCore, "composition must select Site, validate its boundary, and check out both inputs");

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

	assert.ok(compositionJob.indexOf("- name: Checkout Site") < compositionJob.indexOf("- name: Validate Site boundary and resolve Core ref"));
	assert.ok(compositionJob.indexOf("- name: Validate Site boundary and resolve Core ref") < compositionJob.indexOf("- name: Checkout Core"));
	assert.match(checkoutCore, /uses: actions\/checkout@v4[\s\S]*?repository: \$\{\{ github\.repository \}\}[\s\S]*?ref: \$\{\{ steps\.site_contract\.outputs\.core_ref \}\}[\s\S]*?path: core[\s\S]*?fetch-depth: 0[\s\S]*?persist-credentials: false/);
});

test("composition uses the canonical builder, requires Contract v2 on config events, and uploads provenance", () => {
	const build = step("Compose selected revisions");
	const upload = step("Upload composed artifact");
	const summary = step("Add artifact details to summary");
	assert.ok(build && upload && summary, "composition must build, upload, and summarize its artifact");
	assert.match(build, /working-directory: core/);
	assert.match(build, /CORE_REF: \$\{\{ steps\.site_contract\.outputs\.core_ref \}\}/);
	assert.match(build, /SITE_REF: \$\{\{ steps\.site_selection\.outputs\.ref \}\}/);
	assert.match(build, /SITE_SOURCE: \$\{\{ steps\.site_contract\.outputs\.source \}\}/);
	assert.match(build, /compose_args=\([\s\S]*?--core-ref "\$CORE_REF"[\s\S]*?--site "\$SITE_SOURCE"[\s\S]*?--site-ref "\$SITE_REF"[\s\S]*?--artifact-dir "\$artifact_dir"[\s\S]*?\)/);
	assert.match(build, /if \[\[ "\$EVENT_NAME" != "workflow_dispatch" \]\]; then\n\s+compose_args\+\=\(--require-site-contract-v2\)/);
	assert.match(build, /\.\/build\.sh --compose "\$\{compose_args\[@\]\}"/);
	assert.match(compositionJob, /run: pnpm install --frozen-lockfile[\s\S]*?working-directory: core[\s\S]*?run: pnpm composition:test/);

	assert.match(upload, /id: upload/);
	assert.match(upload, /uses: actions\/upload-artifact@v4/);
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
