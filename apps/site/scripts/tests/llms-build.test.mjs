import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { parse as parseHtml } from "parse5";
import sharp from "sharp";
import { parse, stringify } from "smol-toml";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const profileRoot = join(repoRoot, "packages/site-profile");
const siteOrigin = "https://llms-fixture.example";
const base = "/docs/";
const draftSecret = "DRAFT_PRIVATE_SENTINEL_8271";

function writePost(posts, file, { title, slug, lang = "en-US", draft = false }, body) {
	const destination = join(posts, file);
	mkdirSync(join(destination, ".."), { recursive: true });
	writeFileSync(destination, `---\ntitle: ${title}\nslug: ${slug}\npublished: 2026-01-01\nlang: ${lang}\ndraft: ${draft}\ndescription: LLM build fixture\n---\n\n${body}\n`);
}

function makeFixture(context, { enabled = true, prefixed = true } = {}) {
	const root = mkdtempSync(join(tmpdir(), "kirari llms build "));
	context.after(() => rmSync(root, { recursive: true, force: true }));
	const site = join(root, "Site source");
	cpSync(profileRoot, site, { recursive: true });
	const configPath = join(site, "kirari.config.toml");
	const config = parse(readFileSync(configPath, "utf8"));
	Object.assign(config.site, { url: siteOrigin, base, title: "LLM fixture" });
	Object.assign(config.i18n, { "default-language": "en-US", "default-language-in-subdir": prefixed });
	config.i18n.languages = Object.fromEntries(Object.entries(config.i18n.languages).filter(([lang]) => ["en-US", "zh-CN"].includes(lang)));
	Object.assign(config.llms, { enable: enabled, sitemap: true, i18n: true });
	config.landingPage.enable = false;
	writeFileSync(configPath, stringify(config));
	const posts = join(site, "content/posts");
	rmSync(posts, { recursive: true, force: true });
	mkdirSync(posts, { recursive: true });
	writePost(posts, "guide/index.md", { title: "Source fidelity guide", slug: "nested/guide" }, [
		"## Source-only heading",
		"",
		"Inline math $a^2 + b^2 = c^2$ and a footnote[^proof].",
		"",
		"$$",
		"\\int_0^1 x^2 \\, dx = \\frac{1}{3}",
		"$$",
		"",
		"```ts title=example.ts",
		'const literal = "<keep-code>";',
		"```",
		"",
		"```mermaid",
		"graph TD",
		"  Alpha --> Beta",
		"```",
		"",
		"```plantuml",
		"@startuml",
		"Alice -> Bob: preserved diagram",
		"@enduml",
		"```",
		"",
		"| Column | Value |",
		"| --- | --- |",
		"| retained | table-cell |",
		"",
		"[Companion](../companion.md?mode=read#details)",
		"[Unpublished target](../draft.md)",
		"[Unsafe protocol](javascript:alert%281%29)",
		"![Local fixture](./asset.png)",
		"![Public fixture](/favicon/favicon-light-32.png?version=1#icon)",
		"",
		"[^proof]: Footnote source survives.",
	].join("\n"));
	cpSync(join(site, "assets/images/demo-avatar.png"), join(posts, "guide/asset.png"));
	writePost(posts, "companion.md", { title: "Companion article", slug: "companion" }, "## Details\n\nPublic companion content.");
	writePost(posts, "zh-CN/chinese.md", { title: "中文公开文章", slug: "nested/chinese", lang: "zh-CN" }, "## 中文正文\n\n中文公开内容。");
	writePost(posts, "draft.md", { title: "Private draft", slug: "private-draft", draft: true }, draftSecret);
	writePost(posts, "video.mdx", { title: "Supported MDX video", slug: "video" }, [
		'import YouTube from "../../components/embed/YouTube.astro";',
		'export const implementation = "MDX_IMPLEMENTATION_SENTINEL_8421";',
		"",
		"Static MDX prose survives.",
		"",
		'<YouTube id="5gIf0_xpFPI" />',
		"",
		"<span>{implementation}</span>",
	].join("\n"));
	for (const name of ["about", "friends", "projects"]) {
		writeFileSync(join(site, `content/spec/${name}.md`), `# Fixture ${name}\n\nPublic specification content.\n`);
	}
	writeFileSync(join(site, "data/friends.json"), "[]\n");
	return { site, dist: join(root, "output"), prefixed };
}

async function buildFixture({ site, dist }) {
	const env = { ...process.env, NODE_ENV: "production" };
	for (const key of Object.keys(env)) if (key.startsWith("PUBLIC_")) delete env[key];
	const result = await new Promise((resolve) => {
		const child = spawn(process.execPath, ["scripts/build-external-site.mjs", site, "--dist-output", dist], {
			cwd: repoRoot, env, stdio: ["ignore", "pipe", "pipe"], timeout: 180_000,
		});
		let stdout = "";
		let stderr = "";
		let error;
		child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
		child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
		child.on("error", (value) => { error = value; });
		child.on("close", (status) => resolve({ status, stdout, stderr, error }));
	});
	assert.equal(result.error, undefined, result.error?.message);
	assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
	assert.doesNotMatch(result.stdout, /indexing API (?:submission|notification)/i);
}

