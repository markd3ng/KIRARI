import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { validateProfileSource } from "../../apps/site/scripts/profile-manifest.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("profile validation fails closed for missing and invalid required inputs", () => {
	const root = mkdtempSync(join(tmpdir(), "kirari-ci-profile-"));
	try {
		const profile = join(root, "profile");
		const site = join(root, "site");
		mkdirSync(profile);
		mkdirSync(site);

		assert.throws(() => validateProfileSource(profile, site), /Required Site input kirari\.config\.toml/);
		writeFileSync(join(profile, "kirari.config.toml"), "invalid = [");
		assert.throws(() => validateProfileSource(profile, site), /Invalid Site input kirari\.config\.toml/);

		const checker = readFileSync(join(repoRoot, "scripts/check-profile-materialization.mjs"), "utf8");
		assert.match(checker, /validateProfileSource\(profileRoot, siteRoot\)/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("CI materializes the profile before profile:check and requires site:test", () => {
	const workflow = readFileSync(join(repoRoot, ".github/workflows/ci.yml"), "utf8");
	const runSteps = workflow.match(/^\s+- run:.*$/gm) ?? [];
	const materializeIndex = runSteps.findIndex((step) => step.trim() === "- run: node apps/site/scripts/materialize-profile.mjs");
	const profileCheckIndex = runSteps.findIndex((step) => step.trim() === "- run: pnpm profile:check");

	assert.ok(materializeIndex >= 0 && materializeIndex < profileCheckIndex, "profile materialization must precede profile:check");
	assert.ok(runSteps.some((step) => step.trim() === "- run: pnpm site:test"), "site:test must be a required CI run step");
});
