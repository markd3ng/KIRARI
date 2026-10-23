import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const browserRequire = createRequire(new URL("../p3-browser/package.json", import.meta.url));

function writeFixture(root) {
	const staticRoot = join(root, "static");
	mkdirSync(join(staticRoot, "posts", "welcome"), { recursive: true });
	writeFileSync(join(staticRoot, "index.html"), "<!doctype html><html><head><title>Home</title><link rel=\"canonical\" href=\"https://fixture.example/\"><link rel=\"stylesheet\" href=\"/site.css\"></head><body><h1>Home</h1><a href=\"/posts/welcome/\">Read welcome</a><img src=\"/site.svg\" alt=\"Fixture image\"><script src=\"/site.js\"></script></body></html>");
	writeFileSync(join(staticRoot, "posts", "welcome", "index.html"), "<!doctype html><html><head><title>Welcome</title><link rel=\"canonical\" href=\"https://fixture.example/posts/welcome/\"></head><body><h1>Welcome content</h1></body></html>");
	writeFileSync(join(staticRoot, "site.css"), "body{font-family:sans-serif}");
	writeFileSync(join(staticRoot, "site.svg"), '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1"/></svg>');
	writeFileSync(join(staticRoot, "site.js"), "fetch('https://api.iconify.design/fa6-brands.json?icons=github').then(response => response.json()).then(data => { if (!data.icons.github) throw new Error('fixture icon missing'); }).catch(() => console.error('fixture icon failed')); document.documentElement.dataset.fixtureLoaded = 'true';");
	writeFileSync(join(staticRoot, "robots.txt"), "User-agent: *\nAllow: /\nSitemap: https://fixture.example/sitemap-index.xml\n");
	writeFileSync(join(staticRoot, "sitemap-index.xml"), "<sitemapindex></sitemapindex>");
	return { staticRoot };
}

function requireChromium(context) {
	let chromium;
	try { chromium = browserRequire("playwright").chromium; } catch (error) {
		if (process.env.REQUIRE_SITE_BROWSER === "true") throw error;
		context.skip("Playwright is installed by the browser-fixtures job");
		return false;
	}
	if (!existsSync(chromium.executablePath())) {
		if (process.env.REQUIRE_SITE_BROWSER === "true") assert.fail("Chromium is required by the browser-fixtures job");
		context.skip("Chromium is installed by the browser-fixtures job");
		return false;
	}
	return true;
}

function run(script, args) {
	return spawnSync(process.execPath, [join(repoRoot, script), ...args], { cwd: repoRoot, encoding: "utf8", timeout: 30_000 });
}

function fixtureArgs(staticRoot) {
	return ["--dist-root", staticRoot, "--canonical-origin", "https://fixture.example", "--indexable", "true"];
}

test("site fixture uses real Chromium with configured canonical, navigation, assets and byte comparison", (context) => {
	if (!requireChromium(context)) return;
	const temporary = mkdtempSync(join(tmpdir(), "kirari-site-browser-"));
	try {
		const { staticRoot } = writeFixture(temporary);
		const positive = run("scripts/p3-browser/site-fixture.mjs", fixtureArgs(staticRoot));
		assert.equal(positive.error, undefined, positive.error?.message);
		assert.equal(positive.status, 0, positive.stderr || positive.stdout);
		const evidence = JSON.parse(positive.stdout);
		assert.equal(evidence.result, "PASS");
		assert.equal(evidence.fixture, "local-real-chromium-site");
		assert.equal(evidence.report.baseUrl, "https://browser-fixture.invalid");
		assert.equal(evidence.report.canonicalOrigin, "https://fixture.example");
		assert.equal(evidence.report.providerDeploymentIdentityVerified, false);
		assert.equal(evidence.report.externalTransport, "NOT_CHECKED");
		assert.ok(evidence.report.fixtureIcons.requests >= 1);
		assert.equal(evidence.report.fixtureIcons.resolvedIcons, 1);
		assert.equal(evidence.report.byteEquality, "PASS");
		assert.equal(evidence.report.localOutputBytesMatched, true);
		for (const name of ["browserConsoleErrors", "pageErrors", "failedBrowserRequests", "badResponses", "unexpectedExternalCalls"]) assert.equal(evidence.report[name], 0);
		assert.ok(evidence.report.assets.loaded >= 3);

		const noindex = run("scripts/p3-browser/site-fixture.mjs", [...fixtureArgs(staticRoot).slice(0, -1), "false"]);
		assert.equal(noindex.status, 0, noindex.stderr || noindex.stdout);
		assert.equal(JSON.parse(noindex.stdout).report.indexable, false);
	} finally { rmSync(temporary, { recursive: true, force: true }); }
});