function walk(directory) {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const file = join(directory, entry.name);
		return entry.isDirectory() ? walk(file) : [file];
	});
}

function links(html) {
	const result = [];
	function visit(node) {
		if (node.tagName === "link") result.push(Object.fromEntries(node.attrs.map(({ name, value }) => [name, value])));
		for (const child of node.childNodes || []) visit(child);
	}
	visit(parseHtml(html));
	return result;
}

function outputPath(dist, href) {
	const url = new URL(href);
	assert.equal(url.origin, siteOrigin);
	assert.ok(url.pathname.startsWith(base), `URL must retain the hosting base: ${href}`);
	return join(dist, decodeURIComponent(url.pathname.slice(base.length)));
}

function discovery(dist, route, lang) {
	const html = readFileSync(join(dist, route, "index.html"), "utf8");
	const headLinks = links(html);
	const alternate = headLinks.filter((link) => link.rel === "alternate" && link.type === "text/markdown");
	const describedby = headLinks.filter((link) => link.rel === "describedby" && link.type === "text/plain");
	assert.equal(alternate.length, 1, `${route} must advertise one canonical Markdown view`);
	assert.equal(describedby.length, 1, `${route} must advertise its covering index`);
	assert.equal(alternate[0].href, `${siteOrigin}${base}${route}/index.md`);
	assert.equal(describedby[0].href, `${siteOrigin}${base}${lang ? `${lang}/` : ""}llms.txt`);
	assert.equal(existsSync(outputPath(dist, describedby[0].href)), true);
	return readFileSync(outputPath(dist, alternate[0].href), "utf8");
}

