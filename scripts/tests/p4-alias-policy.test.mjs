import test from "node:test";
import assert from "node:assert/strict";
import { assertProductionAliases, generatedProductionAliasNames } from "../p4-production/alias-policy.mjs";
import { assertProductionAliasSnapshot } from "../p4-production/rollback.mjs";
import { deriveProductionDomains } from "../p4-production/runtime-adapter.mjs";

const target = { project: "site", project_id: "prj_site", team_id: "team_site", domains: ["site.vercel.app"], canonical_origin: "https://site.vercel.app" };
const identity = { project: "site", project_id: "prj_site", team_id: "team_site", team_slug: "owner-projects" };
const alias = name => ({ alias: name, projectId: "prj_site", deploymentId: "dpl_current", redirect: null });
const snapshot = () => [alias("site.vercel.app"), ...generatedProductionAliasNames(target, identity).map(alias)];

test("generated project/team/main aliases remain separate from configured domains", () => {
	const aliases = snapshot();
	assert.deepEqual(assertProductionAliases(aliases, target, "dpl_current", identity), ["site-git-main-owner-projects.vercel.app", "site-owner-projects.vercel.app"]);
	assert.deepEqual(deriveProductionDomains([{ name: "site.vercel.app", projectId: "prj_site" }], target), ["site.vercel.app"]);
	assert.equal(assertProductionAliasSnapshot(aliases, target, "dpl_current", identity), true);
	const next = aliases.map(entry => ({ ...entry, deploymentId: "dpl_next" }));
	assert.equal(assertProductionAliasSnapshot(next, target, "dpl_next", identity), true);
	assert.throws(() => assertProductionAliasSnapshot(next, target, "dpl_current", identity));
});

for (const name of ["custom.example.com", "site-owner-projects.vercel.app.attacker.test", "site-owner-projects-vercel.app",
	"site-git-dev-owner-projects.vercel.app", "foreign-owner-projects.vercel.app", "site-other-team.vercel.app"]) {
	test(`unapproved Production alias rejects ${name}`, () => {
		assert.throws(() => assertProductionAliases([...snapshot(), alias(name)], target, "dpl_current", identity));
	});
}

for (const mutate of [
	entry => { entry.projectId = "prj_other"; },
	entry => { entry.teamId = "team_other"; },
	entry => { entry.deploymentId = "dpl_other"; },
	entry => { entry.redirect = "attacker.example"; },
]) test("generated alias ownership, deployment and redirect substitutions reject", () => {
	const entries = snapshot(); mutate(entries[1]);
	assert.throws(() => assertProductionAliases(entries, target, "dpl_current", identity));
});

test("duplicate aliases and an unapproved slug cannot establish provider identity", () => {
	assert.throws(() => assertProductionAliases([...snapshot(), snapshot()[1]], target, "dpl_current", identity));
	assert.throws(() => assertProductionAliases(snapshot(), target, "dpl_current"));
	for (const value of [{ ...identity, team_id: "team_other" }, { ...identity, project: "foreign" }, { ...identity, team_slug: "foo.vercel.app" }]) {
		assert.throws(() => assertProductionAliases(snapshot(), target, "dpl_current", value));
	}
});

test("unaffected Preview aliases never qualify as Production aliases", () => {
	const preview = { ...alias("site-git-dev-owner-projects.vercel.app"), deploymentId: "dpl_preview" };
	assert.deepEqual(assertProductionAliases([...snapshot(), preview], target, "dpl_current", identity), assertProductionAliases(snapshot(), target, "dpl_current", identity));
	for (const name of ["unapproved.example", "foreign-git-dev-owner-projects.vercel.app", "site-git-dev-foreign-team.vercel.app", "site-git-dev-owner-projects.vercel.app.attacker.test"]) {
		assert.throws(() => assertProductionAliases([...snapshot(), { ...preview, alias: name }], target, "dpl_current", identity));
	}
});

test("first release permits an empty alias snapshot but no unexpected current binding", () => {
	assert.equal(assertProductionAliasSnapshot([], target, null, identity), true);
	assert.throws(() => assertProductionAliases(snapshot(), target, null, identity));
	assert.throws(() => assertProductionAliases(snapshot(), target, "foreign", identity));
});
