import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { after, test } from "node:test";
import {
	getProductionSitemapUrls,
	getGithubCommitStatuses,
	hasCanonicalCommit,
	hasPendingOrCompletedNotification,
	isIndexNowEnabled,
	MAX_INDEXNOW_ATTEMPTS,
	MAX_GITHUB_STATUS_PAGES,
	MAX_SITEMAP_BYTES,
	prepareIndexNowVerificationFile,
	submitIndexNow,
	verifyVercelSuccessEvent,
} from "../indexing.mjs";

const roots = [];
const commit = "a".repeat(40);
const payload = {
	id: "dpl_1234567890abcdefghijklmnopqrstuvwxyz",
	environment: "production",
	project: { id: "prj_QNMVdxTkPOad4ynN4fwFCYEST8Jk", name: "kirari-main" },
	git: { ref: "main", sha: commit, shortSha: commit.slice(0, 7) },
	state: { type: "success" },
	alias: ["kirari-main.vercel.app"],
	url: "https://kirari-main-deployabc-martyjstogner-projects.vercel.app",
};

after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

test("only the authenticated Vercel success event for the approved Production contract is accepted", () => {
	const event = { action: "vercel.deployment.success", repository: { full_name: "markd3ng/KIRARI" }, sender: { login: "vercel[bot]" }, client_payload: payload };
	assert.deepEqual(verifyVercelSuccessEvent({ event, repository: event.repository, sender: event.sender }), { accepted: true, deployment: { id: payload.id, sha: commit } });
	for (const [key, value] of [
		["action", "vercel.deployment.ready"],
		["sender", { login: "someone-else" }],
		["repository", { full_name: "fork/KIRARI" }],
		["environment", "preview"],
		["project", { id: "prj_other", name: "kirari-main" }],
		["git", { ref: "feature", sha: commit, shortSha: commit.slice(0, 7) }],
		["git", { ref: "main", sha: "invalid", shortSha: "invalid" }],
		["state", { type: "error" }],
		["alias", ["preview.vercel.app"]],
		["url", "https://attacker.example/"],
	]) {
		const candidate = structuredClone(event);
		if (["action", "sender", "repository"].includes(key)) candidate[key] = value;
		else candidate.client_payload[key] = value;
		const result = verifyVercelSuccessEvent({ event: candidate, repository: candidate.repository, sender: candidate.sender });
		assert.equal(result.accepted, false, key);
	}
});

test("IndexNow needs both explicit owner gates and only publishes a valid public verification key", () => {
	const root = mkdtempSync(join(tmpdir(), "kirari-indexnow-key-"));
	roots.push(root);
	const config = { seo: { indexNow: true, indexNowKey: "public-key-123" } };
	const productionAction = { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "repository_dispatch", GITHUB_REPOSITORY: "markd3ng/KIRARI", KIRARI_INDEXNOW_ENABLED: "true" };
	assert.equal(isIndexNowEnabled({ config, env: productionAction }), true);
	assert.equal(isIndexNowEnabled({ config, env: {} }), false);
	for (const veto of [
		{ NODE_ENV: "test" },
		{ KIRARI_BUILD_ONLY: "true" },
		{ KIRARI_SITE_SOURCE: "external-site" },
		{ VERCEL_ENV: "preview" },
		{ GITHUB_REPOSITORY: "fork/KIRARI" },
		{ GITHUB_EVENT_NAME: "push" },
	]) assert.equal(isIndexNowEnabled({ config, env: { ...productionAction, ...veto } }), false);
	assert.equal(prepareIndexNowVerificationFile({ config: { seo: { indexNow: false } }, distDir: root }), false);
	assert.equal(prepareIndexNowVerificationFile({ config, distDir: root }), true);
	assert.equal(readFileSync(join(root, "public-key-123.txt"), "utf8"), "public-key-123");
	assert.throws(() => prepareIndexNowVerificationFile({ config: { seo: { indexNow: true, indexNowKey: "../../escape" } }, distDir: root }), /valid public/);
	assert.throws(() => prepareIndexNowVerificationFile({ config: { seo: { indexNow: true, indexNowKey: "public_key_123" } }, distDir: root }), /valid public/);
	assert.equal(isIndexNowEnabled({ config: { seo: { indexNow: true, indexNowKey: "public_key_123" } }, env: productionAction }), false);
});

test("canonical Production response must serve the exact commit in canonical HTML", async () => {
	let requested;
	const html = `<!doctype html><head><meta name="kirari:build-commit" content="${commit}"><link rel="canonical" href="https://kirari-main.vercel.app/"></head><body><a href="https://github.com/markd3ng/KIRARI/commit/${commit}">commit</a></body>`;
	const ok = await hasCanonicalCommit({ sha: commit, fetchImpl: async (url, options) => { requested = { url, options }; return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } }); } });
	assert.equal(ok, true);
	assert.equal(requested.url, "https://kirari-main.vercel.app/");
	assert.equal(requested.options.redirect, "manual");
	assert.equal(await hasCanonicalCommit({ sha: "b".repeat(40), fetchImpl: async () => new Response(html, { headers: { "content-type": "text/html" } }) }), false);
	const staleBodyLink = html.replace(`content="${commit}"`, `content="${"b".repeat(40)}"`);
	assert.equal(await hasCanonicalCommit({ sha: commit, fetchImpl: async () => new Response(staleBodyLink, { headers: { "content-type": "text/html" } }) }), false);
	assert.equal(await hasCanonicalCommit({ sha: commit, fetchImpl: async () => new Response(html, { status: 302, headers: { location: "https://attacker.example" } }) }), false);
});

