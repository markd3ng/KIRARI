import { writeFileSync } from "node:fs";
import { join } from "node:path";

export const INDEXING_STATUS_CONTEXT = "kirari/indexnow-production";
export const MAX_INDEXNOW_ATTEMPTS = 3;
export const MAX_GITHUB_STATUS_PAGES = 10;
export const MAX_SITEMAP_BYTES = 5 * 1024 * 1024;
export const MAX_SITEMAPS = 25;
export const MAX_INDEXNOW_URLS = 10_000;

const canonicalOrigin = "https://kirari-main.vercel.app";
const expectedProject = "prj_QNMVdxTkPOad4ynN4fwFCYEST8Jk";
const indexNowKeyPattern = /^[A-Za-z0-9-]{8,128}$/;

export function prepareIndexNowVerificationFile({ config, distDir }) {
	if (config.seo?.indexNow !== true) return false;
	const key = config.seo.indexNowKey;
	if (!isValidIndexNowKey(key)) {
		throw new Error("IndexNow requires a valid public seo.indexNowKey before the Production build.");
	}
	writeFileSync(join(distDir, `${key}.txt`), key);
	return true;
}

export function verifyVercelSuccessEvent({ event, repository, sender }) {
	if (event.action !== "vercel.deployment.success" || sender.login !== "vercel[bot]" || repository.full_name !== "markd3ng/KIRARI") {
		return { accepted: false, reason: "untrusted event source" };
	}
	const deployment = event.client_payload;
	if (
		!deployment ||
		deployment.environment !== "production" ||
		deployment.project?.id !== expectedProject ||
		deployment.project?.name !== "kirari-main" ||
		deployment.git?.ref !== "main" ||
		!/^[0-9a-f]{40}$/i.test(deployment.git?.sha || "") ||
		deployment.git.shortSha?.toLowerCase() !== deployment.git.sha.slice(0, 7).toLowerCase() ||
		deployment.state?.type !== "success" ||
		!/^dpl_[A-Za-z0-9]+$/.test(deployment.id || "") ||
		!Array.isArray(deployment.alias) ||
		!deployment.alias.includes("kirari-main.vercel.app") ||
		!isVercelDeploymentUrl(deployment.url)
	) {
		return { accepted: false, reason: "deployment is outside the approved Production contract" };
	}
	return { accepted: true, deployment: { id: deployment.id, sha: deployment.git.sha.toLowerCase() } };
}

export function isIndexNowEnabled({ config, env = process.env }) {
	return env.GITHUB_ACTIONS === "true" &&
		env.GITHUB_EVENT_NAME === "repository_dispatch" &&
		env.GITHUB_REPOSITORY === "markd3ng/KIRARI" &&
		!env.KIRARI_SITE_SOURCE &&
		env.KIRARI_BUILD_ONLY !== "true" &&
		env.NODE_ENV !== "test" &&
		env.VERCEL_ENV !== "preview" &&
		env.KIRARI_INDEXNOW_ENABLED === "true" &&
		config.seo?.indexNow === true &&
		isValidIndexNowKey(config.seo.indexNowKey);
}

function isValidIndexNowKey(key) {
	return typeof key === "string" && indexNowKeyPattern.test(key);
}

export async function getGithubCommitStatuses({ url, token, fetchImpl = fetch }) {
	if (!token) throw new Error("GitHub status access is unavailable.");
	const endpoint = new URL(url);
	if (endpoint.origin !== "https://api.github.com") throw new Error("Unexpected GitHub API origin.");
	const statuses = [];
	for (let page = 1; page <= MAX_GITHUB_STATUS_PAGES; page++) {
		const pageUrl = new URL(endpoint);
		pageUrl.searchParams.set("per_page", "100");
		pageUrl.searchParams.set("page", String(page));
		const response = await fetchImpl(pageUrl, {
			redirect: "error",
			headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" },
			signal: AbortSignal.timeout(10_000),
		});
		if (!response.ok) throw new Error(`GitHub status read failed: HTTP ${response.status}.`);
		const batch = await response.json();
		if (!Array.isArray(batch)) throw new Error("GitHub statuses response was malformed.");
		statuses.push(...batch);
		if (batch.length < 100) return statuses;
	}
	throw new Error("GitHub status history exceeds the safe replay-check limit.");
}

export function hasPendingOrCompletedNotification(statuses, now = Date.now()) {
	const priorAttempts = statuses.filter((status) => status.context === INDEXING_STATUS_CONTEXT);
	if (priorAttempts.some((status) => status.state === "success")) return true;
	const pending = priorAttempts.filter((status) => status.state === "pending");
	if (pending.length >= MAX_INDEXNOW_ATTEMPTS) return true;
	return pending.some((status) => {
		const createdAt = Date.parse(status.created_at);
		return !Number.isFinite(createdAt) || now - createdAt < 30 * 60 * 1000;
	});
}

