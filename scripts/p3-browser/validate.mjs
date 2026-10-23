#!/usr/bin/env node

import { createServer } from "node:http";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { chromium } from "playwright";
import { browserContract } from "./contract.mjs";
import { validateBrowserPages } from "./browser-health.mjs";
import { createRequestHandler, expectedExternalOrigins } from "./request-routing.mjs";
import { deriveStaticIndexingPolicy, staticFileInventory } from "../static-site-validation.mjs";
import { createFixtureIconResolver } from "./fixture-icons.mjs";

function argumentsMap(args) {
	const values = new Map();
	for (let i = 0; i < args.length; i += 1) {
		const key = args[i];
		if (!["--mode", "--base-url", "--dist-root", "--report", "--canonical-origin", "--indexable"].includes(key) || values.has(key)) throw new Error(`Unknown or repeated option: ${key}`);
		const value = args[++i];
		if (!value || value.startsWith("--")) throw new Error(`Missing value for ${key}`);
		values.set(key, value);
	}
	const mode = values.get("--mode") ?? "preview";
	if (!values.has("--report") || !values.has("--dist-root") || !["preview", "production"].includes(mode)) throw new Error("Usage: validate.mjs --dist-root <matching local output> --report <file> [--base-url <https origin>] [--mode preview|production --canonical-origin <https origin> --indexable true|false]");
	if (mode === "production" ? !values.has("--canonical-origin") : values.has("--canonical-origin") || values.has("--indexable")) throw new Error("Canonical origin and indexing policy are Production browser options");
	if (values.has("--indexable") && !["true", "false"].includes(values.get("--indexable"))) throw new Error("--indexable must be true or false");
	if (values.has("--base-url")) {
		const url = new URL(values.get("--base-url"));
		if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash) throw new Error("Live base URL must be a plain HTTPS origin");
	}
	values.set("--mode", mode);
	return values;
}

function serveStatic(dist, indexable) {
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
		response.writeHead(200, { "Content-Type": types[extname(file).toLowerCase()] ?? "application/octet-stream", ...(indexable ? {} : { "X-Robots-Tag": "noindex" }) });
		response.end(readFileSync(file));
	});
	return new Promise((resolveServer, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => resolveServer({ server, missingPaths, url: `http://127.0.0.1:${server.address().port}` }));
	});
}

