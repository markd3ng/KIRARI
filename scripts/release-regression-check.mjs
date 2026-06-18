import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const siteRoot = join(repoRoot, "apps/site");
const distRoot = join(siteRoot, "dist");
const targetVersion = process.env.KIRARI_RELEASE_VERSION || "0.4.1";
const checks = [];

function read(path) {
	return readFileSync(join(repoRoot, path), "utf8");
}

function readJson(path) {
	return JSON.parse(read(path));
}

function addCheck(name, passed, detail) {
	checks.push({ name, passed: Boolean(passed), detail });
}

function walk(directory) {
	if (!existsSync(directory)) return [];
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		return entry.isDirectory() ? walk(path) : [path];
	});
}

const rootPackage = readJson("package.json");
const sitePackage = readJson("apps/site/package.json");
const changelog = read("CHANGELOG.md");
const edgeSource = read("workers/kirari-edge/src/index.ts");
const edgeTests = read("workers/kirari-edge/test/index.test.ts");
const tagPage = read("apps/site/src/pages/tags/[tag].astro");
const localizedTagPage = read("apps/site/src/pages/[lang]/tags/[tag].astro");
const categoryPage = read("apps/site/src/pages/categories/[...category].astro");
const localizedCategoryPage = read("apps/site/src/pages/[lang]/categories/[...category].astro");
const postbuild = read("apps/site/scripts/postbuild.mjs");
const searchComponent = read("apps/site/src/components/Search.svelte");
const devicesFilter = read("apps/site/src/components/devices/DevicesFilter.svelte");
const layout = read("apps/site/src/layouts/Layout.astro");
const astroConfig = read("apps/site/astro.config.mjs");
const postPage = read("apps/site/src/pages/posts/[...slug].astro");
const localizedPostPage = read("apps/site/src/pages/[lang]/posts/[...slug].astro");
const bangumiPage = read("apps/site/src/pages/bangumi.astro");
const localizedBangumiPage = read("apps/site/src/pages/[lang]/bangumi.astro");
const bangumiPanel = existsSync(join(repoRoot, "apps/site/src/components/bangumi/BangumiPanel.astro"))
	? read("apps/site/src/components/bangumi/BangumiPanel.astro")
	: "";
const i18nKeys = read("apps/site/src/i18n/i18nKey.ts");
const rootVercel = readJson("vercel.json");
const deployDocs = [
	"DEPLOY.md",
	"docs/CLOUDFLARE_PAGES.md",
	"docs/VERCEL.md",
	"docs/QUICK_START.md",
].map(read).join("\n");

