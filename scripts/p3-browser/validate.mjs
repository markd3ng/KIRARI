#!/usr/bin/env node

import { createServer } from "node:http";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { chromium } from "playwright";
import { browserContract } from "./contract.mjs";

const expectedExternalOrigins = new Set([
	"https://api.iconify.design",
	"https://api.unisvg.com",
	"https://api.simplesvg.com",
]);

function argumentsMap(args) {
	const values = new Map();
	for (let i = 0; i < args.length; i += 1) {
		const key = args[i];
		if (!["--base-url", "--dist-root", "--manifest", "--report"].includes(key) || values.has(key)) throw new Error(`Unknown or repeated option: ${key}`);
		const value = args[++i];
		if (!value || value.startsWith("--")) throw new Error(`Missing value for ${key}`);
		values.set(key, value);
	}
	if (!values.has("--report") || (!values.has("--base-url") && !values.has("--dist-root"))) {
		throw new Error("Usage: validate.mjs --report <file> (--base-url <url> --manifest <file> | --dist-root <dir>)");
	}
	return values;
}

function serveStatic(dist) {
	const types = { ".css": "text/css", ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".mjs": "text/javascript", ".svg": "image/svg+xml", ".txt": "text/plain", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".woff2": "font/woff2" };
	const missingPaths = [];
	const server = createServer((request, response) => {
		let pathname;
		try { pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname); }
		catch { response.writeHead(400).end(); return; }
		let file = resolve(dist, `.${pathname}`);
		if (file !== dist && !file.startsWith(`${dist}${sep}`)) { response.writeHead(400).end(); return; }
		if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
		if (!existsSync(file) && !extname(file)) {
			if (existsSync(join(file, "index.html"))) file = join(file, "index.html");
			else if (existsSync(`${file}.html`)) file = `${file}.html`;
		}
		if (!existsSync(file) || !statSync(file).isFile()) { missingPaths.push(pathname); response.writeHead(404, { "X-Robots-Tag": "noindex" }).end("Not Found"); return; }
		response.writeHead(200, { "Content-Type": types[extname(file).toLowerCase()] ?? "application/octet-stream", "X-Robots-Tag": "noindex" });
		response.end(readFileSync(file));
	});
	return new Promise((resolveServer, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => resolveServer({ server, missingPaths, url: `http://127.0.0.1:${server.address().port}` }));
	});
}

function requireNoindex(response, path) {
	const value = response.headers()["x-robots-tag"] ?? "";
	if (!/noindex/i.test(value)) throw new Error(`Preview route ${path} is missing noindex protection (x-robots-tag=${JSON.stringify(value)})`);
	return value;
}