async function main() {
	const args = argumentsMap(process.argv.slice(2));
	const mode = args.get("--mode");
	const production = mode === "production";
	const distRoot = resolve(args.get("--dist-root"));
	staticFileInventory(distRoot);
	const contract = browserContract(distRoot);
	const indexingPolicy = production ? deriveStaticIndexingPolicy({
		staticRoot: distRoot,
		canonicalOrigin: args.get("--canonical-origin"),
		indexable: args.get("--indexable") === "true",
	}) : undefined;
	const local = args.has("--base-url") ? undefined : await serveStatic(distRoot, indexingPolicy?.indexable ?? false);
	const fixtureIconResolver = local ? createFixtureIconResolver() : undefined;
	const origin = new URL(args.get("--base-url") ?? local.url).origin;
	const failedRequests = [];
	const externalRequests = [];
	const expectedExternalRequests = [];
	const badResponses = [];
	const loadedAssets = new Set();
	let routeResults = [];
	let browser;
	let context;
	let validationComplete = false;
	let consoleErrorCount = 0;
	let pageErrorCount = 0;
	try {
		browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
		context = await browser.newContext({ serviceWorkers: "block" });
		const page = await context.newPage();
		const requestHandler = createRequestHandler({
			deploymentOrigin: origin,
			fixtureIconResolver,
			onExpectedExternal: (request) => expectedExternalRequests.push(request),
			onUnexpectedExternal: (request) => externalRequests.push(request),
			onRequestFailure: (request) => {
				if (!validationComplete) failedRequests.push({ ...request, error: "route fetch failed" });
			},
		});
		await context.route("**/*", requestHandler);
		page.on("console", (message) => {
			if (message.type() !== "error") return;
			try {
				if (new URL(message.location().url).pathname.endsWith("/__kirari_p3_not_found__")) return;
			} catch {}
			consoleErrorCount += 1;
		});
		page.on("pageerror", () => { pageErrorCount += 1; });
		page.on("requestfailed", (request) => {
			const error = request.failure()?.errorText ?? "failed";
			const requestOrigin = new URL(request.url()).origin;
			if ((requestOrigin === origin || expectedExternalOrigins.has(requestOrigin)) && !/ERR_ABORTED|NS_BINDING_ABORTED/i.test(error)) failedRequests.push({ url: request.url(), resourceType: request.resourceType(), errorCode: /(?:net::)?(ERR_[A-Z_]+)/.exec(error)?.[1] ?? "BROWSER_REQUEST_FAILED" });
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

		const { rootRobots: robots, routeResults: validatedRoutes, requiredAssets } = await validateBrowserPages({
			page,
			context,
			origin,
			contract,
			mode,
			indexingPolicy,
			loadedAssets,
		});
		routeResults = validatedRoutes;
		if (failedRequests.length || badResponses.length) throw new Error(`Browser network failures: ${failedRequests.length} failed requests, ${badResponses.length} error responses`);
		if (externalRequests.length) throw new Error(`Unexpected external browser calls: ${externalRequests.map((item) => item.url).join(", ")}`);
		if (consoleErrorCount || pageErrorCount) throw new Error(`Browser console errors: ${consoleErrorCount + pageErrorCount}`);

		validationComplete = true;
		const report = {
			result: "PASS",
			mode,
			baseUrl: origin,
			providerDeploymentIdentityVerified: false,
			byteEquality: "NOT_CHECKED",
			externalTransport: local ? "NOT_CHECKED" : "OBSERVED_BROWSER_REQUESTS",
			...(fixtureIconResolver ? { fixtureIcons: fixtureIconResolver.provenance() } : {}),
			...(production ? {
				canonicalOrigin: indexingPolicy.canonicalOrigin,
				indexable: indexingPolicy.indexable,
				canonicalDocuments: indexingPolicy.canonicalDocuments,
				robotsSitemapCount: indexingPolicy.robotsSitemapCount,
			} : { noindex: robots }),
			routes: routeResults,
			assets: { required: requiredAssets.length, loaded: loadedAssets.size, observed: [...loadedAssets].sort() },
			navigation: contract.navigation || "not-present-in-selected-routes",
			expectedExternalCalls: expectedExternalRequests.length,
			browserConsoleErrors: consoleErrorCount,
			pageErrors: pageErrorCount,
			failedBrowserRequests: failedRequests.length,
			badResponses: badResponses.length,
			unexpectedExternalCalls: externalRequests.length,
		};
		writeFileSync(args.get("--report"), `${JSON.stringify(report, null, 2)}\n`);
		console.log(JSON.stringify(report, null, 2));
		await page.close().catch(() => {});
		await requestHandler.waitForIdle();
	} catch (error) {
		const report = {
			result: "FAIL",
			mode,
			baseUrl: origin,
			providerDeploymentIdentityVerified: false,
			routes: routeResults,
			externalTransport: local ? "NOT_CHECKED" : "OBSERVED_BROWSER_REQUESTS",
			...(fixtureIconResolver ? { fixtureIcons: fixtureIconResolver.provenance() } : {}),
			browserConsoleErrors: consoleErrorCount,
			pageErrors: pageErrorCount,
			failedBrowserRequests: failedRequests.length,
			badResponses: badResponses.length,
			unexpectedExternalCalls: externalRequests.length,
			localMissingPaths: local?.missingPaths ?? [],
			networkFailures: failedRequests.map((request) => ({ origin: new URL(request.url).origin, path: new URL(request.url).pathname, resourceType: request.resourceType, errorCode: request.errorCode ?? "ROUTE_FETCH_FAILED" })),
			errorCode: error.code ?? "SITE_BROWSER_VALIDATION_FAILED",
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

main().catch((error) => {
	const report = { result: "FAIL", providerDeploymentIdentityVerified: false, errorCode: error.code ?? "SITE_BROWSER_SETUP_FAILED" };
	const reportIndex = process.argv.indexOf("--report");
	if (reportIndex >= 0 && process.argv[reportIndex + 1]) {
		try { writeFileSync(process.argv[reportIndex + 1], `${JSON.stringify(report, null, 2)}\n`); } catch {}
	}
	console.error(JSON.stringify(report));
	process.exitCode = 1;
});
