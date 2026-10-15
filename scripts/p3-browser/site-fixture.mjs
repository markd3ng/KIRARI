#!/usr/bin/env node

import { createRequire } from "node:module";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { validateBrowserPages } from "./browser-health.mjs";
import { expectedExternalOrigins } from "./request-routing.mjs";
import { deriveStaticIndexingPolicy, compareStaticOutput } from "../static-site-validation.mjs";
import { browserContract } from "./contract.mjs";
import { createFixtureIconResolver } from "./fixture-icons.mjs";

const require = createRequire(new URL("./package.json", import.meta.url));
const { chromium } = require("playwright");
let fixtureStage = "setup";
let fixtureMetrics;

function cliArgs(args) {
	const values = new Map();
	for (let index = 0; index < args.length; index += 1) {
		const name = args[index];
		if (!["--dist-root", "--canonical-origin", "--indexable"].includes(name) || values.has(name)) throw new Error("Expected --dist-root, --canonical-origin and optional --indexable true|false");
		const value = args[++index];
		if (!value || value.startsWith("--")) throw new Error("Expected --dist-root, --canonical-origin and optional --indexable true|false");
		values.set(name, value);
	}
	if (["--dist-root", "--canonical-origin"].some((key) => !values.has(key))) throw new Error("Expected --dist-root, --canonical-origin and optional --indexable true|false");
	if (values.has("--indexable") && !["true", "false"].includes(values.get("--indexable"))) throw new Error("--indexable must be true or false");
	return values;
}

function mimeType(path) {
	return ({
		".css": "text/css",
		".html": "text/html; charset=utf-8",
		".js": "text/javascript",
		".json": "application/json",
		".mjs": "text/javascript",
		".svg": "image/svg+xml",
		".txt": "text/plain",
		".webp": "image/webp",
		".png": "image/png",
		".jpg": "image/jpeg",
		".jpeg": "image/jpeg",
		".woff": "font/woff",
		".woff2": "font/woff2",
		".ttf": "font/ttf",
	})[extname(path).toLowerCase()] ?? "application/octet-stream";
}

function fixtureFile(staticRoot, pathname) {
	let decoded;
	try { decoded = decodeURIComponent(pathname); } catch { return undefined; }
	if (!decoded.startsWith("/") || decoded.includes("\\") || decoded.split("/").some((part) => part === "..")) return undefined;
	const relativePath = decoded.slice(1);
	const candidates = relativePath.endsWith("/")
		? [join(staticRoot, relativePath, "index.html")]
		: [join(staticRoot, relativePath), join(staticRoot, relativePath, "index.html"), join(staticRoot, `${relativePath}.html`)];
	for (const candidate of candidates) {
		const absolute = resolve(candidate);
		if (absolute !== staticRoot && !absolute.startsWith(`${staticRoot}${sep}`)) continue;
		if (existsSync(absolute) && statSync(absolute).isFile()) return absolute;
	}
	return undefined;
}