addCheck(
	"release versions agree",
	rootPackage.version === targetVersion &&
		sitePackage.version === targetVersion &&
		changelog.includes(`## [${targetVersion}]`),
	`package.json, apps/site/package.json, and CHANGELOG.md must all declare ${targetVersion}`,
);
addCheck(
	"Node runtime boundary is explicit",
	rootPackage.engines?.node === ">=22.12.0" &&
		existsSync(join(repoRoot, ".nvmrc")) &&
		read(".nvmrc").trim() === "22.12.0",
	"package.json engines.node and .nvmrc must require Node 22.12.0",
);
addCheck(
	"Svelte sources use current event syntax",
	!/\bon:(?:change|keydown)=/.test(searchComponent),
	"Search.svelte must use Svelte 5 event attributes instead of deprecated on: directives",
);
addCheck(
	"Devices filter derives initial selection reactively",
	/\$derived/.test(devicesFilter) && !/\$state\(brands\.length/.test(devicesFilter),
	"DevicesFilter.svelte must not capture the initial brands prop in $state",
);
addCheck(
	"Astro sources have no known unused release variables",
	!/\blet toc: HTMLElement/.test(layout) &&
		!/\bsiteConfig\b/.test(postPage.split("\n").find((line) => line.includes("from \"../../config\"")) || "") &&
		!/\bsiteConfig\b/.test(localizedPostPage.split("\n").find((line) => line.includes('from "src/config"')) || ""),
	"remove the unused Layout toc variable and unused post page siteConfig imports",
);
addCheck(
	"Astro markdown uses the current processor API",
	/import\s+\{\s*unified\s*\}\s+from\s+["']@astrojs\/markdown-remark["']/.test(astroConfig) &&
		/processor:\s*unified\(\{/.test(astroConfig),
	"Astro 6 markdown plugins must be passed through markdown.processor: unified({...})",
);
addCheck(
	"Bangumi uses a transition-safe shared panel",
	bangumiPage.includes("BangumiPanel") &&
		localizedBangumiPage.includes("BangumiPanel") &&
		!bangumiPage.includes("function initBangumi") &&
		!localizedBangumiPage.includes("function initBangumi") &&
		bangumiPanel.includes('transitionManager.on("transition:after-swap", initBangumi)') &&
		bangumiPanel.includes("data-bangumi-state") &&
		/BangumiLoading|bangumiLoading/.test(i18nKeys) &&
		/BangumiEmpty|bangumiEmpty/.test(i18nKeys) &&
		/BangumiError|bangumiError/.test(i18nKeys),
	"root and localized routes must share an idempotent Bangumi panel registered on transitionManager with i18n states",
);
addCheck(
	"Edge proxy routes are covered",
	/proxyGitHubCard/.test(edgeTests) &&
		/proxyAvatar/.test(edgeTests) &&
		/proxyBangumiApi/.test(edgeTests) &&
		/proxyBangumiImage/.test(edgeTests) &&
		/OPTIONS/.test(edgeTests) &&
		/405/.test(edgeTests),
	"Edge tests must cover every proxy, CORS preflight, and method rejection",
);
addCheck(
	"Edge proxy prefixes are stripped",
	!replaceNoop(edgeSource, "/api/github") &&
		!/new URL\(url\.pathname \+ url\.search, "https:\/\/api\.bgm\.tv"\)/.test(edgeSource) &&
		!/new URL\(url\.pathname, "https:\/\/lain\.bgm\.tv"\)/.test(edgeSource),
	"Worker upstream URLs must remove local route prefixes",
);

const taxonomyPages = [tagPage, localizedTagPage, categoryPage, localizedCategoryPage].join("\n");
addCheck(
	"taxonomy alternates are existence-aware",
	/getTaxonomyAlternates/.test(taxonomyPages) &&
		!taxonomyPages.includes("const alternates = getPathAlternates"),
	"Tag/category detail pages must only emit alternates backed by generated routes",
);
addCheck(
	"postbuild has no placeholder site URL",
	!postbuild.includes('getTomlString("site", "url", "https://example.com")') &&
		!postbuild.includes("https://example.com"),
	"postbuild must resolve the same site origin as Astro and never emit example.com",
);
addCheck(
	"root Vercel config owns security headers",
	rootVercel.outputDirectory === "apps/site/dist" &&
		Array.isArray(rootVercel.headers) &&
		rootVercel.headers.some((entry) =>
			entry.headers?.some((header) => header.key === "Content-Security-Policy"),
		) &&
		!existsSync(join(repoRoot, "apps/site/vercel.json")),
	"root vercel.json must contain the deploy headers and the duplicate site config must be removed",
);
addCheck(
	"deployment docs use monorepo output and Node boundary",
	!/(?:Build output directory|Output Directory|Publish Directory|输出目录)\s*[:|]\s*`?dist`?/i.test(deployDocs) &&
		deployDocs.includes("apps/site/dist") &&
		deployDocs.includes("22.12.0"),
	"deployment docs must consistently use apps/site/dist and Node 22.12.0",
);

if (existsSync(distRoot)) {
	const robots = readFileSync(join(distRoot, "robots.txt"), "utf8");
	const sitemap = readFileSync(join(distRoot, "sitemap-index.xml"), "utf8");
	const sitemapOrigin = sitemap.match(/<loc>(https?:\/\/[^/]+)/)?.[1];
	addCheck(
		"robots and sitemap origins agree",
		Boolean(sitemapOrigin) &&
			robots.includes(`Sitemap: ${sitemapOrigin}/`) &&
			!robots.includes("example.com"),
		"dist/robots.txt must reference the generated sitemap origin",
	);

	const missingAlternates = [];
	for (const file of walk(distRoot).filter((path) => path.endsWith(".html"))) {
		const html = readFileSync(file, "utf8");
		for (const match of html.matchAll(/<link[^>]+rel="alternate"[^>]+href="([^"]+)"/g)) {
			let pathname;
			try {
				pathname = new URL(match[1]).pathname;
			} catch {
				continue;
			}
			const target = join(distRoot, pathname);
			if (!existsSync(target) && !existsSync(join(target, "index.html"))) {
				missingAlternates.push(`${relative(distRoot, file)} -> ${pathname}`);
			}
		}
	}
	addCheck(
		"generated hreflang targets exist",
		missingAlternates.length === 0,
		missingAlternates.slice(0, 10).join("\n") || "all generated alternates resolve",
	);

	const generatedText = walk(distRoot)
		.filter((path) => /\.(?:html|txt|xml|json)$/.test(path))
		.map((path) => readFileSync(path, "utf8"))
		.join("\n");
	addCheck(
		"generated release metadata is concrete",
		!/KIRARI[\s\S]{0,200}@[\s\S]{0,100}>unknown</i.test(generatedText) &&
			!/>Commit<[\s\S]{0,300}>unknown</i.test(generatedText) &&
			!generatedText.includes("https://example.com") &&
			!generatedText.includes("https://fuwari.vercel.app"),
		"Footer/SiteInfo commit metadata and generated origins must be concrete",
	);
}

const failed = checks.filter((check) => !check.passed);
for (const check of checks) {
	console.log(`${check.passed ? "PASS" : "FAIL"} ${check.name}`);
	if (!check.passed) console.log(`  ${check.detail}`);
}
if (failed.length > 0) {
	console.error(`\n${failed.length} release regression check(s) failed.`);
	process.exit(1);
}

function replaceNoop(source, prefix) {
	const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`replace\\("${escaped}",\\s*"${escaped}"\\)`).test(source);
}
