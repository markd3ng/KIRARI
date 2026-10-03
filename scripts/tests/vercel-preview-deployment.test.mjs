import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { deploymentFiles, uniqueUploads } from "../deploy-vercel-preview.mjs";

function fixture() {
	const root = mkdtempSync(join(tmpdir(), "kirari-vercel-preview-"));
	const output = join(root, ".vercel/output");
	mkdirSync(join(output, "static"), { recursive: true });
	writeFileSync(join(output, "config.json"), JSON.stringify({ version: 3, routes: [] }));
	writeFileSync(join(output, "static/index.html"), "<main>KIRARI</main>");
	return { root, output };
}

test("deployment manifest hashes the exact Build Output files with CLI-compatible paths", () => {
	const { root } = fixture();
	try {
		const files = deploymentFiles(root);
		assert.deepEqual(files.map(({ file }) => file), [".vercel/output/config.json", ".vercel/output/static/index.html"]);
		const html = Buffer.from("<main>KIRARI</main>");
		assert.deepEqual(files[1], {
			file: ".vercel/output/static/index.html",
			sha: createHash("sha1").update(html).digest("hex"),
			size: html.length,
		});
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("deployment manifest rejects symlinks in uploaded output", () => {
	const { root, output } = fixture();
	try {
		symlinkSync(join(output, "static/index.html"), join(output, "static/linked.html"));
		assert.throws(() => deploymentFiles(root), /Symlink in Vercel output/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("upload deduplication rejects different files that claim the same digest", () => {
	const { root, output } = fixture();
	try {
		const second = join(output, "static/other.html");
		writeFileSync(second, "<main>PYTHON</main>");
		const firstBytes = Buffer.from("<main>KIRARI</main>");
		assert.equal(firstBytes.length, Buffer.byteLength("<main>PYTHON</main>"));
		assert.throws(() => uniqueUploads([
			{ file: ".vercel/output/static/index.html", sha: "forced-collision", size: firstBytes.length },
			{ file: ".vercel/output/static/other.html", sha: "forced-collision", size: firstBytes.length },
		], root), /SHA-1 collision in Vercel output/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
