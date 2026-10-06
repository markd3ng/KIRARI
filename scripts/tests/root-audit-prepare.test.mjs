import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const sha = (value) => createHash("sha256").update(value).digest("hex");
const workflow = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
const prepareStep = workflow.match(/^      - name: Prepare a temporary audit workspace without the existing #122 ignore\n([\s\S]*?)(?=^      - |$(?![\s\S]))/m)?.[0] ?? "";
const nodeScript = prepareStep.match(/^          node --input-type=module <<'NODE'\n([\s\S]*?)^          NODE$/m)?.[1]
	?.split("\n").map((line) => line.replace(/^ {10}/, "")).join("\n");

assert.ok(nodeScript, "the workflow must contain its inline, non-checkout-helper workspace preparation script");

test("inline workflow preparation removes only #122 config and copies exact lock/importer inputs", () => {
	const sourceManifest = readFileSync(join(root, "package.json"));
	const targetParent = mkdtempSync(join(tmpdir(), "kirari-unignored-audit-"));
	const target = join(targetParent, "workspace");
	try {
		mkdirSync(target, { recursive: true });
		writeFileSync(join(target, ".pnpmfile.cjs"), "throw new Error('stale hook must not survive preparation');\n");
		execFileSync(process.execPath, ["--input-type=module", "-"], {
			cwd: root,
			input: nodeScript,
			env: { ...process.env, AUDIT_WORKSPACE: target },
		});
		const unignoredManifest = JSON.parse(readFileSync(join(target, "package.json"), "utf8"));
		const expected = JSON.parse(sourceManifest.toString("utf8"));
		delete expected.pnpm.auditConfig.ignoreCves;
		if (Object.keys(expected.pnpm.auditConfig).length === 0) delete expected.pnpm.auditConfig;
		assert.deepEqual(unignoredManifest, expected);
		assert.equal(sha(readFileSync(join(target, "pnpm-lock.yaml"))), sha(readFileSync(join(root, "pnpm-lock.yaml"))));
		assert.equal(sha(readFileSync(join(target, "pnpm-workspace.yaml"))), sha(readFileSync(join(root, "pnpm-workspace.yaml"))));
		for (const importer of ["apps/site", "workers/kirari-edge", "packages/site-profile"]) {
			assert.equal(sha(readFileSync(join(target, importer, "package.json"))), sha(readFileSync(join(root, importer, "package.json"))));
		}
		assert.equal(existsSync(join(target, ".pnpmfile.cjs")), false, "checkout hooks must not enter the supplemental audit workspace");
		assert.equal(sha(readFileSync(join(root, "package.json"))), sha(sourceManifest), "source package.json must remain untouched");
	} finally {
		rmSync(targetParent, { recursive: true, force: true });
	}
});

test("inline workflow preparation rejects a workspace inside the checkout", () => {
	const result = spawnSync(process.execPath, ["--input-type=module", "-"], {
		cwd: root,
		input: nodeScript,
		env: { ...process.env, AUDIT_WORKSPACE: join(root, "package.json") },
		encoding: "utf8",
	});
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /The unignored audit workspace must be outside the repository checkout/);
});
