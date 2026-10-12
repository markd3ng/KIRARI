#!/usr/bin/env node

import { createServer } from "node:http";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { chromium } from "playwright";
import { browserContract } from "./contract.mjs";
import { validateBrowserPages } from "./browser-health.mjs";
import { requestGithubOidcToken } from "./github-oidc.mjs";
import { createTrustedRequestHandler, expectedExternalOrigins } from "./request-routing.mjs";
import {
	assertProductionDeployment,
	deriveProductionIndexingPolicy,
	ProductionValidationError,
	verifyDeployedStaticOutput,
} from "../p4-production/production-validation.mjs";

function argumentsMap(args) {
	const values = new Map();
	for (let i = 0; i < args.length; i += 1) {
		const key = args[i];
		if (!["--mode", "--phase", "--base-url", "--dist-root", "--manifest", "--report", "--binding", "--deployment", "--aliases", "--static-root", "--prior-release-record"].includes(key) || values.has(key)) throw new Error(`Unknown or repeated option: ${key}`);
		const value = args[++i];
		if (!value || value.startsWith("--")) throw new Error(`Missing value for ${key}`);
		values.set(key, value);
	}
	const mode = values.get("--mode") ?? "preview";
	const phase = values.get("--phase");
	const hasBaseUrl = values.has("--base-url");
	const hasDistRoot = values.has("--dist-root");
	const hasManifest = values.has("--manifest");
	const productionInputs = ["--binding", "--deployment", "--aliases", "--static-root"];
	if (!values.has("--report") || !["preview", "production"].includes(mode)) throw new Error("Usage: validate.mjs [--mode preview|production] --report <file> ...");
	if (mode === "preview" && (phase || hasBaseUrl === hasDistRoot || (hasBaseUrl && !hasManifest) || (hasDistRoot && hasManifest) || productionInputs.some((key) => values.has(key)) || values.has("--prior-release-record"))) {
		throw new Error("Usage: validate.mjs --report <file> (--base-url <url> --manifest <file> | --dist-root <dir>)");
	}
	if (mode === "production" && (!hasBaseUrl || !hasManifest || !["staged", "live", "restore"].includes(phase) || hasDistRoot || productionInputs.some((key) => !values.has(key)) || (phase === "restore" ? !values.has("--prior-release-record") : values.has("--prior-release-record")))) {
		throw new Error("Usage: validate.mjs --mode production --phase staged|live|restore --base-url <origin> --manifest <file> --binding <file> --deployment <file> --aliases <file> --static-root <dir> [--prior-release-record <file>] --report <file>");
	}
	values.set("--mode", mode);
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

async function main() {
	const args = argumentsMap(process.argv.slice(2));
	const mode = args.get("--mode");
	const production = mode === "production";
	const phase = args.get("--phase");
	const distRoot = args.get("--dist-root") ? resolve(args.get("--dist-root")) : undefined;
	const manifest = args.get("--manifest") ? JSON.parse(readFileSync(args.get("--manifest"), "utf8")) : undefined;
	const contract = manifest?.browser_contract ?? browserContract(distRoot);
	const local = distRoot ? await serveStatic(distRoot) : undefined;
	const baseUrl = new URL(args.get("--base-url") ?? local.url);
	if (!(production ? baseUrl.protocol === "https:" : /^https?:$/.test(baseUrl.protocol)) || baseUrl.username || baseUrl.password || (production && baseUrl.port) || baseUrl.pathname !== "/" || baseUrl.search || baseUrl.hash) throw new Error("Base URL must be a plain HTTP(S) origin");
	const origin = baseUrl.origin;
	let productionContext;
	let productionPolicy;
	let byteVerification;
	if (production) {
		const binding = JSON.parse(readFileSync(args.get("--binding"), "utf8"));
		const deployment = JSON.parse(readFileSync(args.get("--deployment"), "utf8"));
		const aliasesDocument = JSON.parse(readFileSync(args.get("--aliases"), "utf8"));
		const aliases = Array.isArray(aliasesDocument) ? aliasesDocument : aliasesDocument.aliasBindings;
		const priorReleaseRecord = args.has("--prior-release-record") ? JSON.parse(readFileSync(args.get("--prior-release-record"), "utf8")) : undefined;
		productionContext = assertProductionDeployment({ baseUrl: origin, binding, deployment, aliasBindings: aliases, phase, priorReleaseRecord });
		productionPolicy = deriveProductionIndexingPolicy({
			staticRoot: resolve(args.get("--static-root")),
			canonicalOrigin: productionContext.target.canonical_origin,
			domains: productionContext.target.domains,
		});
	}
	const VERCEL_TRUSTED_OIDC_TOKEN = distRoot ? undefined : await requestGithubOidcToken();
	if (production) {
		byteVerification = await verifyDeployedStaticOutput({
			staticRoot: resolve(args.get("--static-root")),
			baseUrl: origin,
			oidcToken: VERCEL_TRUSTED_OIDC_TOKEN,
		});
	}
	const consoleErrors = [];
	const pageErrors = [];
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
		const trustedRequestHandler = createTrustedRequestHandler({
			deploymentOrigin: origin,
			oidcToken: VERCEL_TRUSTED_OIDC_TOKEN,
			onExpectedExternal: (request) => expectedExternalRequests.push(request),
			onUnexpectedExternal: (request) => externalRequests.push(request),
			onRequestFailure: (request) => {
				if (!validationComplete) failedRequests.push({ ...request, error: "route fetch failed" });
			},
		});
		await context.route("**/*", trustedRequestHandler);
		page.on("console", (message) => {
			if (message.type() !== "error") return;
			try {
				if (new URL(message.location().url).pathname.endsWith("/__kirari_p3_not_found__")) return;
			} catch {}
			consoleErrorCount += 1;
			if (!production) consoleErrors.push(message.text());
		});
		page.on("pageerror", (error) => { pageErrorCount += 1; if (!production) pageErrors.push(error.message); });
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

		const { rootRobots: robots, routeResults: validatedRoutes, requiredAssets } = await validateBrowserPages({
			page,
			context,
			origin,
			contract,
			mode,
			productionPolicy,
			loadedAssets,
		});
		routeResults = validatedRoutes;
		if (failedRequests.length || badResponses.length) throw new Error(`Browser network failures: ${failedRequests.length} failed requests, ${badResponses.length} error responses`);
		if (externalRequests.length) throw new Error(`Unexpected external browser calls: ${externalRequests.map((item) => item.url).join(", ")}`);
		if (consoleErrorCount || pageErrorCount) throw new Error(`Browser console errors: ${consoleErrorCount + pageErrorCount}`);

		validationComplete = true;
		const report = production ? {
			result: "PASS",
			mode,
			phase,
			baseUrl: origin,
			canonicalOrigin: productionPolicy.canonicalOrigin,
			indexable: productionPolicy.indexable,
			canonicalDocuments: productionPolicy.canonicalDocuments,
			robotsSitemapCount: productionPolicy.robotsSitemapCount,
			routes: routeResults.length,
			assets: { required: requiredAssets.length, loaded: loadedAssets.size },
			expectedExternalCalls: expectedExternalRequests.length,
			browserConsoleErrors: consoleErrorCount,
			pageErrors: pageErrorCount,
			failedBrowserRequests: failedRequests.length,
			badResponses: badResponses.length,
			unexpectedExternalCalls: externalRequests.length,
			...byteVerification,
		} : {
			result: "PASS",
			mode,
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
		await page.close().catch(() => {});
		await trustedRequestHandler.waitForIdle();
	} catch (error) {
		const report = production ? {
			result: "FAIL",
			mode,
			phase,
			baseUrl: origin,
			canonicalOrigin: productionPolicy?.canonicalOrigin,
			indexable: productionPolicy?.indexable ?? false,
			browserConsoleErrors: consoleErrorCount,
			pageErrors: pageErrorCount,
			failedBrowserRequests: failedRequests.length,
			badResponses: badResponses.length,
			unexpectedExternalCalls: externalRequests.length,
			errorCode: error instanceof ProductionValidationError ? error.code : "PRODUCTION_BROWSER_VALIDATION_FAILED",
		} : {
			result: "FAIL",
			mode,
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

main().catch((error) => {
	const args = process.argv.slice(2);
	if (args.includes("--mode") && args[args.indexOf("--mode") + 1] === "production") {
		const reportIndex = args.indexOf("--report");
		if (reportIndex >= 0 && args[reportIndex + 1]) {
			let baseUrl = "";
			const baseUrlIndex = args.indexOf("--base-url");
			if (baseUrlIndex >= 0) {
				try { baseUrl = new URL(args[baseUrlIndex + 1]).origin; } catch {}
			}
			const report = {
				result: "FAIL",
				mode: "production",
				phase: args.includes("--phase") ? args[args.indexOf("--phase") + 1] : undefined,
				baseUrl,
				canonicalOrigin: undefined,
				indexable: false,
				browserConsoleErrors: 0,
				pageErrors: 0,
				failedBrowserRequests: 0,
				badResponses: 0,
				unexpectedExternalCalls: 0,
				errorCode: error instanceof ProductionValidationError ? error.code : "PRODUCTION_VALIDATION_SETUP_FAILED",
			};
			try { writeFileSync(args[reportIndex + 1], `${JSON.stringify(report, null, 2)}\n`); } catch {}
			console.error(JSON.stringify(report, null, 2));
		} else {
			console.error("{\"result\":\"FAIL\",\"mode\":\"production\",\"errorCode\":\"PRODUCTION_VALIDATION_SETUP_FAILED\"}");
		}
	} else {
		console.error(error.message);
	}
	process.exitCode = 1;
});