test("real Chromium catches dynamic canonical, navigation, asset, console and external-call regressions", (context) => {
	if (!requireChromium(context)) return;
	const mutations = [
		["canonical", (root) => writeFileSync(join(root, "site.js"), 'document.querySelector("link[rel=canonical]").href = "https://wrong.example/";'), /SITE_BROWSER_CANONICAL_MISMATCH/],
		["navigation", (root) => writeFileSync(join(root, "site.js"), 'document.querySelector("a").remove();'), /SITE_BROWSER_FIXTURE_FAILED/],
		["asset", (root) => rmSync(join(root, "site.svg")), /SITE_BROWSER_FIXTURE_FAILED/],
		["console", (root) => writeFileSync(join(root, "site.js"), 'console.error("fixture failure");'), /SITE_BROWSER_FIXTURE_FAILED/],
		["external", (root) => writeFileSync(join(root, "site.js"), 'fetch("https://unexpected.example/collect").catch(() => {});'), /SITE_BROWSER_FIXTURE_FAILED/],
		["missing-icon", (root) => writeFileSync(join(root, "site.js"), 'fetch("https://api.iconify.design/fa6-brands.json?icons=missing-fixture-icon").catch(() => {});'), /SITE_BROWSER_FIXTURE_FAILED/],
	];
	for (const [name, mutate, error] of mutations) {
		const temporary = mkdtempSync(join(tmpdir(), `kirari-browser-${name}-`));
		try {
			const { staticRoot } = writeFixture(temporary);
			mutate(staticRoot);
			const negative = run("scripts/p3-browser/site-fixture.mjs", fixtureArgs(staticRoot));
			assert.equal(negative.status, 1, `${name}: ${negative.stderr || negative.stdout}`);
			assert.match(negative.stderr, error);
			assert.equal(JSON.parse(negative.stderr).stage, "browser-route-checks");
		} finally { rmSync(temporary, { recursive: true, force: true }); }
	}
});

test("static fixture refuses canonical, metadata noindex and robots mismatch before browser use", () => {
	const mutations = [
		[(root) => writeFileSync(join(root, "index.html"), readFileSync(join(root, "index.html"), "utf8").replace("https://fixture.example/", "https://wrong.example/")), /SITE_CANONICAL_ORIGIN_MISMATCH/],
		[(root) => writeFileSync(join(root, "index.html"), readFileSync(join(root, "index.html"), "utf8").replace("<head>", '<head><meta name="robots" content="noindex">')), /SITE_NOINDEX_METADATA/],
		[(root) => writeFileSync(join(root, "robots.txt"), "User-agent: *\nDisallow: /\n"), /SITE_ROBOTS_DISALLOWS_INDEXING/],
	];
	for (const [mutate, error] of mutations) {
		const temporary = mkdtempSync(join(tmpdir(), "kirari-browser-policy-"));
		try {
			const { staticRoot } = writeFixture(temporary);
			mutate(staticRoot);
			const negative = run("scripts/p3-browser/site-fixture.mjs", fixtureArgs(staticRoot));
			assert.equal(negative.status, 1);
			assert.match(negative.stderr, error);
		} finally { rmSync(temporary, { recursive: true, force: true }); }
	}
});

test("ordinary local browser CLI needs no provider identity or credentials and rejects retired admission arguments", (context) => {
	if (!requireChromium(context)) return;
	const temporary = mkdtempSync(join(tmpdir(), "kirari-browser-cli-"));
	try {
		const { staticRoot } = writeFixture(temporary);
		const report = join(temporary, "report.json");
		const args = ["--dist-root", staticRoot, "--report", report];
		const local = run("scripts/p3-browser/validate.mjs", args);
		assert.equal(local.status, 0, local.stderr || local.stdout);
		const evidence = JSON.parse(readFileSync(report, "utf8"));
		assert.equal(evidence.result, "PASS");
		assert.equal(evidence.providerDeploymentIdentityVerified, false);
		assert.equal(evidence.externalTransport, "NOT_CHECKED");
		assert.equal(evidence.fixtureIcons.resolvedIcons, 1);
		assert.equal(evidence.byteEquality, "NOT_CHECKED");
		assert.ok(evidence.routes.length >= 2);
		const production = run("scripts/p3-browser/validate.mjs", [...args, "--mode", "production", "--canonical-origin", "https://fixture.example", "--indexable", "true"]);
		assert.equal(production.status, 0, production.stderr || production.stdout);
		for (const option of ["--binding", "--phase", "--manifest", "--deployment", "--aliases"]) {
			assert.equal(run("scripts/p3-browser/validate.mjs", [...args, option, "retired"]).status, 1);
		}
	} finally { rmSync(temporary, { recursive: true, force: true }); }
});
