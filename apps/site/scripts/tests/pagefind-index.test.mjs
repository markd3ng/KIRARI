import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import test from "node:test";
import { buildPagefindIndex, collectPagefindHtmlFiles } from "../pagefind-index.mjs";

function tempDirectory(t) {
	const root = mkdtempSync(join(tmpdir(), "kirari-pagefind-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	return root;
}

function writeSite(root, pages) {
	for (const [path, html] of pages) {
		const file = join(root, path);
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, html);
	}
}

function snapshot(root) {
	const files = [];
	const visit = (directory) => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const file = join(directory, entry.name);
			if (entry.isDirectory()) visit(file);
			else files.push([relative(root, file), readFileSync(file)]);
		}
	};
	visit(root);
	return files.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

test("Pagefind output is stable across source file creation orders", async (t) => {
	const root = tempDirectory(t);
	const pages = [
		[
			"zeta/index.html",
			'<html lang="en-US"><head><title>Zeta</title></head><body><main data-pagefind-body><h1>Zeta</h1><p>shared words zeta</p></main></body></html>',
		],
		[
			"index.html",
			'<html lang="en-US"><head><title>Home</title></head><body><main data-pagefind-body><h1>Home</h1><p>shared words home</p></main></body></html>',
		],
		[
			"alpha/index.html",
			'<html lang="en-US"><head><title>Alpha</title></head><body><main data-pagefind-body><h1>Alpha</h1><p>shared words alpha</p></main></body></html>',
		],
	];
	const firstSite = join(root, "first");
	const secondSite = join(root, "second");
	writeSite(firstSite, pages);
	writeSite(secondSite, [...pages].reverse());

	const paths = (site) => collectPagefindHtmlFiles(site).map((page) => page.sourcePath);
	assert.deepEqual(paths(firstSite), ["alpha/index.html", "index.html", "zeta/index.html"]);
	assert.deepEqual(paths(secondSite), paths(firstSite));

	await buildPagefindIndex(firstSite);
	await buildPagefindIndex(secondSite);
	assert.deepEqual(snapshot(join(firstSite, "pagefind")), snapshot(join(secondSite, "pagefind")));
});
