import assert from "node:assert/strict";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const temporaryRoots = [];

after(() => {
	for (const root of temporaryRoots) rmSync(root, { recursive: true, force: true });
});

function makeFixture() {
	const parent = mkdtempSync(join(tmpdir(), "kirari-dist-recovery-"));
	temporaryRoots.push(parent);
	const root = join(parent, "repo");
	const sitePackage = join(root, "apps/site");
	const source = join(parent, "external-site");
	const bin = join(parent, "bin");
	const publisher = join(root, "scripts/build-external-site.mjs");
	const preload = join(parent, "rename-failpoint.cjs");

	mkdirSync(join(root, "scripts"), { recursive: true });
	mkdirSync(join(sitePackage, "node_modules"), { recursive: true });
	mkdirSync(source, { recursive: true });
	mkdirSync(bin, { recursive: true });
	cpSync(join(repoRoot, "scripts/build-external-site.mjs"), publisher);
	cpSync(join(repoRoot, "scripts/composition-provenance.mjs"), join(root, "scripts/composition-provenance.mjs"));
	writeFileSync(join(bin, "pnpm"), `#!/bin/sh
set -eu
if [ "\${PUBLIC_TEST_BUILD_FAIL:-}" = "1" ]; then exit 42; fi
if [ "\${PUBLIC_TEST_BUILD_NO_DIST:-}" = "1" ]; then exit 0; fi
mkdir -p dist
if [ "\${PUBLIC_TEST_BUILD_EMPTY_DIST:-}" = "1" ]; then exit 0; fi
printf 'new static output' > dist/index.html
`);
	chmodSync(join(bin, "pnpm"), 0o755);
	writeFileSync(preload, `const fs = require("node:fs");
const { syncBuiltinESMExports } = require("node:module");
	const nativeRenameSync = fs.renameSync;
	const nativeRmSync = fs.rmSync;
	let renameCount = 0;
	let backupCleanupFailed = false;
	fs.renameSync = (...args) => {
  const call = ++renameCount;
  const failpoints = process.env.KIRARI_TEST_RENAME_FAIL?.split(",") ?? [];
  if (failpoints.includes(\`before-\${call}\`)) {
    const error = new Error("injected rename failure");
    error.code = "EIO";
    throw error;
  }
  const result = nativeRenameSync(...args);
  if (failpoints.includes(\`after-\${call}\`)) process.kill(process.pid, "SIGKILL");
	  return result;
	};
	fs.rmSync = (path, ...args) => {
	  if (!backupCleanupFailed && process.env.KIRARI_TEST_BACKUP_CLEANUP_FAIL === "1" && String(path).endsWith("previous-dist")) {
	    backupCleanupFailed = true;
	    const error = new Error("injected backup cleanup failure");
	    error.code = "EIO";
	    throw error;
	  }
	  return nativeRmSync(path, ...args);
	};
syncBuiltinESMExports();
`);

	return { parent, root, sitePackage, source, bin, publisher, preload };
}

function runBuild(fixture, { renameFailpoint, backupCleanupFails = false, buildFails = false, omitsDist = false, emptyDist = false } = {}) {
	const result = spawnSync(process.execPath, [fixture.publisher, fixture.source], {
		cwd: fixture.root,
		encoding: "utf8",
		env: {
			...process.env,
			PATH: `${fixture.bin}${process.platform === "win32" ? ";" : ":"}${process.env.PATH ?? ""}`,
			NODE_OPTIONS: [process.env.NODE_OPTIONS, `--require=${fixture.preload}`].filter(Boolean).join(" "),
			KIRARI_TEST_RENAME_FAIL: renameFailpoint ?? "",
			KIRARI_TEST_BACKUP_CLEANUP_FAIL: backupCleanupFails ? "1" : "",
			PUBLIC_TEST_BUILD_FAIL: buildFails ? "1" : "",
			PUBLIC_TEST_BUILD_NO_DIST: omitsDist ? "1" : "",
			PUBLIC_TEST_BUILD_EMPTY_DIST: emptyDist ? "1" : "",
		},
	});
	assert.equal(result.error, undefined, result.error?.message);
	return result;
}

function seedDist(fixture, content = "previous static output") {
	const dist = join(fixture.sitePackage, "dist");
	mkdirSync(dist, { recursive: true });
	writeFileSync(join(dist, "index.html"), content);
}

function output(fixture) {
	return readFileSync(join(fixture.sitePackage, "dist/index.html"), "utf8");
}

function stagingRoots(fixture) {
	return readdirSync(fixture.sitePackage).filter((name) => name.startsWith(".kirari-external-dist-"));
}

test("missing candidate dist fails validation without disturbing the prior output", () => {
	const fixture = makeFixture();
	seedDist(fixture);

	const result = runBuild(fixture, { omitsDist: true });
	assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
	assert.match(`${result.stdout}\n${result.stderr}`, /did not create dist/);
	assert.equal(output(fixture), "previous static output");
	assert.deepEqual(stagingRoots(fixture), []);
});

test("empty candidate dist fails validation without disturbing the prior output", () => {
	const fixture = makeFixture();
	seedDist(fixture);

	const result = runBuild(fixture, { emptyDist: true });
	assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
	assert.match(`${result.stdout}\n${result.stderr}`, /expected a regular index\.html/);
	assert.equal(output(fixture), "previous static output");
	assert.deepEqual(stagingRoots(fixture), []);
});

