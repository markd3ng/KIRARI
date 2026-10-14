import test from "node:test";
import assert from "node:assert/strict";
import { normalizeVercelTrustedSources } from "../p4-production/trusted-sources.mjs";
import { validateVercelTrustedSources } from "../deploy-vercel-production.mjs";

const issuer = "https://token.actions.githubusercontent.com";
const rule = () => ({ claims: { aud: ["https://github.com/markd3ng"], repository: ["markd3ng/KIRARI"], ref: ["refs/heads/main"],
	workflow_ref: ["markd3ng/KIRARI/.github/workflows/site-production.yml@refs/heads/main"] }, to: { slugs: ["production"] } });
const project = () => ({ trustedSources: { enableVercelCiSameRepository: false, oidcProviders: { [issuer]: [rule()] } } });
const target = {};

test("current raw SDK provider map normalizes without an obsolete required projects field", () => {
	const current = project();
	assert.equal(validateVercelTrustedSources(current, target), true);
	const normalized = normalizeVercelTrustedSources(current);
	assert.deepEqual(normalized.projects, {});
	assert.equal(normalized.externalSources[0].issuer, issuer);
	const legacy = { trustedSources: { enableVercelCiSameRepository: false, projects: {}, externalSources: [{ issuer, ...rule() }] } };
	assert.deepEqual(normalizeVercelTrustedSources(legacy), normalized);
});

for (const candidate of [{}, { trustedSources: null }, { trustedSources: undefined },
	{ authenticated: true, trusted_sources_snapshot: { result: "PASS", captured_at: new Date().toISOString() } }]) {
	test("missing raw policy remains unavailable; local flags/snapshots cannot replace it", () => {
		assert.throws(() => normalizeVercelTrustedSources(candidate), /readback is unavailable/);
	});
}

for (const mutate of [
	policy => { delete policy.enableVercelCiSameRepository; },
	policy => { policy.enableVercelCiSameRepository = true; },
	policy => { policy.projects = { prj_other: {} }; },
	policy => { policy.oidcProviders["https://attacker.test"] = []; },
	policy => { policy.oidcProviders[issuer][0].issuer = "https://attacker.test"; },
	policy => { policy.oidcProviders[issuer] = rule(); },
	policy => { policy.oidcProviders[issuer].push(rule()); },
	policy => { policy.externalSources = []; },
	policy => { policy.unknownTrustGrant = true; },
]) test("ambiguous or broadened raw trust policy rejects", () => {
	const value = project(); mutate(value.trustedSources);
	assert.throws(() => validateVercelTrustedSources(value, target));
});

for (const mutate of [
	r => { r.to = { preset: "all-custom" }; },
	r => { r.to.preset = "all-custom"; },
	r => { r.to.slugs.push("preview"); },
	r => { r.to.unreviewed = true; },
	r => { r.claims.ref = ["*"]; },
	r => { r.claims.aud.push("https://github.com/other"); },
	r => { r.claims.repository = ["other/repo"]; },
	r => { r.claims.workflow_ref = ["markd3ng/KIRARI/.github/workflows/other.yml@refs/heads/main"]; },
	r => { r.claims.extra = ["allowed"]; },
]) test("normalization preserves exact claims and Production-only destination", () => {
	const value = project(); mutate(value.trustedSources.oidcProviders[issuer][0]);
	assert.throws(() => validateVercelTrustedSources(value, target));
});
