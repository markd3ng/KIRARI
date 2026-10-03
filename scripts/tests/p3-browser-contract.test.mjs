import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { browserContract } from "../p3-browser/contract.mjs";

function fixture() {
	return mkdtempSync(join(tmpdir(), "kirari-p3-browser-contract-"));
}

test("browser contract always includes the root and resolves relative assets from each page", () => {
	const root = fixture();
	try {
		mkdirSync(join(root, "posts/demo"), { recursive: true });
		writeFileSync(join(root, "index.html"), '<html><head><link rel="stylesheet" href="css/root.css"></head><body><a href="/posts/demo/">Read</a></body></html>');
		writeFileSync(join(root, "posts/demo/index.html"), '<html><head><title>Demo</title><link rel="stylesheet" href="article.css"><script src="article.js"></script></head><body><h1>Demo</h1><img src="cover.png"></body></html>');

		const contract = browserContract(root);
		assert.deepEqual(contract.routes[0], { path: "/", title: "", content_marker: "" });
		assert.ok(contract.assets.stylesheets.includes("/css/root.css"));
		assert.ok(contract.assets.stylesheets.includes("/posts/demo/article.css"));
		assert.ok(contract.assets.scripts.includes("/posts/demo/article.js"));
		assert.ok(contract.assets.images.includes("/posts/demo/cover.png"));
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("browser contract strips query and fragment from the root refresh route", () => {
	const root = fixture();
	try {
		mkdirSync(join(root, "en-US"), { recursive: true });
		mkdirSync(join(root, "posts/demo"), { recursive: true });
		writeFileSync(join(root, "index.html"), '<meta http-equiv="refresh" content="0;url=/en-US/?lang=zh#top">');
		writeFileSync(join(root, "en-US/index.html"), '<html><head><title>English</title><link rel="stylesheet" href="css/site.css"></head><body><h1>English</h1><a href="/posts/demo/">Read</a></body></html>');
		writeFileSync(join(root, "posts/demo/index.html"), '<html><head><title>Demo</title></head><body><h1>Demo</h1></body></html>');

		const contract = browserContract(root);
		assert.ok(contract.routes.some((route) => route.path === "/"));
		assert.ok(contract.routes.some((route) => route.path === "/en-US/"));
		assert.ok(contract.routes.every((route) => !route.path.includes("?") && !route.path.includes("#")));
		assert.ok(contract.assets.stylesheets.includes("/en-US/css/site.css"));
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