test("replay protection reads complete bounded GitHub status history", async () => {
	const calls = [];
	const statuses = await getGithubCommitStatuses({
		url: "https://api.github.com/repos/markd3ng/KIRARI/commits/abc/statuses",
		token: "test-token",
		fetchImpl: async (url) => {
			const page = Number(new URL(url).searchParams.get("page"));
			calls.push(page);
			return new Response(JSON.stringify(page === 1 ? Array.from({ length: 100 }, () => ({ state: "failure" })) : [{ context: "kirari/indexnow-production", state: "success" }]), { headers: { "content-type": "application/json" } });
		},
	});
	assert.equal(statuses.length, 101);
	assert.deepEqual(calls, [1, 2]);
	let pages = 0;
	await assert.rejects(getGithubCommitStatuses({
		url: "https://api.github.com/repos/markd3ng/KIRARI/commits/abc/statuses",
		token: "test-token",
		fetchImpl: async () => { pages++; return new Response(JSON.stringify(Array.from({ length: 100 }, () => ({}))), { headers: { "content-type": "application/json" } }); },
	}), /safe replay-check limit/);
	assert.equal(pages, MAX_GITHUB_STATUS_PAGES);
});

test("post-deployment workflow installs pinned pnpm before invoking package commands", () => {
	const workflow = readFileSync(new URL("../../../../.github/workflows/post-production-indexing.yml", import.meta.url), "utf8");
	assert.match(workflow, /pnpm\/action-setup@0c17529a66aca453f9227af23103ed11469b1e47[\s\S]*?version: 9\.14\.4/);
	assert.match(workflow, /types: \[vercel\.deployment\.success\]/);
});

test("Production sitemap URLs are same-origin, XML-decoded and de-duplicated", async () => {
	const calls = [];
	const fetchImpl = async (url) => {
		calls.push(url);
		if (url.endsWith("/sitemap-index.xml")) return new Response("<sitemapindex><sitemap><loc>https://kirari-main.vercel.app/sitemap-0.xml</loc></sitemap></sitemapindex>", { headers: { "content-type": "application/xml" } });
		return new Response("<urlset><url><loc>https://kirari-main.vercel.app/posts/a/?q=1&amp;v=2</loc></url><url><loc>https://kirari-main.vercel.app/posts/a/?q=1&amp;v=2</loc></url></urlset>", { headers: { "content-type": "application/xml" } });
	};
	assert.deepEqual(await getProductionSitemapUrls({ fetchImpl }), ["https://kirari-main.vercel.app/posts/a/?q=1&v=2"]);
	assert.equal(calls.length, 2);
	await assert.rejects(getProductionSitemapUrls({ fetchImpl: async () => new Response("<sitemapindex><loc>https://attacker.example/sitemap.xml</loc></sitemapindex>", { headers: { "content-type": "application/xml" } }) }), /unsafe or off-origin/);
	await assert.rejects(getProductionSitemapUrls({ fetchImpl: async () => new Response("x".repeat(MAX_SITEMAP_BYTES + 1), { headers: { "content-type": "application/xml" } }) }), /size limit/);
});

test("IndexNow makes one fixed-host request and rejects off-origin sitemap content", async () => {
	let request;
	const result = await submitIndexNow({ urls: ["https://kirari-main.vercel.app/posts/"], key: "public-key-123", fetchImpl: async (url, options) => { request = { url, options }; return new Response(null, { status: 202 }); } });
	assert.equal(result, 202);
	assert.equal(request.url, "https://api.indexnow.org/indexnow");
	assert.equal(JSON.parse(request.options.body).host, "kirari-main.vercel.app");
	assert.equal(request.options.redirect, "error");
	await assert.rejects(submitIndexNow({ urls: ["https://attacker.example/"], key: "public-key-123", fetchImpl: async () => { throw new Error("must not fetch"); } }), /canonical Production origin/);
	await assert.rejects(submitIndexNow({ urls: ["https://kirari-main.vercel.app/posts/"], key: "public-key-123", fetchImpl: async () => new Response(null, { status: 429 }) }), /HTTP 429/);
});

test("successful and pending commit statuses suppress duplicate notifications; failures can be retried", () => {
	assert.equal(hasPendingOrCompletedNotification([{ context: "other", state: "success" }]), false);
	assert.equal(hasPendingOrCompletedNotification([{ context: "kirari/indexnow-production", state: "success" }]), true);
	assert.equal(hasPendingOrCompletedNotification([{ context: "kirari/indexnow-production", state: "pending" }], Date.parse("2026-10-18T00:00:00Z")), true);
	assert.equal(hasPendingOrCompletedNotification([{ context: "kirari/indexnow-production", state: "pending", created_at: "2026-10-17T23:00:00Z" }], Date.parse("2026-10-18T00:00:00Z")), false);
	assert.equal(hasPendingOrCompletedNotification([{ context: "kirari/indexnow-production", state: "failure" }]), false);
	assert.equal(hasPendingOrCompletedNotification(Array.from({ length: MAX_INDEXNOW_ATTEMPTS }, () => ({ context: "kirari/indexnow-production", state: "pending", created_at: "2026-10-17T23:00:00Z" }))), true);
});
