import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { outputInventory } from "../site-artifact.mjs";
import { parseHeaders } from "../package-vercel-site.mjs";

function fixture() {
	const root = mkdtempSync(join(tmpdir(), "kirari-portable-output-"));
	const output = join(root, ".vercel/output");
	mkdirSync(join(output, "static"), { recursive: true });
	writeFileSync(join(output, "config.json"), JSON.stringify({ version: 3, routes: [] }));
	writeFileSync(join(output, "static/index.html"), "<main>KIRARI</main>");
	return { root, output };
}

test("portable output inventory hashes exact Build Output files", () => {
	const { root } = fixture();
	try {
		const files = outputInventory(root);
		assert.deepEqual(files.map(({ file }) => file), [".vercel/output/config.json", ".vercel/output/static/index.html"]);
		const html = Buffer.from("<main>KIRARI</main>");
		assert.deepEqual(files[1], {
			file: ".vercel/output/static/index.html",
			sha256: `sha256:${createHash("sha256").update(html).digest("hex")}`,
			size: html.length,
		});
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("portable output inventory rejects symlinks", () => {
	const { root, output } = fixture();
	try {
		symlinkSync(join(output, "static/index.html"), join(output, "static/linked.html"));
		assert.throws(() => outputInventory(root), /Vercel output contains a symlink/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("Build Output header parsing ignores comments outside and inside groups", () => {
	const root = mkdtempSync(join(tmpdir(), "kirari-vercel-headers-"));
	try {
		const headers = join(root, "_headers");
		writeFileSync(headers, "# global note\n/assets/*\n  Cache-Control: public, max-age=3600\n  # inline note\n\n# another note\n");
		assert.deepEqual(parseHeaders(headers), [{
			src: "^/assets/(.*)$",
			headers: { "Cache-Control": "public, max-age=3600" },
			continue: true,
		}]);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
