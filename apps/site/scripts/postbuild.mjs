import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { parse } from "smol-toml";
import sanitizeHtml from "sanitize-html";
import { buildPagefindIndex } from "./pagefind-index.mjs";
import { buildContentSecurityPolicy, SECURITY_HEADERS } from "./security-policy.mjs";
import { submitIndexingNotifications } from "./indexing.mjs";
import { resolveSearchProvider } from "../src/utils/search-provider.mjs";

const distDir = new URL("../dist", import.meta.url).pathname;
const astroDir = join(distDir, "_astro");
const configPath = new URL("../kirari.config.toml", import.meta.url).pathname;
const defaultsPath = new URL("../site-defaults.json", import.meta.url).pathname;

function readConfigText() {
	return existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
}

const configText = readConfigText();
const config = configText ? parse(configText) : {};
const siteDefaults = JSON.parse(readFileSync(defaultsPath, "utf8"));
const contentSecurityPolicy = buildContentSecurityPolicy(config);

function toPublicPath(filePath) {
	return `/${relative(distDir, filePath).split(sep).join("/")}`;
}

function walk(dir) {
	if (!existsSync(dir)) return [];
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const fullPath = join(dir, entry.name);
		return entry.isDirectory() ? walk(fullPath) : [fullPath];
	});
}

function findFirstAsset(pattern) {
	return walk(astroDir)
		.map(toPublicPath)
		.sort()
		.find((asset) => pattern.test(asset));
}

function getTomlBool(section, key, fallback = false) {
	const value = getTomlValue(section, key);
	return typeof value === "boolean" ? value : fallback;
}

function getTomlString(section, key, fallback = "") {
	const value = getTomlValue(section, key);
	return typeof value === "string" ? value : fallback;
}

function getTomlStringArray(section, key, fallback = []) {
	const value = getTomlValue(section, key);
	return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : fallback;
}

function getTomlValue(section, key) {
	let current = config;
	for (const part of section.split(".")) {
		if (!current || typeof current !== "object") return undefined;
		current = current[part];
	}
	if (!current || typeof current !== "object") return undefined;
	return current[key];
}

function activeSearchProvider() {
	return resolveSearchProvider(config);
}

function siteUrl() {
	return (process.env.PUBLIC_SITE_URL || getTomlString("site", "url", siteDefaults.url)).replace(/\/$/, "");
}

function basePath() {
	const base = process.env.PUBLIC_SITE_BASE || getTomlString("site", "base", siteDefaults.base);
	return base.endsWith("/") ? base : `${base}/`;
}

function siteTitle() {
	return process.env.PUBLIC_SITE_TITLE || getTomlString("site", "title", siteDefaults.title);
}

function stripTags(html) {
	return sanitizeHtml(html, {
		allowedTags: [],
		allowedAttributes: {},
		textFilter: (text) => `${text} `,
	})
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/\s+/g, " ")
		.trim();
}

function htmlFiles() {
	return walk(distDir).filter((file) => file.endsWith(".html"));
}

