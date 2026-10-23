import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { deriveStaticIndexingPolicy, StaticSiteValidationError, compareStaticOutput, staticFileInventory } from "../static-site-validation.mjs";
import { assertCanonicalLink, assertIndexableHeaders } from "../p3-browser/page-policy.mjs";

const targetOrigin = "https://fixture.example";
const targetDomain = "fixture.example";

function temporaryDirectory() {
	return mkdtempSync(join(tmpdir(), "kirari-static-validation-"));
}

function staticFixture(root, { canonicalOrigin = targetOrigin, robots = undefined, page = undefined, config = undefined } = {}) {
	mkdirSync(join(root, "posts", "welcome"), { recursive: true });
	writeFileSync(join(root, "index.html"), page ?? `<html><head><title>Welcome</title><link rel="canonical" href="${canonicalOrigin}/"></head><body><h1>Welcome</h1><link rel="stylesheet" href="/site.css"><a href="/posts/welcome/">Read</a></body></html>`);
	writeFileSync(join(root, "posts", "welcome", "index.html"), `<html><head><title>Post</title><link rel="canonical" href="${canonicalOrigin}/posts/welcome/"></head><body><h1>Post</h1></body></html>`);
	writeFileSync(join(root, "site.css"), "body{color:black}");
	writeFileSync(join(root, "robots.txt"), robots ?? `User-agent: *\nAllow: /\nDisallow: /llms-full.txt\n\nSitemap: ${canonicalOrigin}/sitemap-index.xml\n`);
	writeFileSync(join(root, "sitemap-index.xml"), "<sitemapindex></sitemapindex>");
	if (config !== undefined) {
		mkdirSync(join(root, ".."), { recursive: true });
		writeFileSync(join(root, "..", "config.json"), JSON.stringify(config));
	}
}

function expectCode(code, fn) {
	assert.throws(fn, (error) => error instanceof StaticSiteValidationError && error.code === code);
}

test("non-indexable static output remains a supported explicit policy", () => {
	const root = temporaryDirectory();
	try {
		staticFixture(root, { robots: "User-agent: *\nDisallow: /\n", page: `<html><head><meta name="robots" content="noindex"><link rel="canonical" href="${targetOrigin}/"></head><body>Home</body></html>` });
		const policy = deriveStaticIndexingPolicy({ staticRoot: root, canonicalOrigin: targetOrigin, indexable: false });
		assert.equal(policy.indexable, false);
		assert.equal(policy.robotsSitemapCount, 0);
		expectCode("SITE_NOINDEX_METADATA", () => deriveStaticIndexingPolicy({ staticRoot: root, canonicalOrigin: targetOrigin, indexable: true }));
		expectCode("INVALID_SITE_INDEXING_POLICY", () => deriveStaticIndexingPolicy({ staticRoot: root, canonicalOrigin: targetOrigin, indexable: "false" }));
	} finally { rmSync(root, { recursive: true, force: true }); }
});

test("static inventory rejects nested and root symlinks", () => {
	const root = temporaryDirectory();
	try {
		staticFixture(join(root, "static"));
		symlinkSync(join(root, "static"), join(root, "linked"));
		expectCode("STATIC_OUTPUT_MISSING", () => staticFileInventory(join(root, "linked")));
		symlinkSync(join(root, "static", "site.css"), join(root, "static", "linked.css"));
		expectCode("STATIC_OUTPUT_CONTAINS_SYMLINK", () => staticFileInventory(join(root, "static")));
	} finally { rmSync(root, { recursive: true, force: true }); }
});

test("indexable browser headers reject noindex and none tokens", () => {
	assertIndexableHeaders({ "x-robots-tag": "index, follow" });
	for (const value of ["noindex", "none", "googlebot: noindex, nofollow"]) {
		expectCode("SITE_NOINDEX_RESPONSE_HEADER", () => assertIndexableHeaders({ "x-robots-tag": value }));
	}
});

test("static indexing policy derives canonical and robots expectations from local static output", () => {
	const root = temporaryDirectory();
	const staticRoot = join(root, ".vercel", "output", "static");
	try {
		staticFixture(staticRoot);
		const policy = deriveStaticIndexingPolicy({ staticRoot, canonicalOrigin: targetOrigin, indexable: true });
		assert.deepEqual({
			canonicalOrigin: policy.canonicalOrigin,
			canonicalDocuments: policy.canonicalDocuments,
			robotsSitemapCount: policy.robotsSitemapCount,
			indexable: policy.indexable,
		}, {
			canonicalOrigin: targetOrigin,
			canonicalDocuments: 2,
			robotsSitemapCount: 1,
			indexable: true,
		});
	} finally { rmSync(root, { recursive: true, force: true }); }
});

