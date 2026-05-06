import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const distDir = new URL("../dist", import.meta.url).pathname;
const astroDir = join(distDir, "_astro");

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
	if (!existsSync(rootHtml)) return "/en-US/";

	const html = readFileSync(rootHtml, "utf8");
	const refreshMatch = html.match(/http-equiv=["']refresh["'][^>]+content=["'][^"']*url=([^"']+)["']/i);
	return refreshMatch?.[1] || "/en-US/";
}

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
	defaultHomePath,
	linkHeaders,
	"",
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
writeFileSync(join(distDir, "_redirects"), `/  ${defaultHomePath}  302\n`);