function pageInfo(file) {
	const html = readFileSync(file, "utf8");
	const title = html.match(/<title>(.*?)<\/title>/i)?.[1] || "";
	const description = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] || "";
	const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] || "";
	const lang = html.match(/name=["']kirari:language["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
		html.match(/<html[^>]+lang=["']([^"']+)["']/i)?.[1] || "";
	return {
		file,
		title,
		description,
		canonical,
		lang,
		text: stripTags(html),
	};
}

function pagePath(page) {
	try {
		return new URL(page.canonical).pathname;
	} catch {
		return "";
	}
}

function cleanPageTitle(page, title = siteTitle()) {
	const value = page.title || page.canonical;
	return value.replace(new RegExp(`\\s[-|]\\s${escapeRegExp(title)}$`), "").trim();
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function globToRegExp(pattern) {
	const escaped = pattern.split("*").map(escapeRegExp).join(".*");
	return new RegExp(`^${escaped}$`);
}

function matchesAny(value, patterns) {
	return patterns.some((pattern) => globToRegExp(pattern).test(value));
}

function isArticlePage(page) {
	return /\/posts\/[^/]+\/$/.test(pagePath(page));
}

function isNavigationPage(page) {
	return /^\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?(?:|blog\/|archive\/|categories\/|tags\/|projects\/|about\/|friends\/)$/.test(pagePath(page));
}

function sortByCanonical(a, b) {
	return a.canonical.localeCompare(b.canonical);
}

function llmsLine(page, title = siteTitle(), includeDescription = true) {
	const label = cleanPageTitle(page, title);
	const description = includeDescription && page.description ? `: ${page.description}` : "";
	return `- [${label}](${page.canonical})${description}`;
}

function llmsFileUrl(pages, filename) {
	const origin = pages.find((page) => page.canonical)?.canonical;
	try {
		return `${new URL(origin).origin}${basePath()}${filename}`.replace(/([^:]\/)\/+/g, "$1");
	} catch {
		return `${siteUrl()}${basePath()}${filename}`.replace(/([^:]\/)\/+/g, "$1");
	}
}

function buildLlmsIndex({ title, description, pages, lang, small = false }) {
	const includePatterns = getTomlStringArray("llms", "includePatterns", ["*"]);
	const excludePatterns = getTomlStringArray("llms", "excludePatterns", [
		"*/categories/*",
		"*/tags/*",
		"*/archive/*",
		"*/page/*",
	]);
	const scopedPages = pages
		.filter((page) => !lang || page.lang === lang)
		.filter((page) => matchesAny(page.canonical, includePatterns))
		.filter((page) => !matchesAny(page.canonical, excludePatterns) || isNavigationPage(page));
	const articles = scopedPages.filter(isArticlePage).sort(sortByCanonical);
	const navigation = scopedPages.filter(isNavigationPage).sort(sortByCanonical);
	const articleLimit = small ? 30 : articles.length;
	const lines = [
		`# ${lang ? `${title} (${lang})` : title}`,
		"",
		`> ${description}`,
		"",
		`This file is a curated LLM entry point for ${title}. Use the article links for technical content; navigation links provide site structure and discovery.`,
		"",
	];

	if (articles.length > 0) {
		lines.push("## Articles", "");
		for (const page of articles.slice(0, articleLimit)) lines.push(llmsLine(page, title));
		lines.push("");
	}

	if (navigation.length > 0 && !small) {
		lines.push("## Navigation", "");
		for (const page of navigation) lines.push(llmsLine(page, title));
		lines.push("");
	}

	lines.push(
		"## Optional",
		"",
		`- [Full extracted content](${llmsFileUrl(pages, "llms-full.txt")}): Full text aggregation generated from built HTML pages.`,
		`- [Condensed entry point](${llmsFileUrl(pages, "llms-small.txt")}): Shorter version of this LLM entry point.`,
	);

	return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

function findCriticalCss() {
	const defaultHome = join(distDir, getDefaultHomePath().replace(/^\/|\/$/g, ""), "index.html");
	const fallbackHome = join(distDir, "index.html");
	const htmlPath = existsSync(defaultHome) ? defaultHome : fallbackHome;
	if (!existsSync(htmlPath)) return undefined;

	const html = readFileSync(htmlPath, "utf8");
	const stylesheetMatch = html.match(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+\.css)["']/);
	return stylesheetMatch?.[1];
}

function getDefaultHomePath() {
	const rootHtml = join(distDir, "index.html");
	if (!existsSync(rootHtml)) return "/";

	const html = readFileSync(rootHtml, "utf8");
	const refreshMatch = html.match(/http-equiv=["']refresh["'][^>]+content=["'][^"']*url=([^"']+)["']/i);
	return refreshMatch?.[1] || "/";
}

function getRootHtmlLang() {
	const rootHtml = join(distDir, "index.html");
	if (!existsSync(rootHtml)) return "en-US";
	const html = readFileSync(rootHtml, "utf8");
	const langMatch = html.match(/<html[^>]+lang=["']([^"']+)["']/i);
	return langMatch?.[1] || "en-US";
}

function defaultLanguageRedirects() {
	const lang = getRootHtmlLang();
	const defaultLangDir = join(distDir, lang);
	const disabled = /disable-default-language-redirect\s*=\s*true/i.test(configText);
	if (disabled || existsSync(defaultLangDir)) return [];
	return [
		`/${lang}/  /  301`,
		`/${lang}/*  /:splat  301`,
	];
}

function searchRewriteRules() {
	const rules = existsSync(join(distDir, "search", "index.html"))
		? ["/search /search/index.html 200"]
		: [];

	for (const entry of readdirSync(distDir, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		if (!existsSync(join(distDir, entry.name, "search", "index.html"))) continue;
		rules.push(`/${entry.name}/search /${entry.name}/search/index.html 200`);
	}

	return rules;
}

function generateHeadersAndRedirects() {
	const defaultHomePath = getDefaultHomePath();
	const criticalCss = findCriticalCss();
	const roboto400 = findFirstAsset(/roboto-latin-400-normal.*\.woff2$/);

	const preloadLinks = [
		criticalCss && `<${criticalCss}>; rel=preload; as=style`,
		roboto400 && `<${roboto400}>; rel=preload; as=font; type=font/woff2; crossorigin`,
	].filter(Boolean);

	const linkHeaders = preloadLinks.map((link) => `  Link: ${link}`).join("\n");

	const headers = [
		"/*",
		`  Content-Security-Policy: ${contentSecurityPolicy}`,
		...SECURITY_HEADERS.map(([name, value]) => `  ${name}: ${value}`),
		"",
		"/",
		linkHeaders,
		"",
		...(defaultHomePath === "/" ? [] : [defaultHomePath, linkHeaders, ""]),
		"/_astro/*",
		"  Cache-Control: public, max-age=31536000, immutable",
		"",
		"/pagefind/*",
		"  Cache-Control: public, max-age=0, must-revalidate",
		"",
		"/favicon/*",
		"  Cache-Control: public, max-age=86400",
		"",
		"/llms-full.txt",
		"  Cache-Control: no-store",
		"",
	]
		.filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
		.join("\n");

	writeFileSync(join(distDir, "_headers"), `${headers}\n`);
	const redirects = [
		...searchRewriteRules(),
		defaultHomePath === "/" ? undefined : `/  ${defaultHomePath}  302`,
		...defaultLanguageRedirects(),
	].filter(Boolean);

	writeFileSync(join(distDir, "_redirects"), redirects.length > 0 ? `${redirects.join("\n")}\n` : "");
}

function generateRobots() {
	const sitemapUrl = `${siteUrl()}${basePath()}sitemap-index.xml`.replace(/([^:]\/)\/+/g, "$1");
	writeFileSync(join(distDir, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /llms-full.txt\n\nSitemap: ${sitemapUrl}\n`);
}

function obfuscateMailtoLinks() {
	for (const file of htmlFiles()) {
		let html = readFileSync(file, "utf8");
		html = html.replace(/mailto:/gi, "&#109;&#97;&#105;&#108;&#116;&#111;&#58;");
		writeFileSync(file, html);
	}
}

async function generatePagefind() {
	if (activeSearchProvider() !== "pagefind") return;
	await buildPagefindIndex(distDir);
}

function generateLlms() {
	if (!getTomlBool("llms", "enable", true)) return;
	const pages = htmlFiles().map(pageInfo).filter((page) => page.canonical);
	const title = getTomlString("llms", "title", siteTitle());
	const description = getTomlString("llms", "description", `Documentation for ${title}`);

	writeFileSync(join(distDir, "llms.txt"), `${buildLlmsIndex({ title, description, pages })}\n`);
	writeFileSync(join(distDir, "llms-small.txt"), `${buildLlmsIndex({ title, description, pages, small: true })}\n`);

	const full = [`# ${title}`, "", `> ${description}`, ""];
	for (const page of pages) {
		full.push(`## ${cleanPageTitle(page, title)}`, "", page.canonical, "", page.text.slice(0, 20000), "");
	}
	writeFileSync(join(distDir, "llms-full.txt"), `${full.join("\n")}\n`);

	if (getTomlBool("llms", "i18n", true)) {
		const groups = new Map();
		for (const page of pages) {
			const lang = page.lang || "unknown";
			groups.set(lang, [...(groups.get(lang) || []), page]);
		}
		for (const lang of groups.keys()) {
			writeFileSync(join(distDir, `llms-${lang}.txt`), `${buildLlmsIndex({ title, description, pages, lang })}\n`);
		}
	}
}

generateHeadersAndRedirects();
generateRobots();
obfuscateMailtoLinks();
await generatePagefind();
generateLlms();
const indexingSubmissionsAuthorized = await submitIndexingNotifications({
	config,
	distDir,
	siteUrl: siteUrl(),
	basePath: basePath(),
});
if (!indexingSubmissionsAuthorized) {
	console.log("[postbuild] Indexing submissions skipped by the fail-closed authorization policy.");
}
