import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeAliasSnapshot, deriveProductionDomains } from "../p4-production/runtime-adapter.mjs";

const target = { project_id: "prj_site", team_id: "team_site", project: "site", domains: ["site.vercel.app"], canonical_origin: "https://site.vercel.app" };
test("only configured Production domains enter the Owner domain binding", () => {
	const configured = [{ name: "site.vercel.app", projectId: "prj_site" }, { name: "dev.example.com", gitBranch: "dev" }];
	assert.deepEqual(deriveProductionDomains(configured, target), ["site.vercel.app"]);
});
test("unknown project, configured domain drift and redirects fail before writes", () => {
	assert.throws(() => normalizeAliasSnapshot([{alias:"site.vercel.app",projectId:"prj_other",deploymentId:"dpl_current"}],target));
	assert.throws(() => deriveProductionDomains([{name:"site.vercel.app",redirect:"evil.example"}],target));
	assert.throws(() => deriveProductionDomains([{name:"site.vercel.app"},{name:"unexpected.example"}],target));
	assert.throws(() => deriveProductionDomains([{name:"site.vercel.app",projectId:"prj_other"}],target));
});
test("failed rollback metadata loading removes the runtime workspace", () => {
	const directory = mkdtempSync(join(tmpdir(), "kirari-runtime-failure-test-"));
	try {
		const script = `
			import assert from "node:assert/strict";
			import { createProductionRuntime } from ${JSON.stringify(new URL("../p4-production/runtime-adapter.mjs", import.meta.url).href)};
			let requests = 0;
			await assert.rejects(createProductionRuntime({
				binding: { repository: "owner/repo", target: { operation: "rollback" }, rollback_record: { run_id: "1" } },
				packageVerification: {}, env: { GH_TOKEN: "fixture-not-secret" },
				fetchImpl: async () => { requests++; throw new Error("fixture metadata unavailable"); },
			}), /fixture metadata unavailable/);
			assert.equal(requests, 1);
		`;
		const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
			env: { ...process.env, TMPDIR: directory, TMP: directory, TEMP: directory }, encoding: "utf8",
		});
		assert.equal(result.status, 0, result.stderr);
		assert.deepEqual(readdirSync(directory), []);
	} finally { rmSync(directory, { recursive: true, force: true }); }
});
