import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const siteRoot = new URL("../../", import.meta.url).pathname;
const browserRequire = createRequire(new URL("../../../../scripts/p3-browser/package.json", import.meta.url));

test("real Astro/Expressive Code Mermaid gates, route swaps, themes and errors", { timeout: 180_000 }, async (context) => {
	let chromium;
	try { ({ chromium } = browserRequire("playwright")); } catch (error) {
		if (process.env.REQUIRE_SITE_BROWSER === "true") throw error;
		context.skip("Playwright is installed by the browser-fixtures job"); return;
	}
	if (!existsSync(chromium.executablePath())) {
		if (process.env.REQUIRE_SITE_BROWSER === "true") assert.fail("Chromium is required");
		context.skip("Chromium is installed by the browser-fixtures job"); return;
	}
	const root = mkdtempSync(join(siteRoot, ".mermaid-fixture-"));
	let browser;
	try {
		mkdirSync(join(root, "src/pages"), { recursive: true });
		mkdirSync(join(root, "src/layouts"), { recursive: true });
		mkdirSync(join(root, "src/utils"), { recursive: true });
		symlinkSync(realpathSync(join(siteRoot, "node_modules")), join(root, "node_modules"), "dir");
		for (const name of ["mermaid-runtime.ts", "transition-manager.ts"]) cpSync(join(siteRoot, "src/utils", name), join(root, "src/utils", name));
		writeFileSync(join(root, "astro.config.mjs"), `import {defineConfig} from 'astro/config';
import {unified} from '@astrojs/markdown-remark';
import expressiveCode from 'astro-expressive-code';
import {rehypeMermaidPreProcess} from ${JSON.stringify(join(siteRoot, "src/plugins/rehype-mermaid-pre.mjs"))};
export default defineConfig({srcDir:${JSON.stringify(join(root, "src"))},outDir:${JSON.stringify(join(root, "dist"))},cacheDir:${JSON.stringify(join(root, ".astro"))},publicDir:${JSON.stringify(join(root, "public"))},integrations:[expressiveCode()],markdown:{processor:unified({rehypePlugins:[rehypeMermaidPreProcess]})}});`);
		writeFileSync(join(root, "src/layouts/Post.astro"), `---
import {ClientRouter} from 'astro:transitions';
const {frontmatter} = Astro.props;
---
<html lang="en"><head><ClientRouter /></head><body>
<nav><a id="enabled" href="/enabled/">Enabled</a><a id="disabled" href="/disabled/">Disabled</a><a id="translated" href="/zh/">Translated</a></nav>
<article data-mermaid-enabled={frontmatter.global && frontmatter.mermaid ? 'true' : 'false'}><slot /></article>
{frontmatter.global && frontmatter.mermaid && <script>document.documentElement.dataset.conditionalScriptRan = 'true';</script>}
<script>
import {installMermaid} from '../utils/mermaid-runtime';
import {transitionManager} from '../utils/transition-manager';
installMermaid(transitionManager); transitionManager.init();
</script></body></html>`);
		const fixtureRoutes = [
			["off-off", false, false], ["off-on", false, true], ["disabled", true, false],
			["default", true, undefined], ["enabled", true, true], ["zh", true, true],
		];
		for (const [name, global, mermaid] of fixtureRoutes) writeFileSync(join(root, `src/pages/${name}.md`), `---\nlayout: ../layouts/Post.astro\nglobal: ${global}\n${mermaid === undefined ? '' : `mermaid: ${mermaid}\n`}---\n# Mermaid fixture\n\n\`\`\`mermaid\ngraph TD; A-->B\n\`\`\`\n\n${name === 'enabled' ? '\`\`\`mermaid\nthis is invalid Mermaid\n\`\`\`\n\n\`\`\`js\nconst untouched = true;\n\`\`\`' : ''}`);
		const build = spawnSync(join(siteRoot, "node_modules/.bin/astro"), ["build", "--root", siteRoot, "--config", relative(siteRoot, join(root, "astro.config.mjs"))], { cwd: siteRoot, encoding: "utf8", timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
		assert.equal(build.status, 0, `${build.error || ''}\n${build.stdout}\n${build.stderr}`);
		browser = await chromium.launch({ headless: true });
		const page = await browser.newPage();
		const pageErrors = [];
		const rendererRequests = [];
		page.on("request", (request) => { if (/mermaid\.core/.test(request.url())) rendererRequests.push(request.url()); });
		page.on("pageerror", (error) => pageErrors.push(error.message));
		await page.route("https://mermaid-fixture.invalid/**", async (route) => {
			const pathname = new URL(route.request().url()).pathname;
			const path = join(root, "dist", pathname.endsWith("/") ? `${pathname}index.html` : pathname);
			if (!existsSync(path)) return route.fulfill({ status: 404, body: "missing" });
			const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[extname(path)] || "application/octet-stream";
			await route.fulfill({ status: 200, contentType: mime, body: readFileSync(path) });
		});
		for (const name of ["off-off", "off-on", "disabled", "default"]) {
			await page.goto(`https://mermaid-fixture.invalid/${name}/`);
			await page.waitForLoadState("networkidle");
			assert.equal(await page.locator("pre.mermaid svg").count(), 0, name);
			assert.equal(await page.locator("pre.mermaid").textContent(), "graph TD; A-->B\n");
			assert.equal(await page.locator("pre.mermaid").getAttribute("tabindex"), "0");
		}
		assert.equal(rendererRequests.length, 0, "disabled initial routes do not fetch Mermaid");
		// Astro 7 preserves the initial conditional script gate; persistent runtime also gates destination markup.
		assert.equal(await page.evaluate(() => document.documentElement.dataset.conditionalScriptRan), undefined);
		await page.evaluate(() => { window.fixtureDocument = true; });
		await page.locator("#enabled").click();
		await page.waitForSelector('pre[data-mermaid-rendered="default"] svg');
		assert.equal(await page.evaluate(() => window.fixtureDocument), true, "Astro swapped without document reload");
		assert.equal(await page.locator("pre.mermaid svg").count(), 1);
		assert.match(await page.locator('pre.mermaid[aria-label*="could not"]').textContent(), /invalid Mermaid/);
		assert.equal(await page.locator(".expressive-code").count(), 1, "normal JS still uses Expressive Code");
		const firstId = await page.locator("pre.mermaid svg").getAttribute("id");
		await page.evaluate(() => { document.dispatchEvent(new Event("astro:after-swap")); document.dispatchEvent(new Event("astro:after-swap")); });
		await page.waitForTimeout(100);
		assert.equal(await page.locator("pre.mermaid svg").getAttribute("id"), firstId, "same diagram not rendered twice");
		await page.evaluate(() => document.documentElement.classList.add("dark"));
		await page.waitForSelector('pre[data-mermaid-rendered="dark"] svg');
		const darkId = await page.locator("pre.mermaid svg").getAttribute("id");
		assert.notEqual(darkId, firstId);
		await page.evaluate(() => document.documentElement.classList.remove("dark"));
		await page.waitForSelector('pre[data-mermaid-rendered="default"] svg');
		await page.locator("#disabled").click();
		await page.waitForURL("**/disabled/");
		await page.waitForLoadState("networkidle");
		assert.equal(await page.locator("pre.mermaid svg").count(), 0, "enabled runtime cannot render disabled destination");
		await page.locator("#translated").click();
		await page.waitForSelector("pre.mermaid svg");
		assert.equal(await page.locator("pre.mermaid svg").count(), 1);
		await page.goBack();
		await page.waitForURL("**/disabled/");
		await page.waitForSelector('article[data-mermaid-enabled="false"]');
		assert.equal(await page.locator("pre.mermaid svg").count(), 0);
		await page.goto("https://mermaid-fixture.invalid/enabled/");
		await page.waitForSelector("pre.mermaid svg");
		assert.equal(await page.locator("pre.mermaid svg").count(), 1, "enabled initial load renders once");
		assert.ok(rendererRequests.length > 0);
		assert.equal(await page.locator('body > div[aria-hidden="true"]').count(), 0, "renderer containers cleaned up");
		assert.deepEqual(pageErrors, []);
	} finally {
		await browser?.close();
		rmSync(root, { recursive: true, force: true });
	}
});
