#!/usr/bin/env node

import { createRequire } from "node:module";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { validateBrowserPages } from "./browser-health.mjs";
import { expectedExternalOrigins } from "./request-routing.mjs";
import {
	assertProductionAuthorizationBinding,
	assertProductionBrowserReport,
	assertProductionDeployment,
	deriveProductionIndexingPolicy,
	verifyDeployedStaticOutput,
} from "../p4-production/production-validation.mjs";
import { normalizeProductionBinding, PRODUCTION_WORKFLOW_PATH } from "../production-authorization.mjs";

const require = createRequire(new URL("./package.json", import.meta.url));
const { chromium } = require("playwright");
let fixtureStage = "setup";
let fixtureMetrics;

function cliArgs(args) {
	const values = new Map();
	for (let index = 0; index < args.length; index += 1) {
		const name = args[index];
		if (!["--static-root", "--manifest", "--canonical-origin"].includes(name) || values.has(name)) throw new Error("Expected --static-root, --manifest, and --canonical-origin");
		const value = args[++index];
		if (!value || value.startsWith("--")) throw new Error("Expected --static-root, --manifest, and --canonical-origin");
		values.set(name, value);
	}
	if (["--static-root", "--manifest", "--canonical-origin"].some((key) => !values.has(key))) throw new Error("Expected --static-root, --manifest, and --canonical-origin");
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

function testBinding(manifest, canonicalOrigin, extraDomain) {
	const canonicalHost = new URL(canonicalOrigin).hostname;
	const domains = [...new Set([canonicalHost, extraDomain])].sort();
	const sourceRun = manifest.upstream_github_artifact.run_id;
	const sourceAttempt = Number(manifest.upstream_github_artifact.run_attempt);
	return normalizeProductionBinding({
		schema_version: 1,
		repository: "markd3ng/KIRARI",
		workflow_path: PRODUCTION_WORKFLOW_PATH,
		workflow_sha: manifest.core.resolved_sha,
		main_sha: manifest.core.resolved_sha,
		issued_at: 1_799_000_000,
		nonce: "1234567890abcdef1234567890abcdef",
		source: { run_id: String(sourceRun), run_attempt: sourceAttempt, sha: manifest.core.resolved_sha },
		package: { artifact_id: "11297428920", archive_digest: `sha256:${"1".repeat(64)}` },
		composition: { core_sha: manifest.core.resolved_sha, site_sha: manifest.site.resolved_sha },
		target: {
			team_id: "team_FixtureProduction",
			project: "kirari-main",
			project_id: "prj_FixtureProduction",
			environment: "production",
			domains,
			canonical_origin: canonicalOrigin,
			current_deployment_id: "dpl_fixturePrevious",
			operation: "deploy",
		},
		rollback_record: null,
	});
}

async function main() {
	const args = cliArgs(process.argv.slice(2));
	const staticRoot = resolve(args.get("--static-root"));
	const manifest = JSON.parse(readFileSync(resolve(args.get("--manifest")), "utf8"));
	const canonicalOrigin = new URL(args.get("--canonical-origin")).origin;
	if (!manifest.browser_contract || !manifest.core || !manifest.site || !manifest.upstream_github_artifact) throw new Error("Package manifest is incomplete");
	const projectDomain = "kirari-main.vercel.app";
	const binding = testBinding(manifest, canonicalOrigin, projectDomain);
	const target = assertProductionAuthorizationBinding(binding);
	fixtureStage = "deployment-preflight";
	const deployment = {
		id: "dpl_fixtureCurrent",
		url: "kirari-main-production-fixture.vercel.app",
		projectId: target.project_id,
		target: "production",
		readyState: "READY",
	};
	const baseUrl = `https://${deployment.url}`;
	const aliases = target.domains.map((domain) => ({ domain, deployment_id: target.current_deployment_id }));
	const context = assertProductionDeployment({ baseUrl, binding, deployment, aliasBindings: aliases, phase: "staged" });
	fixtureStage = "immutable-policy-and-byte-check";
	const policy = deriveProductionIndexingPolicy({ staticRoot, canonicalOrigin, domains: target.domains });
	const contract = manifest.browser_contract;
	const fixtureOrigin = baseUrl;
	const byteVerification = await verifyDeployedStaticOutput({
		staticRoot,
		baseUrl,
		oidcToken: "local-browser-fixture-token",
		fetchImpl: async (url, options) => {
			if (url.origin !== fixtureOrigin || options.headers["x-vercel-trusted-oidc-idp-token"] !== "local-browser-fixture-token") return new Response(null, { status: 403 });
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
				await requestRoute.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ prefix: "mdi", icons: {} }) });
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
		await requestRoute.fulfill({ status: 200, headers: { "content-type": mimeType(file) }, body: readFileSync(file) });
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
			productionPolicy: policy,
			loadedAssets,
		});
		if (Object.values(counters).some((value) => value !== 0)) throw new Error("Fixture browser reported a failed request, response, or browser error");

		const report = assertProductionBrowserReport({
			result: "PASS",
			mode: "production",
			phase: context.phase,
			baseUrl,
			canonicalOrigin: policy.canonicalOrigin,
			indexable: true,
			canonicalDocuments: policy.canonicalDocuments,
			robotsSitemapCount: policy.robotsSitemapCount,
			routes: routeResults.length,
			assets: { required: requiredAssets.length, loaded: loadedAssets.size },
			expectedExternalCalls: expectedExternal.size,
			...counters,
			...byteVerification,
		});
		console.log(JSON.stringify({ result: "PASS", fixture: "local-real-chromium-production", report }, null, 2));
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
			fixture: "local-real-chromium-production",
			stage: fixtureStage,
			errorCode: error.code ?? "PRODUCTION_BROWSER_FIXTURE_FAILED",
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