test("static indexing policy fails closed on target canonical mismatch, noindex metadata, robots block, or noindex output headers", () => {
	const root = temporaryDirectory();
	const staticRoot = join(root, ".vercel", "output", "static");
	try {
		staticFixture(staticRoot, { canonicalOrigin: "https://example.com" });
		expectCode("SITE_CANONICAL_TARGET_MISMATCH", () => deriveStaticIndexingPolicy({ staticRoot, canonicalOrigin: targetOrigin, indexable: true }));
	} finally { rmSync(root, { recursive: true, force: true }); }

	for (const [code, options] of [
		["SITE_CANONICAL_ROUTE_MISMATCH", { page: `<html><head><link rel="canonical" href="${targetOrigin}/wrong/"></head><body><h1>Welcome</h1></body></html>` }],
		["SITE_NOINDEX_METADATA", { page: `<html><head><meta name="robots" content="noindex"><link rel="canonical" href="${targetOrigin}/"></head><body><h1>Welcome</h1></body></html>` }],
		["SITE_ROBOTS_DISALLOWS_INDEXING", { robots: `User-agent: *\nDisallow: /\nSitemap: ${targetOrigin}/sitemap-index.xml\n` }],
		["SITE_NOINDEX_HEADER_POLICY", { config: { version: 3, routes: [{ src: "/.*", headers: { "X-Robots-Tag": "noindex, nofollow" } }] } }],
	]) {
		const root = temporaryDirectory();
		const staticRoot = join(root, ".vercel", "output", "static");
		try {
			staticFixture(staticRoot, options);
			expectCode(code, () => deriveStaticIndexingPolicy({ staticRoot, canonicalOrigin: targetOrigin, indexable: true }));
		} finally { rmSync(root, { recursive: true, force: true }); }
	}
});

test("browser canonical must match the complete configured route URL", async () => {
	const route = { path: "/posts/welcome/", title: "Welcome" };
	const page = (href) => ({ locator: () => ({ getAttribute: async () => href }) });
	await assertCanonicalLink(page(`${targetOrigin}${route.path}`), route, targetOrigin);
	await assertCanonicalLink(page(`${targetOrigin}/posts/welcome`), route, targetOrigin);
	for (const href of [`${targetOrigin}/wrong/`, `${targetOrigin}${route.path}?other=1`, `${targetOrigin}${route.path}#other`, `https://user@${targetDomain}${route.path}`]) {
		await assert.rejects(assertCanonicalLink(page(href), route, targetOrigin), (error) => error instanceof StaticSiteValidationError && error.code === "SITE_BROWSER_CANONICAL_MISMATCH");
	}
});
test("observed remote output is compared byte-for-byte without acquiring credentials", async () => {
	const root = temporaryDirectory();
	const staticRoot = join(root, ".vercel", "output", "static");
	try {
		staticFixture(staticRoot);
		const requests = [];
		const result = await compareStaticOutput({
			staticRoot,
			baseUrl: targetOrigin,
			fetchImpl: async (url, options) => {
				requests.push({ url: url.href, headers: options.headers, redirect: options.redirect });
				let path = decodeURIComponent(url.pathname).slice(1);
				if (!path || path.endsWith("/")) path = join(path, "index.html");
				const bytes = readFileSync(join(staticRoot, path));
				return new Response(bytes, { status: 200 });
			},
		});
		assert.equal(result.byteEquality, "PASS");
		assert.equal(result.localOutputBytesMatched, true);
		assert.equal(requests.length, result.fileCount);
		assert.ok(requests.every((request) => new URL(request.url).origin === targetOrigin && request.redirect === "manual"));
		assert.ok(requests.every((request) => !Object.keys(request.headers).some((name) => /authorization|cookie|token|bypass/i.test(name))));

		let fetches = 0;
		const redirectFetchUrls = [];
		await assert.rejects(compareStaticOutput({
			staticRoot,
			baseUrl: targetOrigin,
			fetchImpl: async () => {
				fetches += 1;
				redirectFetchUrls.push(targetOrigin);
				return new Response(null, { status: 302, headers: { location: "https://attacker.example/collect" } });
			},
		}), (error) => error.code === "SITE_STATIC_FETCH_FAILED");
		assert.ok(fetches >= 1 && fetches <= 4);
		assert.ok(redirectFetchUrls.every((url) => new URL(url).origin === targetOrigin));
	} finally { rmSync(root, { recursive: true, force: true }); }
});

test("observed byte comparison fails closed when a Build Output redirect shadows a physical static file", async () => {
	const root = temporaryDirectory();
	const staticRoot = join(root, ".vercel", "output", "static");
	try {
		staticFixture(staticRoot);
		mkdirSync(join(staticRoot, "en-US"), { recursive: true });
		writeFileSync(join(staticRoot, "en-US", "index.html"), "<html><body>English tombstone bytes</body></html>");
		writeFileSync(join(root, ".vercel", "output", "config.json"), JSON.stringify({ version: 3, routes: [{ src: "^/en-US/$", dest: "/", status: 301 }] }));
		const fetched = [];
		await assert.rejects(compareStaticOutput({
			staticRoot,
			baseUrl: targetOrigin,
			fetchImpl: async (url, options) => {
				fetched.push({ url: url.href, redirect: options.redirect });
				if (url.pathname === "/en-US/") return new Response(null, { status: 301, headers: { location: "/" } });
			let path = decodeURIComponent(url.pathname).slice(1);
				if (!path || path.endsWith("/")) path = join(path, "index.html");
				return new Response(readFileSync(join(staticRoot, path)), { status: 200 });
			},
		}), (error) => error.code === "SITE_STATIC_OUTPUT_MISMATCH");
		assert.ok(fetched.some(({ url }) => new URL(url).pathname === "/en-US/"));
		assert.ok(fetched.every(({ url, redirect }) => new URL(url).origin === targetOrigin && redirect === "manual"));
	} finally { rmSync(root, { recursive: true, force: true }); }
});