async function main() {
	const args = cliArgs(process.argv.slice(2));
	const staticRoot = resolve(args.get("--dist-root"));
	const policy = deriveStaticIndexingPolicy({ staticRoot, canonicalOrigin: args.get("--canonical-origin"), indexable: args.get("--indexable") === "true" });
	const contract = browserContract(staticRoot);
	const fixtureOrigin = "https://browser-fixture.invalid";
	const fixtureIconResolver = createFixtureIconResolver();
	fixtureStage = "static-policy-and-byte-check";
	const byteVerification = await compareStaticOutput({
		staticRoot,
		baseUrl: fixtureOrigin,
		fetchImpl: async (url) => {
			if (url.origin !== fixtureOrigin) return new Response(null, { status: 403 });
			const file = fixtureFile(staticRoot, url.pathname);
			return file ? new Response(readFileSync(file), { status: 200 }) : new Response(null, { status: 404 });
		},
	});

	const counters = { browserConsoleErrors: 0, pageErrors: 0, failedBrowserRequests: 0, badResponses: 0, unexpectedExternalCalls: 0 };
	const expectedExternal = new Set();
	const loadedAssets = new Set();
	const consoleErrorKinds = [];
	const consoleErrorPaths = [];
	fixtureMetrics = { counters, expectedExternal, loadedAssets, consoleErrorKinds, consoleErrorPaths };
	const route = async (requestRoute) => {
		const request = requestRoute.request();
		const url = new URL(request.url());
		if (url.origin !== fixtureOrigin) {
			if (expectedExternalOrigins.has(url.origin)) {
				expectedExternal.add(url.origin);
				try {
					const icons = fixtureIconResolver(url.href, request.method());
					await requestRoute.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(icons) });
				} catch {
					counters.failedBrowserRequests += 1;
					await requestRoute.abort("failed").catch(() => {});
				}
			} else {
				counters.unexpectedExternalCalls += 1;
				await requestRoute.abort("blockedbyclient").catch(() => {});
			}
			return;
		}
		const file = fixtureFile(staticRoot, url.pathname);
		if (!file) {
			await requestRoute.fulfill({ status: 404, headers: { "content-type": "text/plain" }, body: "Not Found" });
			return;
		}
		await requestRoute.fulfill({ status: 200, headers: { "content-type": mimeType(file), ...(policy.indexable ? {} : { "x-robots-tag": "noindex" }) }, body: readFileSync(file) });
	};
	const browser = await chromium.launch({ headless: true });
	fixtureStage = "browser-route-checks";
	try {
		const browserContext = await browser.newContext({ serviceWorkers: "block", ignoreHTTPSErrors: true });
		await browserContext.route("**/*", route);
		const page = await browserContext.newPage();
		page.on("console", (message) => {
			if (message.type() !== "error") return;
			try {
				if (new URL(message.location().url).pathname.endsWith("/__kirari_p3_not_found__")) return;
			} catch {}
			counters.browserConsoleErrors += 1;
			const text = message.text().toLowerCase();
			consoleErrorKinds.push(text.includes("failed to load resource") ? "resource-load" : text.includes("failed to fetch") ? "fetch" : text.includes("content security policy") ? "csp" : "site-console");
			try { consoleErrorPaths.push(new URL(message.location().url).pathname); } catch { consoleErrorPaths.push("unknown"); }
		});
		page.on("pageerror", () => { counters.pageErrors += 1; });
		page.on("requestfailed", (request) => {
			if (!/ERR_ABORTED|NS_BINDING_ABORTED/i.test(request.failure()?.errorText ?? "")) counters.failedBrowserRequests += 1;
		});
		page.on("response", (response) => {
			const url = new URL(response.url());
			if (url.origin !== fixtureOrigin) {
				if (expectedExternalOrigins.has(url.origin) && response.status() >= 400) counters.badResponses += 1;
				return;
			}
			const resourceType = response.request().resourceType();
			if (["stylesheet", "script", "image"].includes(resourceType) && response.status() < 400) loadedAssets.add(`${resourceType}:${url.pathname}`);
			if (response.status() >= 400 && !url.pathname.endsWith("/__kirari_p3_not_found__")) counters.badResponses += 1;
		});

		const { routeResults, requiredAssets } = await validateBrowserPages({
			page,
			context: browserContext,
			origin: fixtureOrigin,
			contract,
			mode: "production",
			indexingPolicy: policy,
			loadedAssets,
		});
		if (Object.values(counters).some((value) => value !== 0)) throw new Error("Fixture browser reported a failed request, response, or browser error");

		const report = {
			result: "PASS",
			mode: "production",
			baseUrl: fixtureOrigin,
			providerDeploymentIdentityVerified: false,
			externalTransport: "NOT_CHECKED",
			fixtureIcons: fixtureIconResolver.provenance(),
			canonicalOrigin: policy.canonicalOrigin,
			indexable: policy.indexable,
			canonicalDocuments: policy.canonicalDocuments,
			robotsSitemapCount: policy.robotsSitemapCount,
			routes: routeResults.length,
			assets: { required: requiredAssets.length, loaded: loadedAssets.size },
			expectedExternalCalls: expectedExternal.size,
			...counters,
			...byteVerification,
		};
		console.log(JSON.stringify({ result: "PASS", fixture: "local-real-chromium-site", report }, null, 2));
		fixtureStage = "complete";
		await browserContext.close();
	} finally {
		await browser.close();
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	main().catch((error) => {
		console.error(JSON.stringify({
			result: "FAIL",
			fixture: "local-real-chromium-site",
			stage: fixtureStage,
			errorCode: error.code ?? "SITE_BROWSER_FIXTURE_FAILED",
			metrics: fixtureMetrics ? {
				...fixtureMetrics.counters,
				expectedExternalCalls: fixtureMetrics.expectedExternal.size,
				loadedAssets: fixtureMetrics.loadedAssets.size,
				consoleErrorKinds: fixtureMetrics.consoleErrorKinds,
				consoleErrorPaths: fixtureMetrics.consoleErrorPaths,
			} : undefined,
		}));
		process.exitCode = 1;
	});
}