async function main() {
	const args = argumentsMap(process.argv.slice(2));
	const distRoot = args.get("--dist-root") ? resolve(args.get("--dist-root")) : undefined;
	const manifest = args.get("--manifest") ? JSON.parse(readFileSync(args.get("--manifest"), "utf8")) : undefined;
	const contract = manifest?.browser_contract ?? browserContract(distRoot);
	const local = distRoot ? await serveStatic(distRoot) : undefined;
	const baseUrl = new URL(args.get("--base-url") ?? local.url);
	if (!/^https?:$/.test(baseUrl.protocol) || baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) throw new Error("Base URL must be a plain HTTP(S) origin or path");
	const origin = baseUrl.origin;
	const consoleErrors = [];
	const pageErrors = [];
	const failedRequests = [];
	const externalRequests = [];
	const expectedExternalRequests = [];
	const badResponses = [];
	const loadedAssets = new Set();
	const routeResults = [];
	let browser;
	let context;
	try {
		browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
		context = await browser.newContext({
			serviceWorkers: "block",
			...(process.env.VERCEL_AUTOMATION_BYPASS_SECRET ? {
				extraHTTPHeaders: { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET },
			} : {}),
		});
		const page = await context.newPage();
		await context.route("**/*", async (route) => {
			const requestUrl = new URL(route.request().url());
			if (requestUrl.origin !== origin) {
				const request = { url: requestUrl.href, resourceType: route.request().resourceType() };
				if (expectedExternalOrigins.has(requestUrl.origin)) {
					expectedExternalRequests.push(request);
					await route.continue();
					return;
				}
				externalRequests.push(request);
				await route.abort("blockedbyclient");
				return;
			}
			await route.continue();
		});
		page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
		page.on("pageerror", (error) => pageErrors.push(error.message));
		page.on("requestfailed", (request) => {
			const error = request.failure()?.errorText ?? "failed";
			const requestOrigin = new URL(request.url()).origin;
			if ((requestOrigin === origin || expectedExternalOrigins.has(requestOrigin)) && !/ERR_ABORTED|NS_BINDING_ABORTED/i.test(error)) failedRequests.push({ url: request.url(), error });
		});
		page.on("response", async (response) => {
			const url = new URL(response.url());
			if (url.origin !== origin) {
				if (expectedExternalOrigins.has(url.origin) && response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() });
				return;
			}
			const resourceType = response.request().resourceType();
			if (["stylesheet", "script", "image"].includes(resourceType) && response.status() < 400) loadedAssets.add(`${resourceType}:${url.pathname}`);
			if (response.status() >= 400 && !url.pathname.endsWith("/__kirari_p3_not_found__")) {
				badResponses.push({ url: response.url(), status: response.status() });
			}
		});

		const rootResponse = await page.goto(new URL("/", origin).href, { waitUntil: "domcontentloaded" });
		if (rootResponse?.status() !== 200) throw new Error(`Root route returned HTTP ${rootResponse?.status() ?? "no response"}`);
		const robots = requireNoindex(rootResponse, "/");
		await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

		for (const route of contract.routes) {
			const response = await page.goto(new URL(route.path, origin).href, { waitUntil: "domcontentloaded" });
			if (response?.status() !== 200) throw new Error(`Route ${route.path} returned HTTP ${response?.status() ?? "no response"}`);
			const routeRobots = requireNoindex(response, route.path);
			const title = await page.title();
			const bodyText = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
			if (route.title && title !== route.title) throw new Error(`Route ${route.path} title mismatch: ${JSON.stringify(title)}`);
			if (route.content_marker && !bodyText.replace(/\s+/g, "").includes(route.content_marker.replace(/\s+/g, ""))) throw new Error(`Route ${route.path} is missing content marker ${JSON.stringify(route.content_marker)}`);
			await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
			if (contract.assets?.images?.length) {
				await page.locator("img").first().scrollIntoViewIfNeeded().catch(() => {});
				await page.waitForTimeout(200);
			}
			routeResults.push({ path: route.path, status: response.status(), noindex: routeRobots, title, contentMarker: route.content_marker });
		}

		if (contract.navigation) {
			await page.goto(new URL(contract.routes[0].path, origin).href, { waitUntil: "domcontentloaded" });
			const targetUrl = new URL(contract.navigation, `${origin}/`);
			const anchorIndex = await page.locator("a[href]").evaluateAll((anchors, target) => anchors.findIndex((anchor) => {
				try { return new URL(anchor.href).href === target; } catch { return false; }
			}), targetUrl.href);
			if (anchorIndex < 0) throw new Error(`Browser contract navigation link is missing: ${targetUrl.pathname}`);
			await page.locator("a[href]").nth(anchorIndex).click();
			await page.waitForURL((url) => url.href === targetUrl.href, { timeout: 10000 });
		}

		const missingUrl = new URL("/__kirari_p3_not_found__", origin);
		const missingPage = await context.newPage();
		const missingResponse = await missingPage.goto(missingUrl.href, { waitUntil: "domcontentloaded" });
		if (missingResponse?.status() !== 404) throw new Error(`Unknown route returned HTTP ${missingResponse?.status() ?? "no response"}, expected 404`);
		await missingPage.close();
		const requiredAssets = [];
		for (const path of contract.assets.stylesheets ?? []) requiredAssets.push(`stylesheet:${path}`);
		for (const path of contract.assets.scripts ?? []) requiredAssets.push(`script:${path}`);
		const absentAssets = requiredAssets.filter((asset) => !loadedAssets.has(asset));
		if ((contract.assets.images ?? []).length && ![...loadedAssets].some((asset) => asset.startsWith("image:"))) absentAssets.push("image:* (no successful image request)");
		if (absentAssets.length) throw new Error(`Expected browser assets did not load: ${absentAssets.join(", ")}`);
		if (failedRequests.length || badResponses.length) throw new Error(`Browser network failures: ${failedRequests.length} failed requests, ${badResponses.length} error responses`);
		if (externalRequests.length) throw new Error(`Unexpected external browser calls: ${externalRequests.map((item) => item.url).join(", ")}`);
		if (consoleErrors.length || pageErrors.length) throw new Error(`Browser console errors: ${consoleErrors.length + pageErrors.length}`);

		const report = {
			result: "PASS",
			baseUrl: origin,
			noindex: robots,
			routes: routeResults,
			assets: { required: requiredAssets.length, loaded: loadedAssets.size, observed: [...loadedAssets].sort() },
			navigation: contract.navigation || "not-present-in-selected-routes",
			expectedExternalCalls: expectedExternalRequests.length,
			browserConsoleErrors: consoleErrors.length + pageErrors.length,
			failedBrowserRequests: failedRequests.length,
			badResponses: badResponses.length,
			unexpectedExternalCalls: externalRequests.length,
		};
		writeFileSync(args.get("--report"), `${JSON.stringify(report, null, 2)}\n`);
		console.log(JSON.stringify(report, null, 2));
	} catch (error) {
		const report = {
			result: "FAIL",
			baseUrl: origin,
			routes: routeResults,
			browserConsoleErrors: consoleErrors,
			pageErrors,
			failedBrowserRequests: failedRequests,
			badResponses,
			unexpectedExternalCalls: externalRequests,
			expectedExternalCalls: expectedExternalRequests.length,
			localMissingPaths: local?.missingPaths ?? [],
			error: error.message,
		};
		writeFileSync(args.get("--report"), `${JSON.stringify(report, null, 2)}\n`);
		console.error(JSON.stringify(report, null, 2));
		process.exitCode = 1;
	} finally {
		await context?.close();
		await browser?.close();
		if (local) await new Promise((done) => local.server.close(done));
	}
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
