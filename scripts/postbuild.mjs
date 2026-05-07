import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { parse } from "smol-toml";

const distDir = new URL("../dist", import.meta.url).pathname;
const astroDir = join(distDir, "_astro");
const configPath = new URL("../kirari.config.toml", import.meta.url).pathname;

function readConfigText() {
	return existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
}

const configText = readConfigText();
const config = configText ? parse(configText) : {};

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

function getTomlValue(section, key) {
	let current = config;
	for (const part of section.split(".")) {
		if (!current || typeof current !== "object") return undefined;
		current = current[part];
	}
	if (!current || typeof current !== "object") return undefined;
	return current[key];
}

function siteUrl() {
	return (process.env.PUBLIC_SITE_URL || getTomlString("site", "url", "https://example.com")).replace(/\/$/, "");
}

function basePath() {
	const base = process.env.PUBLIC_SITE_BASE || getTomlString("site", "base", "/");
	return base.endsWith("/") ? base : `${base}/`;
}

function siteTitle() {
	return process.env.PUBLIC_SITE_TITLE || getTomlString("site", "title", "KIRARI");
}

function stripTags(html) {
	return html
		.replace(/<script[\s\S]*?<\/script>/gi, "")
		.replace(/<style[\s\S]*?<\/style>/gi, "")
		.replace(/<[^>]+>/g, " ")
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
		"  X-Content-Type-Options: nosniff",
		"  Referrer-Policy: strict-origin-when-cross-origin",
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
	]
		.filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
		.join("\n");

	writeFileSync(join(distDir, "_headers"), `${headers}\n`);
	const redirects = [
		defaultHomePath === "/" ? undefined : `/  ${defaultHomePath}  302`,
		...defaultLanguageRedirects(),
	].filter(Boolean);

	writeFileSync(join(distDir, "_redirects"), redirects.length > 0 ? `${redirects.join("\n")}\n` : "");
}

function generateRobots() {
	const sitemapUrl = `${siteUrl()}${basePath()}sitemap-index.xml`.replace(/([^:]\/)\/+/g, "$1");
	writeFileSync(join(distDir, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}\n`);
}

function obfuscateMailtoLinks() {
	for (const file of htmlFiles()) {
		let html = readFileSync(file, "utf8");
		html = html.replace(/mailto:/gi, "&#109;&#97;&#105;&#108;&#116;&#111;&#58;");
		writeFileSync(file, html);
	}
}

function docsearchEnabled() {
	return getTomlBool("search.docsearch", "enable", false) &&
		!!getTomlString("search.docsearch", "appId") &&
		!!getTomlString("search.docsearch", "apiKey") &&
		!!getTomlString("search.docsearch", "indexName");
}

function generatePagefind() {
	if (docsearchEnabled()) return;
	const executable = process.platform === "win32" ? "pagefind.cmd" : "pagefind";
	const result = spawnSync(executable, ["--site", distDir], {
		stdio: "inherit",
		shell: process.platform === "win32",
	});
	if (result.status !== 0) process.exit(result.status ?? 1);
}

function generateLlms() {
	if (!getTomlBool("llms", "enable", true)) return;
	const pages = htmlFiles().map(pageInfo).filter((page) => page.canonical);
	const title = getTomlString("llms", "title", siteTitle());
	const description = getTomlString("llms", "description", `Documentation for ${title}`);
	const summary = [`# ${title}`, "", description, "", "## Pages", ""];
	for (const page of pages) {
		summary.push(`- [${page.title || page.canonical}](${page.canonical})${page.description ? `: ${page.description}` : ""}`);
	}
	writeFileSync(join(distDir, "llms.txt"), `${summary.join("\n")}\n`);

	const small = summary.slice(0, 250).join("\n");
	writeFileSync(join(distDir, "llms-small.txt"), `${small}\n`);

	const full = [`# ${title}`, "", description, ""];
	for (const page of pages) {
		full.push(`## ${page.title || page.canonical}`, "", page.canonical, "", page.text.slice(0, 20000), "");
	}
	writeFileSync(join(distDir, "llms-full.txt"), `${full.join("\n")}\n`);

	if (getTomlBool("llms", "i18n", true)) {
		const groups = new Map();
		for (const page of pages) {
			const lang = page.lang || "unknown";
			groups.set(lang, [...(groups.get(lang) || []), page]);
		}
		for (const [lang, items] of groups.entries()) {
			const lines = [`# ${title} (${lang})`, "", description, "", "## Pages", ""];
			for (const page of items) lines.push(`- [${page.title || page.canonical}](${page.canonical})`);
			writeFileSync(join(distDir, `llms-${lang}.txt`), `${lines.join("\n")}\n`);
		}
	}
}

function sitemapUrls() {
	const xmlFiles = walk(distDir).filter((file) => file.endsWith(".xml") && basename(file).includes("sitemap"));
	const urls = [];
	for (const file of xmlFiles) {
		const xml = readFileSync(file, "utf8");
		for (const match of xml.matchAll(/<loc>(.*?)<\/loc>/g)) urls.push(match[1]);
	}
	return Array.from(new Set(urls.filter((url) => !url.endsWith(".xml"))));
}

async function submitIndexNow() {
	const enabled = process.env.PUBLIC_INDEXNOW_ENABLE === "true" || getTomlBool("seo", "indexNow", false);
	const key = process.env.PUBLIC_INDEXNOW_KEY || getTomlString("seo", "indexNowKey");
	if (!enabled || !key) return;

	writeFileSync(join(distDir, `${key}.txt`), key);
	const urls = sitemapUrls();
	if (urls.length === 0) return;
	const endpoint = "https://api.indexnow.org/indexnow";
	const host = new URL(siteUrl()).host;
	const response = await fetch(endpoint, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			host,
			key,
			keyLocation: `${siteUrl()}${basePath()}${key}.txt`.replace(/([^:]\/)\/+/g, "$1"),
			urlList: urls,
		}),
	});
	if (!response.ok) {
		console.warn(`[postbuild] IndexNow submission failed: ${response.status} ${response.statusText}`);
	}
}

generateHeadersAndRedirects();
generateRobots();
obfuscateMailtoLinks();
generatePagefind();
generateLlms();
await submitIndexNow();
