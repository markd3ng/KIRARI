import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { after, test } from "node:test";

const repoRoot = new URL("../../../../", import.meta.url).pathname;
const defaultProfile = join(repoRoot, "packages/site-profile");
const temporaryRoots = [];

after(() => {
	for (const root of temporaryRoots) rmSync(root, { recursive: true, force: true });
});

function makeTempRoot() {
	const root = mkdtempSync(join(tmpdir(), "kirari POC build 中文 "));
	temporaryRoots.push(root);
	return root;
}

function copyProfile(destination) {
	cpSync(defaultProfile, destination, { recursive: true });
	return destination;
}

function runBuild(sitePath) {
	const result = spawnSync("./build.sh", ["--site", sitePath], {
		cwd: repoRoot,
		encoding: "utf8",
		maxBuffer: 20 * 1024 * 1024,
	});
	assert.equal(result.error, undefined, result.error?.message);
	assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
}

function snapshotOutput(distRoot) {
	const htmlFiles = walk(distRoot).filter((file) => file.endsWith(".html"));
	const routes = htmlFiles.map((file) => relative(distRoot, file).replaceAll("\\", "/")).sort();
	const metadata = htmlFiles
		.map((file) => {
			const html = readFileSync(file, "utf8");
			return [
				relative(distRoot, file).replaceAll("\\", "/"),
				match(html, /<title[^>]*>(.*?)<\/title>/s),
				match(html, /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/),
				match(html, /<meta[^>]+name="description"[^>]+content="([^"]*)"/),
			];
		})
		.sort(([left], [right]) => left.localeCompare(right));
	const assets = ["favicon", "og", "images/devices"]
		.flatMap((directory) => walk(join(distRoot, directory)))
		.map((file) => [relative(distRoot, file).replaceAll("\\", "/"), createHash("sha256").update(readFileSync(file)).digest("hex")])
		.sort(([left], [right]) => left.localeCompare(right));
	return { routes, metadata, assets };
}

function walk(directory) {
	if (!existsSync(directory)) return [];
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		return entry.isDirectory() ? walk(path) : [path];
	});
}

function match(text, pattern) {
	return text.match(pattern)?.[1] || "";
}

function profileHash(root) {
	const hash = createHash("sha256");
	for (const path of walk(root).sort()) {
		hash.update(relative(root, path));
		hash.update(readFileSync(path));
	}
	return hash.digest("hex");
}

test("default and identical external Site builds preserve routes, metadata, and owned assets", () => {
	const root = makeTempRoot();
	const fixture = copyProfile(join(root, "identical Site 源"));
	const sourceBefore = profileHash(fixture);
	const baseline = spawnSync("./build.sh", [], { cwd: repoRoot, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
	assert.equal(baseline.error, undefined, baseline.error?.message);
	assert.equal(baseline.status, 0, `${baseline.stdout}\n${baseline.stderr}`);
	const defaultOutput = snapshotOutput(join(repoRoot, "apps/site/dist"));

	runBuild(fixture);
	const externalOutput = snapshotOutput(join(repoRoot, "apps/site/dist"));
	assert.deepEqual(externalOutput.routes, defaultOutput.routes);
	assert.deepEqual(externalOutput.metadata, defaultOutput.metadata);
	assert.deepEqual(externalOutput.assets, defaultOutput.assets);
	assert.equal(profileHash(fixture), sourceBefore, "external build must not write into Site source");
});

test("a distinct external Site replaces demo articles and never submits indexing notifications", () => {
	const root = makeTempRoot();
	const fixture = copyProfile(join(root, "custom Site 内容"));
	const configPath = join(fixture, "kirari.config.toml");
	let config = readFileSync(configPath, "utf8");
	config = config.replace('# title = "KIRARI"', 'title = "External Site POC 8724"');
	config = config.replace('# indexNow = false', 'indexNow = true\nindexNowKey = "poc-index-key"');
	config = config.replace("indexingApi = false", "indexingApi = true");
	writeFileSync(configPath, config);
	const posts = join(fixture, "content/posts");
	rmSync(posts, { recursive: true, force: true });
	mkdirSync(posts, { recursive: true });
	writeFileSync(join(posts, "external-only.md"), `---\ntitle: External-only POC Article\npublished: 2026-09-29\nslug: external-only-poc-8724\ndescription: External content contract\nimage: ""\nog: ""\ntags: [poc]\ncategory: poc\nlang: en-US\ndraft: false\n---\n\nThis article came only from the external Site fixture.\n`);
	const sourceBefore = profileHash(fixture);
	const hookPath = join(repoRoot, "apps/site/scripts/tests/block-indexing-fetch.mjs");
	const priorNodeOptions = process.env.NODE_OPTIONS;
	const nodeOptions = `${priorNodeOptions ? `${priorNodeOptions} ` : ""}--import=${hookPath}`;
	const build = spawnSync("./build.sh", ["--site", fixture], {
		cwd: repoRoot,
		encoding: "utf8",
		maxBuffer: 20 * 1024 * 1024,
		env: { ...process.env, NODE_OPTIONS: nodeOptions },
	});
	assert.equal(build.error, undefined, build.error?.message);
	assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);
	assert.match(`${build.stdout}\n${build.stderr}`, /Indexing submissions skipped by the fail-closed authorization policy/);
	assert.doesNotMatch(`${build.stdout}\n${build.stderr}`, /Test blocked indexing request/);

	const distRoot = join(repoRoot, "apps/site/dist");
	const home = readFileSync(join(distRoot, "index.html"), "utf8");
	assert.match(home, /External Site POC 8724/);
	assert.equal(existsSync(join(distRoot, "posts/external-only-poc-8724/index.html")), true);
	assert.equal(existsSync(join(distRoot, "posts/devops-guide/index.html")), false);
	assert.equal(profileHash(fixture), sourceBefore, "external build must leave the custom Site tree unchanged");
});

test("a failed external build preserves the previous static output", () => {
	const root = makeTempRoot();
	const fixture = copyProfile(join(root, "incomplete Site"));
	rmSync(join(fixture, "data/friends.json"));

	const distRoot = join(repoRoot, "apps/site/dist");
	mkdirSync(distRoot, { recursive: true });
	const sentinel = join(distRoot, "pr1-output-preservation-check.txt");
	writeFileSync(sentinel, "previous output");
	try {
		const result = spawnSync("./build.sh", ["--site", fixture], {
			cwd: repoRoot,
			encoding: "utf8",
			maxBuffer: 20 * 1024 * 1024,
		});
		assert.equal(result.error, undefined, result.error?.message);
		assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
		assert.match(`${result.stdout}\n${result.stderr}`, /data\/friends\.json.*required|required.*data\/friends\.json/i);
		assert.equal(readFileSync(sentinel, "utf8"), "previous output");
	} finally {
		rmSync(sentinel, { force: true });
	}
});
