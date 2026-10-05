import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAliasSnapshot, deriveProductionDomains } from "../p4-production/runtime-adapter.mjs";

const target = { project_id: "prj_site" };
test("production snapshot includes implicit aliases and excludes explicit Preview domains", () => {
	const aliases = normalizeAliasSnapshot([{ alias: "site.vercel.app", projectId: "prj_site", deploymentId: "dpl_current" }, { alias: "site-team.vercel.app", projectId: "prj_site", deployment: {id:"dpl_current"} }, {alias:"site-git-dev.vercel.app",projectId:"prj_site",deploymentId:"dpl_preview"}], target);
	assert.deepEqual(deriveProductionDomains([{name:"site.vercel.app"},{name:"dev.example.com",gitBranch:"dev"}], aliases,"dpl_current"), ["site-team.vercel.app","site.vercel.app"]);
});
test("unknown team/project aliases and unapproved redirects fail before writes", () => {
	assert.throws(() => normalizeAliasSnapshot([{alias:"site.vercel.app",projectId:"prj_other",deploymentId:"dpl_current"}],target));
	assert.throws(() => deriveProductionDomains([{name:"site.vercel.app",redirect:"evil.example"}],[],null));
});
