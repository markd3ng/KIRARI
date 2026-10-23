import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { chromium } from "../p3-browser/node_modules/playwright/index.mjs";

const WAIT_TIMEOUT = 30_000;
const dist = resolve(fileURLToPath(new URL("../../apps/site/dist/", import.meta.url)));
const vercelConfig = JSON.parse(await readFile(new URL("../../vercel.json", import.meta.url), "utf8"));
const siteHeaderEntry = vercelConfig.headers.find((entry) => entry.source === "/(.*)");
if (!siteHeaderEntry) throw new Error("Site-wide headers entry (source: /(.*)) is missing from vercel.json");

const server = createServer(async (req, res) => {
	try {
		const requestPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname).replace(/^\/+/, "");
		const path = resolve(dist, requestPath);
		if (path !== dist && !path.startsWith(`${dist}${sep}`)) throw new Error(`Request escaped the static output directory: ${requestPath}`);
		const file = path.endsWith(sep) || !extname(path) ? resolve(path, "index.html") : path;
		const data = await readFile(file);
		for (const { key, value } of siteHeaderEntry.headers) res.setHeader(key, value);
		const contentTypes = {
			".html": "text/html",
			".js": "application/javascript",
			".css": "text/css",
			".svg": "image/svg+xml",
			".json": "application/json",
			".woff2": "font/woff2",
			".txt": "text/plain",
		};
		res.setHeader("Content-Type", contentTypes[extname(file)] || "application/octet-stream");
		res.end(data);
	} catch {
		res.writeHead(404);
		res.end("Not found");
	}
});

let browser;
try {
	await new Promise((done) => server.listen(0, "127.0.0.1", done));
	const origin = `http://127.0.0.1:${server.address().port}`;
	browser = await chromium.launch({ headless: true });
	const results = [];

	for (const width of [1600, 390]) {
		const page = await browser.newPage({ viewport: { width, height: 1000 } });
		page.setDefaultTimeout(WAIT_TIMEOUT);
		page.setDefaultNavigationTimeout(WAIT_TIMEOUT);
		const errors = [];
		const tracking = [];
		const violations = [];
		const browserLogs = [];
		const requestFailures = [];
		let phase = "install browser observers";
		page.on("pageerror", (error) => errors.push(error.message));
		page.on("console", (message) => browserLogs.push(`${message.type()}: ${message.text()}`));
		page.on("requestfailed", (request) => requestFailures.push(`${request.url()}: ${request.failure()?.errorText || "failed"}`));
		await page.exposeFunction("recordCSP", (event) => violations.push(event));
		await page.addInitScript(() => {
			window.p5RouteSwaps = 0;
			document.addEventListener("astro:after-swap", () => window.p5RouteSwaps++);
			document.addEventListener("securitypolicyviolation", (event) => window.recordCSP({
				directive: event.effectiveDirective,
				uri: event.blockedURI,
			}));
		});
		await page.route("**/*", (route) => {
			const url = route.request().url();
			if (/googletagmanager|google-analytics|umami|plausible|clarity|usefathom|simpleanalytics|amplitude/.test(url)) tracking.push(url);
			return new URL(url).origin === origin ? route.continue() : route.abort();
		});

		try {
			phase = "load the Mermaid article";
			await page.goto(`${origin}/zh-CN/posts/mermaid-test/`);
			phase = "wait for all enabled Mermaid diagrams";
			const expectedDiagrams = await page.locator('[data-mermaid-enabled="true"] pre.mermaid').count();
			assert.ok(expectedDiagrams > 0, "the smoke article contains enabled Mermaid examples");
			await page.waitForFunction(() => {
				const expected = document.querySelectorAll('[data-mermaid-enabled="true"] pre.mermaid').length;
				const rendered = document.querySelectorAll("[data-mermaid-rendered] svg").length;
				return expected > 0 && rendered === expected;
			}, undefined, { timeout: WAIT_TIMEOUT });
			const diagrams = await page.locator("[data-mermaid-rendered] svg").count();
			assert.equal(diagrams, expectedDiagrams, `all ${expectedDiagrams} article Mermaid diagrams rendered`);

			phase = "verify the TOC landmark and current location";
			const toc = page.locator("table-of-contents");
			assert.equal(await toc.count(), 1);
			assert.ok((await toc.getAttribute("aria-label") || "").length > 0);
			await page.waitForSelector('table-of-contents [aria-current="location"]', { timeout: WAIT_TIMEOUT });
			assert.equal(await toc.locator('[aria-current="location"]').count(), 1);
			const placement = await toc.evaluate((element) => ({
				sidebar: !!element.closest("#sidebar"),
				floating: !!element.closest("#toc-wrapper"),
				width: element.getBoundingClientRect().width,
			}));
			assert.equal(placement.sidebar, true, "profile sidebar host preserved");
			assert.equal(await toc.isVisible(), true, "TOC remains visible");
			assert.equal(placement.floating, false, "profile sidebar layout preserved");
			assert.ok(placement.width > 0);

			phase = "verify same-document route changes";
			await page.evaluate(() => { window.p5SameDocument = true; });
			await page.evaluate(() => {
				const anchor = document.createElement("a");
				anchor.id = "p5-next";
				anchor.href = "/posts/markdown/";
				anchor.textContent = "P5 next";
				document.body.append(anchor);
			});
			await page.locator("#p5-next").evaluate((anchor) => anchor.click());
			await page.waitForURL("**/posts/markdown/", { timeout: WAIT_TIMEOUT });
			assert.equal(await page.evaluate(() => window.p5SameDocument), true);
			assert.equal(await page.locator("pre.mermaid svg").count(), 0);
			await page.goBack();
			await page.waitForSelector("[data-mermaid-rendered] svg", { timeout: WAIT_TIMEOUT });
			assert.equal(await page.locator("table-of-contents").count(), 1);
			const routeSwaps = await page.evaluate(() => window.p5RouteSwaps);
			assert.equal(routeSwaps, 2, "counted the actual forward and back Astro swaps");

			phase = "verify tracking and CSP behavior";
			assert.deepEqual(tracking, [], "default configuration makes no analytics requests");
			assert.deepEqual(errors, [], "browser reports no uncaught page errors");
			assert.deepEqual(violations, [], "browser must report no CSP violations");
			results.push({
				width,
				diagrams,
				routeSwaps,
				placement,
				defaultAnalyticsRequests: tracking.length,
				pageErrors: errors.length,
				cspViolations: violations.length,
			});
		} catch (error) {
			const pageState = await page.evaluate(() => ({
				path: location.pathname,
				enabledDiagrams: document.querySelectorAll('[data-mermaid-enabled="true"] pre.mermaid').length,
				renderedDiagrams: document.querySelectorAll("[data-mermaid-rendered] svg").length,
				diagramErrors: Array.from(document.querySelectorAll("pre.mermaid[data-mermaid-render-error]"), (element) => element.dataset.mermaidRenderError),
			})).catch(() => null);
			throw new Error(`site-smoke failed at width=${width} during ${phase}; state=${JSON.stringify({ pageState, browserLogs: browserLogs.slice(-12), requestFailures: requestFailures.slice(-12) })}`, { cause: error });
		} finally {
			await page.close();
		}
	}

	console.log(JSON.stringify({ result: "PASS", fixture: "full-default-profile-static-output", results }));
} finally {
	await browser?.close();
	await new Promise((done) => server.close(done));
}
