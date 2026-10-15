import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { parse as parseHtml } from "parse5";
import { headersForRequest } from "./p3-browser/request-routing.mjs";

const MAX_FILES = 20_000;
const MAX_FILE_BYTES = 128 * 1024 * 1024;
const MAX_TOTAL_BYTES = 1024 * 1024 * 1024;

export class StaticSiteValidationError extends Error {
	constructor(code) {
		super(code);
		this.name = "StaticSiteValidationError";
		this.code = code;
	}
}

function fail(code) {
	throw new StaticSiteValidationError(code);
}

function plainHttpsOrigin(value, code) {
	let url;
	try { url = new URL(value); } catch { fail(code); }
	if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash) fail(code);
	return url.origin;
}

function walkFiles(root) {
	const rootPath = resolve(root);
	if (!existsSync(rootPath) || lstatSync(rootPath).isSymbolicLink() || !lstatSync(rootPath).isDirectory()) fail("STATIC_OUTPUT_MISSING");
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
export function canonicalMatchesRoute(canonical, path, origin) {
	const expected = new URL(path, origin);
	return canonical.protocol === "https:" && !canonical.username && !canonical.password && !canonical.search && !canonical.hash
		&& canonical.href.replace(/\/$/, "") === expected.href.replace(/\/$/, "");
}

function staticRoutePaths(files) {
	return new Set(files.filter((file) => file.path.toLowerCase().endsWith(".html")).map((file) => new URL(staticHtmlRoute(file.path), "https://kirari.invalid").pathname));
}

function inspectStaticIndexing(staticRoot, indexable) {
	const { files } = walkFiles(staticRoot);
	const htmlFiles = files.filter((file) => file.path.toLowerCase().endsWith(".html"));
	if (!htmlFiles.length || !files.some((file) => file.path === "robots.txt")) fail("SITE_ROBOTS_OR_HTML_MISSING");
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
		if (canonicals.length !== 1) fail("SITE_CANONICAL_MISSING_OR_DUPLICATE");
		const href = attribute(canonicals[0], "href");
		let canonical;
		try { canonical = new URL(href); } catch { fail("SITE_CANONICAL_INVALID"); }
		if (canonical.protocol !== "https:" || !canonical.hostname || canonical.username || canonical.password || canonical.search || canonical.hash) fail("SITE_CANONICAL_INVALID");
		canonicalOrigins.add(canonical.origin);
		canonicalDocuments += 1;
		if (pageNoindex && refreshHref) {
			let redirect;
			try { redirect = new URL(refreshHref, canonical.origin); } catch { fail("SITE_NOINDEX_METADATA"); }
			const terminal404 = /(?:^|\/)404\/?$/i.test(redirect.pathname);
			if (redirect.origin !== canonical.origin || redirect.search || redirect.hash || redirect.pathname !== canonical.pathname || (!routePaths.has(redirect.pathname) && !terminal404)) fail("SITE_NOINDEX_METADATA");
		} else if (pageNoindex && indexable) {
			fail("SITE_NOINDEX_METADATA");
		} else if (!canonicalMatchesRoute(canonical, staticHtmlRoute(file.path), canonical.origin)) {
			fail("SITE_CANONICAL_ROUTE_MISMATCH");
		}
	}
	if (!canonicalDocuments || canonicalOrigins.size !== 1) fail("SITE_CANONICAL_ORIGIN_MISMATCH");
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
		if (indexable && (name === "noindex" || (name === "disallow" && /^(?:\/|\/\*|\/\$)$/.test(value)))) fail("SITE_ROBOTS_DISALLOWS_INDEXING");
		if (name === "sitemap") {
			let sitemap;
			try { sitemap = new URL(value); } catch { fail("SITE_ROBOTS_SITEMAP_INVALID"); }
			if (sitemap.protocol !== "https:" || sitemap.username || sitemap.password || sitemap.search || sitemap.hash) fail("SITE_ROBOTS_SITEMAP_INVALID");
			sitemapOrigins.add(sitemap.origin);
			sitemapCount += 1;
		}
	}
	if ((indexable && !sitemapCount) || sitemapOrigins.size > 1) fail("SITE_ROBOTS_SITEMAP_MISSING_OR_MISMATCHED");
	const [canonicalOrigin] = canonicalOrigins;
	if (![...sitemapOrigins].every((origin) => origin === canonicalOrigin)) fail("SITE_ROBOTS_SITEMAP_MISMATCH");
	const configPath = join(resolve(staticRoot), "..", "config.json");
	if (existsSync(configPath)) {
		let config;
		try { config = JSON.parse(readFileSync(configPath, "utf8")); } catch { fail("SITE_OUTPUT_CONFIG_INVALID"); }
		for (const route of config.routes ?? []) {
			for (const [name, value] of Object.entries(route.headers ?? {})) {
				if (indexable && name.toLowerCase() === "x-robots-tag" && containsNoindex(String(value))) fail("SITE_NOINDEX_HEADER_POLICY");
			}
		}
	}
	return {
		canonicalOrigin,
		canonicalDocuments,
		robotsSitemapCount: sitemapCount,
		robotsFileSha256: `sha256:${createHash("sha256").update(robotsText).digest("hex")}`,
		indexable,
	};
}

