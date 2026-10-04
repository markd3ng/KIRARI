import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const staging = readFileSync(join(repoRoot, ".github/workflows/site-staging.yml"), "utf8");
const ci = readFileSync(join(repoRoot, ".github/workflows/ci.yml"), "utf8");
const browserPackage = JSON.parse(readFileSync(join(repoRoot, "scripts/p3-browser/package.json"), "utf8"));
const browserValidator = readFileSync(join(repoRoot, "scripts/p3-browser/validate.mjs"), "utf8");
const deployScript = readFileSync(join(repoRoot, "scripts/deploy-vercel-preview.mjs"), "utf8");
const sitePackageVerifier = readFileSync(join(repoRoot, "scripts/verify-site-package.mjs"), "utf8");
const stagingRecord = readFileSync(join(repoRoot, "scripts/p3-browser/create-staging-record.mjs"), "utf8");
const requestRouting = readFileSync(join(repoRoot, "scripts/p3-browser/request-routing.mjs"), "utf8");
const retiredBypassSecretName = ["VERCEL", "AUTOMATION", "BYPASS", "SECRET"].join("_");
const deployJobPermissions = /^    permissions:\n((?:      [^\n]+\n)+)/m.exec(staging)?.[1];
const browserValidationStep = staging.match(/^      - name: Validate deployed Preview in a real browser\n([\s\S]*?)(?=^      - name:|$)/m)?.[1] ?? "";
const p3ImplementationPaths = [
	".github/workflows/site-staging.yml",
	"scripts/deploy-vercel-preview.mjs",
	"scripts/verify-site-package.mjs",
	"scripts/p3-browser/validate.mjs",
	"scripts/p3-browser/github-oidc.mjs",
	"scripts/p3-browser/request-routing.mjs",
	"scripts/p3-browser/create-staging-record.mjs",
];

test("Site staging is manual, exact-artifact-only, Preview-only, and secret-isolated", () => {
	assert.match(staging, /^  workflow_dispatch:/m);
	assert.doesNotMatch(staging, /^  (?:push|pull_request|workflow_run):/m);
	assert.match(staging, /github\.actor == github\.repository_owner/);
	assert.match(staging, /github\.triggering_actor == github\.repository_owner/);
	assert.match(staging, /github\.run_attempt == 1/);
	assert.match(staging, /ref: \$\{\{ github\.sha \}\}/);
	assert.match(staging, /source_run_sha.*== "\$GITHUB_SHA"/);
	assert.match(staging, /GITHUB_ACTOR.*GITHUB_REPOSITORY_OWNER/);
	assert.match(staging, /GITHUB_TRIGGERING_ACTOR.*GITHUB_RUN_ATTEMPT/);
	assert.match(staging, /APPROVE KIRARI PREVIEW DEPLOYMENT TO kirari-test/);
	assert.match(staging, /environment:\n\s+name: Preview – kirari-test/);
	assert.deepEqual(
		[...((deployJobPermissions ?? "").matchAll(/^      ([^:]+): ([^\n]+)$/gm))].map(([, name, value]) => [name, value]),
		[["actions", "read"], ["contents", "read"], ["id-token", "write"]],
		"deploy-and-validate must grant only the required job permissions",
	);
	assert.match(staging, /VERCEL_TOKEN/);
	assert.match(staging, /vars\.VERCEL_ORG_ID/);
	assert.match(staging, /vars\.VERCEL_PROJECT_ID/);
	assert.doesNotMatch(staging, /(?:actions|contents|packages|deployments): write/);
	assert.match(staging, /persist-credentials: false/);
	assert.match(staging, /\.event == "workflow_dispatch"/);
	assert.match(staging, /\.head_branch == "main"/);
	assert.match(staging, /\.digest == \$digest/);
	assert.match(staging, /sha256sum .*site-package\.zip/);
	assert.match(staging, /any\(part in \("", "\.", "\.\."\) for part in parts\)/);
	assert.match(staging, /if path_name in seen/);
	assert.match(staging, /verify-site-package\.mjs/);
	assert.match(staging, /scripts\/deploy-vercel-preview\.mjs[\s\S]*--site-package/);
	assert.equal(browserPackage.devDependencies.vercel, undefined);
	assert.equal(browserPackage.devDependencies.playwright, "1.62.1");
	assert.doesNotMatch(staging, /--prod|vercel promote|vercel alias|workflow_run:/);
	assert.doesNotMatch(staging, new RegExp(retiredBypassSecretName));
	assert.doesNotMatch(browserValidator, new RegExp(retiredBypassSecretName));
	for (const file of p3ImplementationPaths) {
		assert.doesNotMatch(readFileSync(join(repoRoot, file), "utf8"), new RegExp(retiredBypassSecretName), `${file} must not retain the retired bypass dependency`);
	}
	assert.match(staging, /\.name == "kirari-test" and \.accountId == \$org/);
	assert.match(staging, /SOURCE_RUN_SHA: \$\{\{ steps\.source_run\.outputs\.source_run_sha \}\}/);
	assert.match(staging, /scripts\/verify-site-package\.mjs.*SOURCE_RUN_SHA/);
	assert.match(staging, /steps\.browser_validation\.outcome == 'success'/);
	assert.ok(browserValidationStep, "browser validation must be a dedicated step");
	assert.doesNotMatch(browserValidationStep, /VERCEL_TOKEN/);
	assert.doesNotMatch(staging, /secrets\.VERCEL_(?:ORG|PROJECT)_ID/);
	assert.match(staging, /uses: actions\/checkout@[a-f0-9]{40}/);
	assert.match(staging, /uses: actions\/setup-node@[a-f0-9]{40}/);
	assert.doesNotMatch(ci, /VERCEL_TOKEN/);
	assert.doesNotMatch(ci, new RegExp(retiredBypassSecretName));
	assert.match(ci, /scripts\/tests\/p3-browser-oidc\.test\.mjs/);
	assert.match(ci, /scripts\/tests\/composed-build\.test\.mjs/);
	assert.match(ci, /node "\$GITHUB_WORKSPACE\/scripts\/package-vercel-site\.mjs"/);
	assert.match(ci, /build-fixtures\.mjs/);
	assert.match(ci, /npm audit --prefix scripts\/p3-browser/);
	assert.match(ci, /^    if: github\.event_name != 'pull_request' \|\| github\.event\.pull_request\.head\.repo\.full_name == github\.repository$/m);
	assert.match(browserValidator, /requireNoindex\(response, route\.path\)/);
	assert.match(browserValidator, /requestGithubOidcToken\(\)/);
	assert.match(browserValidator, /VERCEL_TRUSTED_OIDC_TOKEN/);
	assert.doesNotMatch(browserValidator, /extraHTTPHeaders/);
	assert.match(requestRouting, /x-vercel-trusted-oidc-idp-token/);
	assert.match(requestRouting, /maxRedirects: 0/);
	assert.match(requestRouting, /const origin = new URL\(url\)\.origin/);
	assert.match(sitePackageVerifier, /provenance\.core\.resolved_sha !== sourceRunSha/);
	assert.match(stagingRecord, /"VERCEL_PROJECT_ID"/);
	assert.match(stagingRecord, /browser\.result !== "PASS"/);
	assert.match(deployScript, /"\/v2\/files"/);
	assert.match(deployScript, /"x-vercel-digest"/);
	assert.match(deployScript, /"\/v13\/deployments"/);
	assert.match(deployScript, /source: "cli", files \}/);
	assert.match(deployScript, /target !== null/);
	assert.doesNotMatch(deployScript, /target:\s*"production"|"--prod"|vercel promote|vercel alias/);
});