test("failure to move the prior dist into backup leaves it intact", () => {
	const fixture = makeFixture();
	seedDist(fixture);

	const result = runBuild(fixture, { renameFailpoint: "before-1" });
	assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
	assert.match(`${result.stdout}\n${result.stderr}`, /injected rename failure/);
	assert.equal(output(fixture), "previous static output");
	assert.deepEqual(stagingRoots(fixture), []);
});

test("ordinary candidate-rename failure rolls back the prior dist", () => {
	const fixture = makeFixture();
	seedDist(fixture);

	const result = runBuild(fixture, { renameFailpoint: "before-2" });
	assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
	assert.match(`${result.stdout}\n${result.stderr}`, /injected rename failure/);
	assert.equal(output(fixture), "previous static output");
	assert.deepEqual(stagingRoots(fixture), []);
});

test("backup cleanup failure keeps the new dist and recovers the prior copy on retry", () => {
	const fixture = makeFixture();
	seedDist(fixture);

	const failedCleanup = runBuild(fixture, { backupCleanupFails: true });
	assert.equal(failedCleanup.status, 1, `${failedCleanup.stdout}\n${failedCleanup.stderr}`);
	assert.match(`${failedCleanup.stdout}\n${failedCleanup.stderr}`, /previous output cleanup failed/);
	assert.equal(output(fixture), "new static output");
	const [stageRoot] = stagingRoots(fixture);
	assert.ok(stageRoot);
	assert.equal(readFileSync(join(fixture.sitePackage, stageRoot, "previous-dist/index.html"), "utf8"), "previous static output");

	const failedRetry = runBuild(fixture, { buildFails: true });
	assert.equal(failedRetry.status, 1, `${failedRetry.stdout}\n${failedRetry.stderr}`);
	assert.equal(output(fixture), "new static output");
	assert.deepEqual(stagingRoots(fixture), []);
});

test("failed rollback preserves the backup for recovery on the next invocation", () => {
	const fixture = makeFixture();
	seedDist(fixture);

	const failedInstall = runBuild(fixture, { renameFailpoint: "before-2,before-3" });
	assert.equal(failedInstall.status, 1, `${failedInstall.stdout}\n${failedInstall.stderr}`);
	assert.equal(existsSync(join(fixture.sitePackage, "dist")), false);
	assert.equal(stagingRoots(fixture).length, 1);

	const failedRetry = runBuild(fixture, { buildFails: true });
	assert.equal(failedRetry.status, 1, `${failedRetry.stdout}\n${failedRetry.stderr}`);
	assert.equal(output(fixture), "previous static output");
	assert.deepEqual(stagingRoots(fixture), []);
});

test("restart after moving the old dist to backup restores it before another build", () => {
	const fixture = makeFixture();
	seedDist(fixture);

	const interrupted = runBuild(fixture, { renameFailpoint: "after-1" });
	assert.equal(interrupted.signal, "SIGKILL");
	assert.equal(existsSync(join(fixture.sitePackage, "dist")), false);
	assert.equal(stagingRoots(fixture).length, 1);

	const failedRetry = runBuild(fixture, { buildFails: true });
	assert.equal(failedRetry.status, 1, `${failedRetry.stdout}\n${failedRetry.stderr}`);
	assert.equal(output(fixture), "previous static output", "recovery must restore the backup before the child build starts");
	assert.deepEqual(stagingRoots(fixture), []);

	const retry = runBuild(fixture);
	assert.equal(retry.status, 0, `${retry.stdout}\n${retry.stderr}`);
	assert.equal(output(fixture), "new static output");
	assert.deepEqual(stagingRoots(fixture), []);
});

test("restart after candidate installation keeps the installed dist and removes its stale backup", () => {
	const fixture = makeFixture();
	seedDist(fixture);

	const interrupted = runBuild(fixture, { renameFailpoint: "after-2" });
	assert.equal(interrupted.signal, "SIGKILL");
	assert.equal(output(fixture), "new static output");
	assert.equal(stagingRoots(fixture).length, 1);

	const retry = runBuild(fixture);
	assert.equal(retry.status, 0, `${retry.stdout}\n${retry.stderr}`);
	assert.equal(output(fixture), "new static output");
	assert.deepEqual(stagingRoots(fixture), []);
});

test("repeated runs discard an incomplete candidate stage and converge", () => {
	const fixture = makeFixture();
	seedDist(fixture);
	const staleStage = join(fixture.sitePackage, ".kirari-external-dist-stale");
	mkdirSync(join(staleStage, "dist"), { recursive: true });
	writeFileSync(join(staleStage, "dist/index.html"), "incomplete candidate");

	const first = runBuild(fixture);
	assert.equal(first.status, 0, `${first.stdout}\n${first.stderr}`);
	assert.equal(output(fixture), "new static output");
	assert.deepEqual(stagingRoots(fixture), []);

	writeFileSync(join(fixture.sitePackage, "dist/index.html"), "second previous output");
	const second = runBuild(fixture);
	assert.equal(second.status, 0, `${second.stdout}\n${second.stderr}`);
	assert.equal(output(fixture), "new static output");
	assert.deepEqual(stagingRoots(fixture), []);
});
