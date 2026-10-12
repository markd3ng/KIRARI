import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
	writeFileSync(join(staticRoot, "index.html"), "<!doctype html><html><head><title>Home</title><link rel=\"canonical\" href=\"https://fixture.example/\"><link rel=\"stylesheet\" href=\"/site.css\"></head><body><h1>Home</h1><a href=\"/posts/welcome/\">Read welcome</a><script src=\"/site.js\"></script></body></html>");
	writeFileSync(join(staticRoot, "posts", "welcome", "index.html"), "<!doctype html><html><head><title>Welcome</title><link rel=\"canonical\" href=\"https://fixture.example/posts/welcome/\"></head><body><h1>Welcome content</h1></body></html>");
	writeFileSync(join(staticRoot, "site.css"), "body{font-family:sans-serif}");
	writeFileSync(join(staticRoot, "site.js"), "document.documentElement.dataset.fixtureLoaded = 'true';");
	writeFileSync(join(staticRoot, "robots.txt"), "User-agent: *\nAllow: /\nSitemap: https://fixture.example/sitemap-index.xml\n");
	writeFileSync(join(staticRoot, "sitemap-index.xml"), "<sitemapindex></sitemapindex>");
	const manifest = {
		schema_version: 1,
		core: { resolved_sha: "c".repeat(40) },
		site: { resolved_sha: "a".repeat(40) },
		upstream_github_artifact: { run_id: "37189363285", run_attempt: "1" },
		browser_contract: {
			routes: [
				{ path: "/", title: "Home", content_marker: "Home" },
				{ path: "/posts/welcome/", title: "Welcome", content_marker: "Welcome content" },
			],
			assets: { stylesheets: ["/site.css"], scripts: ["/site.js"], images: [] },
			navigation: "/posts/welcome/",
		},
	};
	const manifestPath = join(root, "site-package-manifest.json");
	writeFileSync(manifestPath, JSON.stringify(manifest));
	return { staticRoot, manifestPath };
}

test("production browser fixture uses Chromium over a mocked HTTPS deployment and canonical host", (context) => {
	let chromium;
	try { chromium = browserRequire("playwright").chromium; } catch (error) {
		if (process.env.REQUIRE_PRODUCTION_BROWSER === "true") throw error;
		context.skip("Playwright is installed by the browser-fixtures job");
		return;
	}
	if (!existsSync(chromium.executablePath())) {
		if (process.env.REQUIRE_PRODUCTION_BROWSER === "true") assert.fail("Chromium is installed by the browser-fixtures job");
		context.skip("Chromium is installed by the browser-fixtures job");
		return;
	}

	const temporary = mkdtempSync(join(tmpdir(), "kirari-p4-browser-fixture-"));
	try {
		const { staticRoot, manifestPath } = writeFixture(temporary);
		const fixtureScript = join(repoRoot, "scripts/p3-browser/production-fixture.mjs");
		const args = [fixtureScript, "--static-root", staticRoot, "--manifest", manifestPath, "--canonical-origin", "https://fixture.example"];
		const positive = spawnSync(process.execPath, args, { cwd: repoRoot, encoding: "utf8", timeout: 30_000 });
		assert.equal(positive.error, undefined, positive.error?.message);
		assert.equal(positive.status, 0, positive.stderr || positive.stdout);
		const evidence = JSON.parse(positive.stdout);
		assert.equal(evidence.result, "PASS");
		assert.equal(evidence.fixture, "local-real-chromium-production");
		assert.equal(evidence.report.baseUrl, "https://kirari-main-production-fixture.vercel.app");
		assert.equal(evidence.report.canonicalOrigin, "https://fixture.example");
		assert.equal(evidence.report.byteEquality, "PASS");
		assert.equal(evidence.report.browserConsoleErrors, 0);
		assert.equal(evidence.report.pageErrors, 0);
		assert.equal(evidence.report.failedBrowserRequests, 0);
		assert.equal(evidence.report.badResponses, 0);
		assert.equal(evidence.report.unexpectedExternalCalls, 0);
		assert.equal(positive.stdout.includes("local-browser-fixture-token"), false);

		const negative = spawnSync(process.execPath, [...args.slice(0, -1), "https://wrong.example"], { cwd: repoRoot, encoding: "utf8", timeout: 30_000 });
		assert.equal(negative.status, 1);
		assert.match(negative.stderr, /PRODUCTION_CANONICAL_TARGET_MISMATCH/);
	} finally {
		rmSync(temporary, { recursive: true, force: true });
	}
});
