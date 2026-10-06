import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const sha = (value) => createHash("sha256").update(value).digest("hex");

test("temporary unignored audit copy removes only #122 configuration and preserves every lock/importer input", () => {
	const sourceManifest = readFileSync(join(root, "package.json"));
	const targetParent = mkdtempSync(join(tmpdir(), "kirari-unignored-audit-"));
	const target = join(targetParent, "workspace");
	try {
		execFileSync(process.execPath, [join(root, "scripts/root-audit/prepare-unignored-audit.mjs"), target], { cwd: root });
		const unignoredManifest = JSON.parse(readFileSync(join(target, "package.json"), "utf8"));
		const expected = JSON.parse(sourceManifest.toString("utf8"));
		delete expected.pnpm.auditConfig.ignoreCves;
		delete expected.pnpm.auditConfig;
		assert.deepEqual(unignoredManifest, expected);
		assert.equal(sha(readFileSync(join(target, "pnpm-lock.yaml"))), sha(readFileSync(join(root, "pnpm-lock.yaml"))));
		assert.equal(sha(readFileSync(join(target, "pnpm-workspace.yaml"))), sha(readFileSync(join(root, "pnpm-workspace.yaml"))));
		for (const importer of ["apps/site", "workers/kirari-edge", "packages/site-profile"]) {
			assert.equal(sha(readFileSync(join(target, importer, "package.json"))), sha(readFileSync(join(root, importer, "package.json"))));
		}
		assert.equal(sha(readFileSync(join(root, "package.json"))), sha(sourceManifest), "source package.json must remain untouched");
	} finally {
		rmSync(targetParent, { recursive: true, force: true });
	}
});