for (const prefixed of [true, false]) {
	test(`actual Astro output publishes source Markdown with ${prefixed ? "prefixed" : "root"} default-language routes`, async (context) => {
		const fixture = makeFixture(context, { prefixed });
		await buildFixture(fixture);
		const { dist } = fixture;
		const prefix = prefixed ? "en-US/" : "";
		const markdown = discovery(dist, `${prefix}posts/nested/guide`, prefixed ? "en-US" : "");
		assert.match(markdown, /## Source-only heading/);
		assert.ok(markdown.includes("$a^2 + b^2 = c^2$"));
		assert.ok(markdown.includes("\\int_0^1 x^2 \\, dx = \\frac{1}{3}"));
		assert.ok(markdown.includes('```ts title=example.ts\nconst literal = "<keep-code>";\n```'));
		assert.ok(markdown.includes("```mermaid\ngraph TD\n  Alpha --> Beta\n```"));
		assert.ok(markdown.includes("```plantuml\n@startuml\nAlice -> Bob: preserved diagram\n@enduml\n```"));
		assert.match(markdown, /table-cell/);
		assert.match(markdown, /\[\^proof\]: Footnote source survives\./);
		assert.ok(markdown.includes(`${siteOrigin}${base}${prefix}posts/companion/?mode=read#details`));
		assert.doesNotMatch(markdown, /\.\.\/draft\.md|private-draft|DRAFT_PRIVATE_SENTINEL|javascript:/);
		for (const label of ["Local fixture", "Public fixture"]) {
			const image = markdown.match(new RegExp(`!\\[${label}\\]\\((?:<([^>]+)>|([^)]+))\\)`));
			const target = image?.[1] || image?.[2];
			assert.ok(target, `${label} keeps a usable image destination`);
			assert.ok(existsSync(outputPath(dist, target)), `${label} points to a built asset`);
		}
		const chinese = discovery(dist, "zh-CN/posts/nested/chinese", "zh-CN");
		assert.match(chinese, /中文公开内容/);
		assert.match(discovery(dist, `${prefix}about`, prefixed ? "en-US" : ""), /Public specification content/);
		const mdx = discovery(dist, `${prefix}posts/video`, prefixed ? "en-US" : "");
		assert.match(mdx, /Static MDX prose survives/);
		assert.match(mdx, /https:\/\/www\.youtube\.com\/watch\?v=5gIf0_xpFPI/);
		assert.doesNotMatch(mdx, /import YouTube|<YouTube|export const|MDX_IMPLEMENTATION_SENTINEL_8421|\{implementation\}/);
		const llms = readFileSync(join(dist, "llms.txt"), "utf8");
		assert.ok(llms.includes(`${siteOrigin}${base}${prefix}posts/nested/guide/index.md`));
		assert.ok(llms.includes(`${siteOrigin}${base}zh-CN/llms.txt`));
		assert.doesNotMatch(readFileSync(join(dist, "zh-CN/llms.txt"), "utf8"), /Source fidelity guide/);
		assert.equal(existsSync(join(dist, prefixed ? "posts/nested/guide/index.md" : "en-US/posts/nested/guide/index.md")), false);
		assert.equal(existsSync(join(dist, `${prefix}posts/private-draft/index.md`)), false);
		for (const file of walk(dist).filter((file) => file.endsWith(".html"))) {
			for (const resource of links(readFileSync(file, "utf8")).filter((link) => link.type === "text/markdown" || link.rel === "describedby")) {
				assert.equal(existsSync(outputPath(dist, resource.href)), true, `Discovery target must exist: ${resource.href}`);
			}
		}
		const textOutputs = walk(dist).filter((file) => /(?:\.md|llms[^/]*\.txt|sitemap[^/]*\.xml)$/.test(file));
		for (const file of textOutputs) assert.doesNotMatch(readFileSync(file, "utf8"), /DRAFT_PRIVATE_SENTINEL_8271|llms-small\.txt/);
		const sitemap = walk(dist).filter((file) => /sitemap.*\.xml$/.test(file)).map((file) => readFileSync(file, "utf8")).join("\n");
		assert.ok(sitemap.includes(`${siteOrigin}${base}llms.txt`));
		assert.doesNotMatch(sitemap, /index\.md|\.md<\/loc>/);
		assert.equal(existsSync(join(dist, "llms-full.txt")), true);
	});
}

test("disabled LLM feature emits neither Markdown views nor HTML discovery", async (context) => {
	const fixture = makeFixture(context, { enabled: false, prefixed: false });
	await buildFixture(fixture);
	const { dist } = fixture;
	assert.equal(walk(dist).some((file) => file.endsWith(".md")), false);
	assert.equal(existsSync(join(dist, "llms.txt")), false);
	assert.equal(existsSync(join(dist, "llms-full.txt")), false);
	for (const route of ["posts/nested/guide", "zh-CN/posts/nested/chinese", "about"]) {
		const headLinks = links(readFileSync(join(dist, route, "index.html"), "utf8"));
		assert.equal(headLinks.some((link) => link.type === "text/markdown" || link.rel === "describedby"), false);
	}
});

test("concurrent staged builds isolate same-ID content and image caches", async (context) => {
	const cases = [
		{ sentinel: "LEFT_CACHE_SENTINEL_9321", foreign: "RIGHT_CACHE_SENTINEL_5732", basePath: "/left/", asset: "demo-avatar.png" },
		{ sentinel: "RIGHT_CACHE_SENTINEL_5732", foreign: "LEFT_CACHE_SENTINEL_9321", basePath: "/right/", asset: "demo-banner.png" },
	].map((entry) => {
		const fixture = makeFixture(context, { prefixed: false });
		const configPath = join(fixture.site, "kirari.config.toml");
		const config = parse(readFileSync(configPath, "utf8"));
		Object.assign(config.site, { base: entry.basePath, title: entry.sentinel });
		writeFileSync(configPath, stringify(config));
		writePost(join(fixture.site, "content/posts"), "guide/index.md", { title: entry.sentinel, slug: "nested/guide" }, `## ${entry.sentinel}\n\nBody ${entry.sentinel}.\n\n![Cache fixture](./asset.png)`);
		const sourceAsset = join(fixture.site, "assets/images", entry.asset);
		cpSync(sourceAsset, join(fixture.site, "content/posts/guide/asset.png"));
		return { ...fixture, ...entry, sourceAsset };
	});
	// Let both processes close before the test's fixture cleanup, including failures.
	const results = await Promise.allSettled(cases.map(buildFixture));
	for (const result of results) assert.equal(result.status, "fulfilled", result.reason?.stack);
	const emittedAssets = [];
	for (const entry of cases) {
		for (const name of ["posts/nested/guide/index.html", "posts/nested/guide/index.md", "llms.txt"]) {
			const output = readFileSync(join(entry.dist, name), "utf8");
			assert.ok(output.includes(entry.sentinel), `${name} must contain its own Site content`);
			assert.ok(!output.includes(entry.foreign), `${name} must exclude the concurrent Site content`);
			assert.ok(output.includes(`${siteOrigin}${entry.basePath}`), `${name} must retain its own base`);
		}
		const markdown = readFileSync(join(entry.dist, "posts/nested/guide/index.md"), "utf8");
		const assetUrl = new URL(markdown.match(/!\[Cache fixture\]\(<([^>]+)>\)/)?.[1]);
		assert.equal(assetUrl.origin, siteOrigin);
		assert.ok(assetUrl.pathname.startsWith(entry.basePath));
		const assetPath = join(entry.dist, decodeURIComponent(assetUrl.pathname.slice(entry.basePath.length)));
		const sourceImage = await sharp(entry.sourceAsset).metadata();
		const outputImage = await sharp(assetPath).metadata();
		assert.deepEqual([outputImage.width, outputImage.height], [sourceImage.width, sourceImage.height], "emitted image must come from this Site's source");
		emittedAssets.push(assetUrl.pathname.slice(entry.basePath.length));
	}
	assert.notEqual(emittedAssets[0], emittedAssets[1], "different source images must not share a cached asset identity");
});
