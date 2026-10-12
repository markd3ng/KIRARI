import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { parse as parseHtml } from "parse5";
import { headersForRequest } from "../p3-browser/request-routing.mjs";
import { normalizeProductionBinding } from "../production-authorization.mjs";

const SHA1 = /^[a-f0-9]{40}$/;
const SHA256 = /^sha256:[a-f0-9]{64}$/;
const DEPLOYMENT_ID = /^dpl_[A-Za-z0-9]+$/;
const MAX_FILES = 20_000;
const MAX_FILE_BYTES = 128 * 1024 * 1024;
const MAX_TOTAL_BYTES = 1024 * 1024 * 1024;

export class ProductionValidationError extends Error {
	constructor(code) {
		super(code);
		this.name = "ProductionValidationError";
		this.code = code;
	}
}

function fail(code) {
	throw new ProductionValidationError(code);
}

function plainHttpsOrigin(value, code) {
	let url;
	try { url = new URL(value); } catch { fail(code); }
	if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash) fail(code);
	return url.origin;
}

function canonicalDomain(value) {
	if (typeof value !== "string" || value.length > 253 || value !== value.toLowerCase() || /[\s*:/?#@]/.test(value)) fail("INVALID_PRODUCTION_DOMAIN");
	const labels = value.split(".");
	if (labels.length < 2 || labels.some((label) => label.length < 1 || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) fail("INVALID_PRODUCTION_DOMAIN");
	let url;
	try { url = new URL(`https://${value}`); } catch { fail("INVALID_PRODUCTION_DOMAIN"); }
	if (url.hostname !== value || url.port || url.pathname !== "/" || url.search || url.hash) fail("INVALID_PRODUCTION_DOMAIN");
	return value;
}

export function assertProductionAuthorizationBinding(binding) {
	let normalized;
	try { normalized = normalizeProductionBinding(binding); } catch { fail("INVALID_AUTHORIZATION_BINDING"); }
	const target = normalized.target;
	const domains = target.domains.map(canonicalDomain);
	const canonicalOrigin = plainHttpsOrigin(target.canonical_origin, "INVALID_PRODUCTION_TARGET");
	const canonicalHost = new URL(canonicalOrigin).hostname;
	if (!domains.includes(canonicalHost)) fail("INVALID_PRODUCTION_TARGET");
	return {
		project: target.project,
		project_id: target.project_id,
		team_id: target.team_id,
		environment: target.environment,
		domains,
		canonical_origin: canonicalOrigin,
		current_deployment_id: target.current_deployment_id,
		operation: target.operation,
	};
}

export function assertProductionTargetSnapshot({ binding, project, domains, currentDeployment }) {
	const target = assertProductionAuthorizationBinding(binding);
	if (!project || project.id !== target.project_id || project.name !== target.project || project.accountId !== target.team_id) fail("PRODUCTION_PROJECT_SNAPSHOT_MISMATCH");
	if (!Array.isArray(domains)) fail("PRODUCTION_DOMAIN_SNAPSHOT_INVALID");
	const actualDomains = domains.map((item) => canonicalDomain(typeof item === "string" ? item : item?.name));
	if (JSON.stringify(actualDomains.sort()) !== JSON.stringify([...target.domains].sort())) fail("PRODUCTION_DOMAIN_SNAPSHOT_MISMATCH");
	if (target.current_deployment_id === null) {
		if (currentDeployment !== null) fail("PRODUCTION_CURRENT_DEPLOYMENT_MISMATCH");
	} else if (!currentDeployment || currentDeployment.id !== target.current_deployment_id || currentDeployment.projectId !== target.project_id || currentDeployment.target !== "production" || currentDeployment.readyState !== "READY") {
		fail("PRODUCTION_CURRENT_DEPLOYMENT_MISMATCH");
	}
	return { target, currentDeploymentId: target.current_deployment_id };
}

export function assertProductionDeployment({ baseUrl, binding, deployment, aliasBindings, phase = "live", priorReleaseRecord }) {
	const target = assertProductionAuthorizationBinding(binding);
	if (!["staged", "live", "restore"].includes(phase)) fail("INVALID_PRODUCTION_VALIDATION_PHASE");
	const origin = plainHttpsOrigin(baseUrl, "INVALID_PRODUCTION_BASE_URL");
	if (!deployment || !DEPLOYMENT_ID.test(deployment.id ?? "") || (phase !== "restore" && target.current_deployment_id && deployment.id === target.current_deployment_id)) fail("PRODUCTION_DEPLOYMENT_ID_MISMATCH");
	if (deployment.projectId !== target.project_id || deployment.target !== "production" || deployment.readyState !== "READY") fail("PRODUCTION_DEPLOYMENT_IDENTITY_MISMATCH");
	const deploymentUrl = plainHttpsOrigin(`https://${deployment.url ?? ""}`, "INVALID_PRODUCTION_DEPLOYMENT_URL");
	const deploymentHostname = new URL(deploymentUrl).hostname;
	if (!deploymentHostname.startsWith(`${target.project}-`) || !deploymentHostname.endsWith(".vercel.app")) fail("INVALID_PRODUCTION_DEPLOYMENT_URL");
	if (phase === "staged" && origin !== deploymentUrl) fail("PRODUCTION_STAGED_BASE_URL_MISMATCH");
	if (phase !== "staged" && origin !== target.canonical_origin) fail("PRODUCTION_BASE_URL_MISMATCH");
	if (phase === "restore") {
		const restored = priorReleaseRecord?.target;
		if (priorReleaseRecord?.kind !== "kirari-production-release" || priorReleaseRecord.result !== "PASS" || restored?.deployment_id !== deployment.id || restored.project_id !== target.project_id || restored.team_id !== target.team_id || restored.canonical_origin !== target.canonical_origin || !Array.isArray(restored.domains) || JSON.stringify([...restored.domains].sort()) !== JSON.stringify([...target.domains].sort())) fail("PRODUCTION_RESTORE_RECORD_MISMATCH");
	}
	if (!Array.isArray(aliasBindings)) fail("INVALID_PRODUCTION_ALIASES");
	const actualAliases = aliasBindings.map((item) => {
		if (!item || typeof item !== "object") fail("INVALID_PRODUCTION_ALIASES");
		const domain = canonicalDomain(item.domain);
		const expectedDeployment = phase === "staged" ? target.current_deployment_id : deployment.id;
		if (item.deployment_id !== expectedDeployment) fail("PRODUCTION_ALIAS_DEPLOYMENT_MISMATCH");
		return domain;
	}).sort();
	const expectedAliases = phase !== "staged" || target.current_deployment_id ? [...target.domains].sort() : [];
	if (JSON.stringify(actualAliases) !== JSON.stringify(expectedAliases)) fail("PRODUCTION_ALIAS_SET_MISMATCH");
	return {
		target,
		baseUrl: origin,
		phase,
		deployment: {
			id: deployment.id,
			url: deploymentUrl,
			projectId: deployment.projectId,
			target: deployment.target,
			readyState: deployment.readyState,
		},
		aliasCount: actualAliases.length,
	};
}

function walkFiles(root) {
	const rootPath = resolve(root);
	if (!existsSync(rootPath) || !lstatSync(rootPath).isDirectory()) fail("STATIC_OUTPUT_MISSING");
	const files = [];
	const visit = (directory) => {
		for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
			const absolute = join(directory, entry.name);
			const stat = lstatSync(absolute);
			if (stat.isSymbolicLink()) fail("STATIC_OUTPUT_CONTAINS_SYMLINK");
			if (stat.isDirectory()) visit(absolute);
			else if (stat.isFile()) files.push({ absolute, path: relative(rootPath, absolute).split(sep).join("/"), size: stat.size });
			else fail("STATIC_OUTPUT_CONTAINS_SPECIAL_FILE");
			if (files.length > MAX_FILES) fail("STATIC_OUTPUT_TOO_LARGE");
		}
	};
	visit(rootPath);
	files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
	if (!files.length) fail("STATIC_OUTPUT_EMPTY");
	const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
	if (totalBytes > MAX_TOTAL_BYTES || files.some((file) => file.size > MAX_FILE_BYTES)) fail("STATIC_OUTPUT_TOO_LARGE");
	return { rootPath, files, totalBytes };
}

function visitHtml(node, callback) {
	callback(node);
	for (const child of node.childNodes ?? []) visitHtml(child, callback);
}

function htmlElements(root, tagName) {
	const output = [];
	visitHtml(root, (node) => { if (node.tagName === tagName) output.push(node); });
	return output;
}

function attribute(node, name) {
	return node?.attrs?.find((item) => item.name === name)?.value ?? "";
}

function containsNoindex(value) {
	return /(?:^|[\s,;])(?:noindex|none)(?=$|[\s,;])/i.test(value);
}

function refreshTarget(document) {
	const meta = htmlElements(document, "meta").find((item) => attribute(item, "http-equiv").toLowerCase() === "refresh");
	const content = attribute(meta, "content");
	const rawTarget = /^\s*\d+(?:\.\d+)?\s*;\s*url\s*=\s*(.+?)\s*$/i.exec(content)?.[1]?.replace(/^['"]|['"]$/g, "");
	return rawTarget || "";
}

function staticHtmlRoute(path) {
	if (path === "index.html") return "/";
	if (path.endsWith("/index.html")) return `/${path.slice(0, -"index.html".length)}`;
	return `/${path}`;
}

// KIRARI's localized search canonicals omit the optional final slash.
// Every other URL component remains bound to the exact public route.
export function productionCanonicalMatchesRoute(canonical, path, origin) {
	const expected = new URL(path, origin);
	return canonical.protocol === "https:" && !canonical.username && !canonical.password && !canonical.search && !canonical.hash
		&& canonical.href.replace(/\/$/, "") === expected.href.replace(/\/$/, "");
}

function staticRoutePaths(files) {
	return new Set(files.filter((file) => file.path.toLowerCase().endsWith(".html")).map((file) => new URL(staticHtmlRoute(file.path), "https://kirari.invalid").pathname));
}

function assertNoStaticNoindex(staticRoot) {
	const { files } = walkFiles(staticRoot);
	const htmlFiles = files.filter((file) => file.path.toLowerCase().endsWith(".html"));
	if (!htmlFiles.length || !files.some((file) => file.path === "robots.txt")) fail("PRODUCTION_ROBOTS_OR_HTML_MISSING");
	const canonicalOrigins = new Set();
	let canonicalDocuments = 0;
	const routePaths = staticRoutePaths(files);
	for (const file of htmlFiles) {
		const document = parseHtml(readFileSync(file.absolute, "utf8"));
		let pageNoindex = false;
		for (const meta of htmlElements(document, "meta")) {
			const name = attribute(meta, "name").toLowerCase();
			if (["robots", "googlebot", "bingbot", "yandex"].includes(name) && containsNoindex(attribute(meta, "content"))) pageNoindex = true;
		}
		const canonicals = htmlElements(document, "link").filter((link) => attribute(link, "rel").toLowerCase().split(/\s+/).includes("canonical"));
		const refreshHref = refreshTarget(document);
		if (!canonicals.length && refreshHref && file.path === "index.html") continue;
		if (canonicals.length !== 1) fail("PRODUCTION_CANONICAL_MISSING_OR_DUPLICATE");
		const href = attribute(canonicals[0], "href");
		let canonical;
		try { canonical = new URL(href); } catch { fail("PRODUCTION_CANONICAL_INVALID"); }
		if (canonical.protocol !== "https:" || !canonical.hostname || canonical.username || canonical.password || canonical.search || canonical.hash) fail("PRODUCTION_CANONICAL_INVALID");
		canonicalOrigins.add(canonical.origin);
		canonicalDocuments += 1;
		if (pageNoindex) {
			if (!refreshHref) fail("PRODUCTION_NOINDEX_METADATA");
			let redirect;
			try { redirect = new URL(refreshHref, canonical.origin); } catch { fail("PRODUCTION_NOINDEX_METADATA"); }
			const terminal404 = /(?:^|\/)404\/?$/i.test(redirect.pathname);
			if (redirect.origin !== canonical.origin || redirect.search || redirect.hash || redirect.pathname !== canonical.pathname || (!routePaths.has(redirect.pathname) && !terminal404)) fail("PRODUCTION_NOINDEX_METADATA");
		} else if (!productionCanonicalMatchesRoute(canonical, staticHtmlRoute(file.path), canonical.origin)) {
			fail("PRODUCTION_CANONICAL_ROUTE_MISMATCH");
		}
	}
	if (!canonicalDocuments || canonicalOrigins.size !== 1) fail("PRODUCTION_CANONICAL_ORIGIN_MISMATCH");
	const robotsFile = files.find((file) => file.path === "robots.txt");
	const robotsText = readFileSync(robotsFile.absolute, "utf8");
	const sitemapOrigins = new Set();
	let sitemapCount = 0;
	for (const rawLine of robotsText.split(/\r?\n/)) {
		const line = rawLine.replace(/#.*/, "").trim();
		if (!line) continue;
		const colon = line.indexOf(":");
		if (colon < 0) continue;
		const name = line.slice(0, colon).trim().toLowerCase();
		const value = line.slice(colon + 1).trim();
		if (name === "noindex" || (name === "disallow" && /^(?:\/|\/\*|\/\$)$/.test(value))) fail("PRODUCTION_ROBOTS_DISALLOWS_INDEXING");
		if (name === "sitemap") {
			let sitemap;
			try { sitemap = new URL(value); } catch { fail("PRODUCTION_ROBOTS_SITEMAP_INVALID"); }
			if (sitemap.protocol !== "https:" || sitemap.username || sitemap.password || sitemap.search || sitemap.hash) fail("PRODUCTION_ROBOTS_SITEMAP_INVALID");
			sitemapOrigins.add(sitemap.origin);
			sitemapCount += 1;
		}
	}
	if (!sitemapCount || sitemapOrigins.size !== 1) fail("PRODUCTION_ROBOTS_SITEMAP_MISSING_OR_MISMATCHED");
	const [canonicalOrigin] = canonicalOrigins;
	if (![...sitemapOrigins].every((origin) => origin === canonicalOrigin)) fail("PRODUCTION_ROBOTS_SITEMAP_MISMATCH");
	const configPath = join(resolve(staticRoot), "..", "config.json");
	if (existsSync(configPath)) {
		let config;
		try { config = JSON.parse(readFileSync(configPath, "utf8")); } catch { fail("PRODUCTION_OUTPUT_CONFIG_INVALID"); }
		for (const route of config.routes ?? []) {
			for (const [name, value] of Object.entries(route.headers ?? {})) {
				if (name.toLowerCase() === "x-robots-tag" && containsNoindex(String(value))) fail("PRODUCTION_NOINDEX_HEADER_POLICY");
			}
		}
	}
	return {
		canonicalOrigin,
		canonicalDocuments,
		robotsSitemapCount: sitemapCount,
		robotsFileSha256: `sha256:${createHash("sha256").update(robotsText).digest("hex")}`,
		indexable: true,
	};
}

export function deriveProductionIndexingPolicy({ staticRoot, canonicalOrigin: expectedCanonicalOrigin, domains }) {
	const policy = assertNoStaticNoindex(staticRoot);
	const expectedOrigin = plainHttpsOrigin(expectedCanonicalOrigin, "INVALID_PRODUCTION_TARGET");
	const allowedDomains = domains.map(canonicalDomain);
	if (!allowedDomains.includes(new URL(expectedOrigin).hostname) || policy.canonicalOrigin !== expectedOrigin) fail("PRODUCTION_CANONICAL_TARGET_MISMATCH");
	return policy;
}

function staticInventory(staticRoot) {
	const { files, totalBytes } = walkFiles(staticRoot);
	const byteHash = createHash("sha256").update("kirari-p4-static-output-v1\0");
	const inventoryHash = createHash("sha256").update("kirari-p4-static-inventory-v1\0");
	const inventory = [];
	for (const file of files) {
		const bytes = readFileSync(file.absolute);
		const sha256 = createHash("sha256").update(bytes).digest("hex");
		const pathBytes = Buffer.from(file.path, "utf8");
		const pathLength = Buffer.alloc(8);
		pathLength.writeBigUInt64BE(BigInt(pathBytes.length));
		const sizeBytes = Buffer.alloc(8);
		sizeBytes.writeBigUInt64BE(BigInt(bytes.length));
		byteHash.update(pathLength).update(pathBytes).update(sizeBytes).update(bytes);
		inventoryHash.update(pathLength).update(pathBytes).update(sizeBytes).update(Buffer.from(sha256, "hex"));
		inventory.push({ path: file.path, sha256, size: bytes.length });
	}
	return {
		inventory,
		fileCount: inventory.length,
		totalBytes,
		byteOutputDigest: `sha256:${byteHash.digest("hex")}`,
		inventoryDigest: `sha256:${inventoryHash.digest("hex")}`,
	};
}

function fileUrl(origin, relativePath) {
	const url = new URL(origin);
	const routePath = relativePath === "index.html"
		? "/"
		: relativePath.endsWith("/index.html")
			? `/${relativePath.slice(0, -"index.html".length)}`
			: `/${relativePath}`;
	url.pathname = routePath.split("/").map((part) => encodeURIComponent(part)).join("/");
	return url;
}

async function remoteFileDigest({ url, origin, oidcToken, fetchImpl }) {
	let requestUrl = url;
	let response;
	for (let redirects = 0; redirects <= 5; redirects += 1) {
		try {
			response = await fetchImpl(requestUrl, {
				method: "GET",
				redirect: "manual",
				headers: headersForRequest(requestUrl.href, { accept: "*/*" }, origin, oidcToken),
				signal: AbortSignal.timeout(20_000),
			});
		} catch { fail("PRODUCTION_STATIC_FETCH_FAILED"); }
		if (![301, 302, 303, 307, 308].includes(response.status)) break;
		if (redirects === 5) fail("PRODUCTION_STATIC_FETCH_FAILED");
		const location = response.headers.get("location");
		if (!location) fail("PRODUCTION_STATIC_FETCH_FAILED");
		try { requestUrl = new URL(location, requestUrl); } catch { fail("PRODUCTION_STATIC_FETCH_FAILED"); }
		if (requestUrl.origin !== origin) fail("PRODUCTION_STATIC_FETCH_FAILED");
	}
	if (new URL(response.url || requestUrl.href).origin !== origin || response.status !== 200 || !response.body) fail("PRODUCTION_STATIC_FETCH_FAILED");
	const digest = createHash("sha256");
	let size = 0;
	try {
		for await (const chunk of response.body) {
			size += chunk.byteLength;
			if (size > MAX_FILE_BYTES) {
				await response.body.cancel().catch(() => {});
				fail("PRODUCTION_STATIC_FETCH_FAILED");
			}
			digest.update(chunk);
		}
	} catch (error) {
		if (error instanceof ProductionValidationError) throw error;
		fail("PRODUCTION_STATIC_FETCH_FAILED");
	}
	return { sha256: digest.digest("hex"), size };
}

export async function verifyDeployedStaticOutput({ staticRoot, baseUrl, oidcToken, fetchImpl = fetch, concurrency = 4 }) {
	const origin = plainHttpsOrigin(baseUrl, "INVALID_PRODUCTION_BASE_URL");
	if (typeof oidcToken !== "string" || !oidcToken) fail("PRODUCTION_OIDC_TOKEN_MISSING");
	if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) fail("INVALID_OUTPUT_VERIFICATION_CONCURRENCY");
	const local = staticInventory(staticRoot);
	let cursor = 0;
	let mismatch = false;
	const worker = async () => {
		while (true) {
			const index = cursor++;
			if (index >= local.inventory.length) return;
			const expected = local.inventory[index];
			const remote = await remoteFileDigest({ url: fileUrl(origin, expected.path), origin, oidcToken, fetchImpl });
			if (remote.sha256 !== expected.sha256 || remote.size !== expected.size) mismatch = true;
		}
	};
	await Promise.all(Array.from({ length: Math.min(concurrency, local.inventory.length) }, worker));
	if (mismatch) fail("PRODUCTION_STATIC_OUTPUT_MISMATCH");
	return {
		byteEquality: "PASS",
		artifactBytesVerified: true,
		byteOutputDigest: local.byteOutputDigest,
		inventoryDigest: local.inventoryDigest,
		fileCount: local.fileCount,
		totalBytes: local.totalBytes,
	};
}

export function assertProductionBrowserReport(report) {
	if (!report || report.result !== "PASS" || report.mode !== "production" || !["staged", "live", "restore"].includes(report.phase) || report.indexable !== true || report.byteEquality !== "PASS" || report.artifactBytesVerified !== true) fail("PRODUCTION_BROWSER_REPORT_NOT_PASS");
	const allowedKeys = new Set([
		"result", "mode", "phase", "baseUrl", "canonicalOrigin", "indexable", "canonicalDocuments", "robotsSitemapCount", "routes", "assets",
		"expectedExternalCalls", "browserConsoleErrors", "pageErrors", "failedBrowserRequests", "badResponses", "unexpectedExternalCalls",
		"byteEquality", "artifactBytesVerified", "byteOutputDigest", "inventoryDigest", "fileCount", "totalBytes",
	]);
	if (Object.keys(report).some((key) => !allowedKeys.has(key))) fail("PRODUCTION_BROWSER_REPORT_INVALID");
	for (const key of ["browserConsoleErrors", "pageErrors", "failedBrowserRequests", "badResponses", "unexpectedExternalCalls"]) {
		if (report[key] !== 0) fail("PRODUCTION_BROWSER_REPORT_NOT_HEALTHY");
	}
	const baseUrl = plainHttpsOrigin(report.baseUrl, "PRODUCTION_BROWSER_REPORT_INVALID");
	const canonicalOrigin = plainHttpsOrigin(report.canonicalOrigin, "PRODUCTION_BROWSER_REPORT_INVALID");
	if (baseUrl !== report.baseUrl || canonicalOrigin !== report.canonicalOrigin || !Number.isSafeInteger(report.canonicalDocuments) || report.canonicalDocuments < 1 || !Number.isSafeInteger(report.robotsSitemapCount) || report.robotsSitemapCount < 1 || !Number.isSafeInteger(report.routes) || report.routes < 1 || !Number.isSafeInteger(report.expectedExternalCalls) || report.expectedExternalCalls < 0 || !report.assets || Object.keys(report.assets).some((key) => !["required", "loaded"].includes(key)) || !Number.isSafeInteger(report.assets.required) || report.assets.required < 0 || !Number.isSafeInteger(report.assets.loaded) || report.assets.loaded < report.assets.required) fail("PRODUCTION_BROWSER_REPORT_INVALID");
	if (!SHA256.test(report.byteOutputDigest ?? "") || !SHA256.test(report.inventoryDigest ?? "") || !Number.isSafeInteger(report.fileCount) || report.fileCount < 1 || !Number.isSafeInteger(report.totalBytes) || report.totalBytes < 0) fail("PRODUCTION_BROWSER_REPORT_INVALID");
	return report;
}