export async function hasCanonicalCommit({ sha, fetchImpl = fetch }) {
	const response = await fetchImpl(`${canonicalOrigin}/`, {
		redirect: "manual",
		cache: "no-store",
		headers: { "cache-control": "no-cache, no-store, max-age=0" },
		signal: AbortSignal.timeout(10_000),
	});
	if (response.status !== 200 || !response.headers.get("content-type")?.toLowerCase().includes("text/html")) return false;
	const html = await readLimitedText(response, MAX_SITEMAP_BYTES);
	const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || "";
	const canonical = head.match(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*\bhref=["']([^"']+)["'][^>]*>/i);
	const commits = [...head.matchAll(/<meta\b(?=[^>]*\bname=["']kirari:build-commit["'])[^>]*\bcontent=["']([a-f0-9]{40})["'][^>]*>/gi)];
	return canonical?.[1] === `${canonicalOrigin}/` && commits.length === 1 && commits[0][1].toLowerCase() === sha.toLowerCase();
}

export async function getProductionSitemapUrls({ fetchImpl = fetch } = {}) {
	const indexUrl = `${canonicalOrigin}/sitemap-index.xml`;
	const indexXml = await fetchSitemap(indexUrl, fetchImpl);
	const sitemapUrls = parseLocs(indexXml, canonicalOrigin).filter((url) => url.pathname.endsWith(".xml"));
	if (sitemapUrls.length === 0 || sitemapUrls.length > MAX_SITEMAPS) throw new Error("Production sitemap index is empty or exceeds the sitemap limit.");

	const urls = new Set();
	let bytesRead = new TextEncoder().encode(indexXml).byteLength;
	for (const sitemapUrl of sitemapUrls) {
		const xml = await fetchSitemap(sitemapUrl.href, fetchImpl);
		bytesRead += new TextEncoder().encode(xml).byteLength;
		if (bytesRead > MAX_SITEMAP_BYTES) throw new Error("Production sitemap files exceed the size limit.");
		for (const url of parseLocs(xml, canonicalOrigin)) {
			if (url.pathname.endsWith(".xml")) continue;
			urls.add(url.href);
			if (urls.size > MAX_INDEXNOW_URLS) throw new Error("Production sitemap exceeds the IndexNow URL limit.");
		}
	}
	return [...urls];
}

export async function submitIndexNow({ urls, key, fetchImpl = fetch }) {
	if (!Array.isArray(urls) || urls.length === 0 || urls.length > MAX_INDEXNOW_URLS) throw new Error("IndexNow URL count is outside the allowed limit.");
	if (urls.some((value) => {
		const url = new URL(value);
		return url.origin !== canonicalOrigin || url.username || url.password || url.hash;
	})) throw new Error("IndexNow URLs must use the canonical Production origin.");
	if (!isValidIndexNowKey(key)) throw new Error("IndexNow public key is invalid.");
	const response = await fetchImpl("https://api.indexnow.org/indexnow", {
		method: "POST",
		redirect: "error",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			host: "kirari-main.vercel.app",
			key,
			keyLocation: `${canonicalOrigin}/${key}.txt`,
			urlList: urls,
		}),
		signal: AbortSignal.timeout(10_000),
	});
	if (!response.ok) throw new Error(`IndexNow rejected the Production sitemap: HTTP ${response.status}.`);
	return response.status;
}

async function fetchSitemap(url, fetchImpl) {
	const parsed = new URL(url);
	if (parsed.origin !== canonicalOrigin || parsed.protocol !== "https:") throw new Error("Production sitemap link escaped the canonical origin.");
	const response = await fetchImpl(parsed.href, {
		redirect: "manual",
		cache: "no-store",
		headers: { "cache-control": "no-cache, no-store, max-age=0" },
		signal: AbortSignal.timeout(10_000),
	});
	if (response.status !== 200 || !response.headers.get("content-type")?.toLowerCase().includes("xml")) throw new Error("Production sitemap request did not return XML successfully.");
	return readLimitedText(response, MAX_SITEMAP_BYTES);
}

async function readLimitedText(response, maxBytes) {
	if (!response.body) throw new Error("Response has no readable body.");
	const reader = response.body.getReader();
	const chunks = [];
	let size = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > maxBytes) throw new Error("Production response exceeds the size limit.");
			chunks.push(value);
		}
	} catch (error) {
		await reader.cancel().catch(() => {});
		throw error;
	}
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function parseLocs(xml, origin) {
	const locations = [...xml.matchAll(/<loc(?:\s[^>]*)?>([\s\S]*?)<\/loc>/gi)].map((match) => decodeXml(match[1].trim()));
	return locations.map((location) => {
		const url = new URL(location);
		if (url.origin !== origin || url.protocol !== "https:" || url.username || url.password || url.hash) throw new Error("Production sitemap contains an unsafe or off-origin URL.");
		return url;
	});
}

function decodeXml(value) {
	return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, token) => {
		if (token[0] !== "#") return ({ amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'" })[token.toLowerCase()];
		const codePoint = token[1].toLowerCase() === "x" ? Number.parseInt(token.slice(2), 16) : Number.parseInt(token.slice(1), 10);
		if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) throw new Error("Production sitemap contains an invalid XML character reference.");
		return String.fromCodePoint(codePoint);
	});
}

function isVercelDeploymentUrl(value) {
	try {
		const url = new URL(value);
		return url.protocol === "https:" && /^kirari-main-[a-z0-9][a-z0-9-]*\.vercel\.app$/i.test(url.hostname) && !url.port && url.pathname === "/" && !url.username && !url.password && !url.search && !url.hash;
	} catch {
		return false;
	}
}