export function deriveStaticIndexingPolicy({ staticRoot, canonicalOrigin, indexable = false }) {
	if (typeof indexable !== "boolean") fail("INVALID_SITE_INDEXING_POLICY");
	const expectedOrigin = plainHttpsOrigin(canonicalOrigin, "INVALID_SITE_CANONICAL_ORIGIN");
	const policy = inspectStaticIndexing(staticRoot, indexable);
	if (policy.canonicalOrigin !== expectedOrigin) fail("SITE_CANONICAL_TARGET_MISMATCH");
	return policy;
}

export function staticFileInventory(staticRoot) {
	const { files, totalBytes } = walkFiles(staticRoot);
	const byteHash = createHash("sha256").update("kirari-static-output-v1\0");
	const inventoryHash = createHash("sha256").update("kirari-static-inventory-v1\0");
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

async function remoteFileDigest({ url, origin, fetchImpl }) {
	let requestUrl = url;
	let response;
	for (let redirects = 0; redirects <= 5; redirects += 1) {
		try {
			response = await fetchImpl(requestUrl, {
				method: "GET",
				redirect: "manual",
				headers: headersForRequest(requestUrl.href, { accept: "*/*" }, origin),
				signal: AbortSignal.timeout(20_000),
			});
		} catch { fail("SITE_STATIC_FETCH_FAILED"); }
		if (![301, 302, 303, 307, 308].includes(response.status)) break;
		if (redirects === 5) fail("SITE_STATIC_FETCH_FAILED");
		const location = response.headers.get("location");
		if (!location) fail("SITE_STATIC_FETCH_FAILED");
		try { requestUrl = new URL(location, requestUrl); } catch { fail("SITE_STATIC_FETCH_FAILED"); }
		if (requestUrl.origin !== origin) fail("SITE_STATIC_FETCH_FAILED");
	}
	if (new URL(response.url || requestUrl.href).origin !== origin || response.status !== 200 || !response.body) fail("SITE_STATIC_FETCH_FAILED");
	const digest = createHash("sha256");
	let size = 0;
	try {
		for await (const chunk of response.body) {
			size += chunk.byteLength;
			if (size > MAX_FILE_BYTES) {
				await response.body.cancel().catch(() => {});
				fail("SITE_STATIC_FETCH_FAILED");
			}
			digest.update(chunk);
		}
	} catch (error) {
		if (error instanceof StaticSiteValidationError) throw error;
		fail("SITE_STATIC_FETCH_FAILED");
	}
	return { sha256: digest.digest("hex"), size };
}

export async function compareStaticOutput({ staticRoot, baseUrl, fetchImpl = fetch, concurrency = 4 }) {
	const origin = plainHttpsOrigin(baseUrl, "INVALID_SITE_BASE_URL");
	if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) fail("INVALID_OUTPUT_VERIFICATION_CONCURRENCY");
	const local = staticFileInventory(staticRoot);
	let cursor = 0;
	let mismatch = false;
	const worker = async () => {
		while (true) {
			const index = cursor++;
			if (index >= local.inventory.length) return;
			const expected = local.inventory[index];
			const remote = await remoteFileDigest({ url: fileUrl(origin, expected.path), origin, fetchImpl });
			if (remote.sha256 !== expected.sha256 || remote.size !== expected.size) mismatch = true;
		}
	};
	await Promise.all(Array.from({ length: Math.min(concurrency, local.inventory.length) }, worker));
	if (mismatch) fail("SITE_STATIC_OUTPUT_MISMATCH");
	return {
		byteEquality: "PASS",
		localOutputBytesMatched: true,
		byteOutputDigest: local.byteOutputDigest,
		inventoryDigest: local.inventoryDigest,
		fileCount: local.fileCount,
		totalBytes: local.totalBytes,
	};
}
