import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const temporaryRoots = [];

after(() => {
	for (const root of temporaryRoots) rmSync(root, { recursive: true, force: true });
});

function makeParent() {
	const parent = mkdtempSync(join(tmpdir(), "kirari-build-temp-"));
	temporaryRoots.push(parent);
	return parent;
}

function makeFixture(parent, repoName = "repo") {
	const fixtureRoot = join(parent, repoName);
	const sitePackage = join(fixtureRoot, "apps/site");
	const source = join(parent, `${repoName}-external-site`);
	const bin = join(parent, `${repoName}-bin`);
	const publisher = join(fixtureRoot, "scripts/build-external-site.mjs");
	const preload = join(parent, `${repoName}-temp-failpoints.cjs`);

	mkdirSync(join(fixtureRoot, "scripts"), { recursive: true });
	mkdirSync(join(sitePackage, "node_modules"), { recursive: true });
	mkdirSync(source, { recursive: true });
	mkdirSync(bin, { recursive: true });
	cpSync(join(repoRoot, "scripts/build-external-site.mjs"), publisher);
	cpSync(join(repoRoot, "scripts/composition-provenance.mjs"), join(fixtureRoot, "scripts/composition-provenance.mjs"));
	const parse5 = join(fixtureRoot, "node_modules/parse5");
	mkdirSync(join(fixtureRoot, "node_modules"), { recursive: true });
	symlinkSync(realpathSync(join(repoRoot, "node_modules/parse5")), parse5, "dir");
	writeFileSync(join(bin, "pnpm"), `#!/bin/sh
set -eu
if [ -n "\${PUBLIC_TEST_BUILD_READY:-}" ]; then
  : > "$PUBLIC_TEST_BUILD_READY"
  while [ ! -f "$PUBLIC_TEST_BUILD_RELEASE" ]; do sleep 0.02; done
fi
mkdir -p dist
printf 'new static output' > dist/index.html
`);
	chmodSync(join(bin, "pnpm"), 0o755);
	writeFileSync(preload, `const fs = require("node:fs");
const { syncBuiltinESMExports } = require("node:module");
const nativeMkdtempSync = fs.mkdtempSync;
const nativeWriteFileSync = fs.writeFileSync;
if (process.env.KIRARI_TEST_PROCESS_STARTED) {
  nativeWriteFileSync(process.env.KIRARI_TEST_PROCESS_STARTED, String(process.pid));
}
fs.mkdtempSync = (prefix, ...args) => {
  const result = nativeMkdtempSync(prefix, ...args);
  if (process.env.KIRARI_TEST_KILL_AFTER_TEMP_ROOT === "1" &&
      String(prefix).includes(".kirari-external-build-")) {
    process.kill(process.pid, "SIGKILL");
  }
  return result;
};
syncBuiltinESMExports();
`);

	return { parent, root: fixtureRoot, sitePackage, source, bin, publisher, preload };
}

function environment(fixture, extra = {}) {
	return {
		...process.env,
		PATH: `${fixture.bin}${process.platform === "win32" ? ";" : ":"}${process.env.PATH ?? ""}`,
		NODE_OPTIONS: [process.env.NODE_OPTIONS, `--require=${fixture.preload}`].filter(Boolean).join(" "),
		...extra,
	};
}

function runBuild(fixture, extra = {}) {
	return spawnSync(process.execPath, [fixture.publisher, fixture.source], {
		cwd: fixture.root,
		encoding: "utf8",
		env: environment(fixture, extra),
	});
}

function startBuild(fixture, extra = {}) {
	const result = { stdout: "", stderr: "", exit: undefined };
	const child = spawn(process.execPath, [fixture.publisher, fixture.source], {
		cwd: fixture.root,
		stdio: ["ignore", "pipe", "pipe"],
		env: environment(fixture, extra),
	});
	result.child = child;
	child.stdout.setEncoding("utf8").on("data", (chunk) => { result.stdout += chunk; });
	child.stderr.setEncoding("utf8").on("data", (chunk) => { result.stderr += chunk; });
	result.done = new Promise((resolve) => {
		child.once("close", (code, signal) => {
			result.exit = { code, signal };
			resolve(result.exit);
		});
	});
	return result;
}

async function waitForFile(path, build, timeoutMs = 10_000) {
	const deadline = Date.now() + timeoutMs;
	while (!existsSync(path)) {
		if (build.child.exitCode !== null || build.child.signalCode !== null) {
			throw new Error(`Publisher exited before ${path} appeared: ${build.stdout}\n${build.stderr}`);
		}
		if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${path}`);
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
}

async function waitForExit(build, timeoutMs = 10_000) {
	let timer;
	const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve(undefined), timeoutMs); });
	const exit = await Promise.race([build.done, timeout]);
	clearTimeout(timer);
	return exit;
}

function buildTempRoots(fixture) {
	return readdirSync(fixture.parent).filter((name) => name.startsWith(tempRootPrefix(fixture)));
}

function tempRootPrefix(fixture) {
	const destination = join(realpathSync(fixture.sitePackage), "dist");
	const destinationHash = createHash("sha256").update(destination).digest("hex");
	return `.kirari-external-build-${destinationHash}-`;
}

function stagingRoots(fixture) {
	return readdirSync(fixture.sitePackage).filter((name) => name.startsWith(".kirari-external-dist-"));
}

test("SIGKILL immediately after temp creation leaves a workspace that retry removes", () => {
	const parent = makeParent();
	const fixture = makeFixture(parent);
	const interrupted = runBuild(fixture, { KIRARI_TEST_KILL_AFTER_TEMP_ROOT: "1" });
	assert.equal(interrupted.error, undefined, interrupted.error?.message);
	assert.equal(interrupted.signal, "SIGKILL", `${interrupted.stdout}\n${interrupted.stderr}`);
	assert.equal(stagingRoots(fixture).length, 0, "termination must happen before a dist publication stage exists");
	const [abandonedRoot] = buildTempRoots(fixture);
	assert.ok(abandonedRoot, "the killed process must leave its sibling build workspace behind");
	assert.deepEqual(readdirSync(join(parent, abandonedRoot)), [], "the injected kill happens immediately after mkdir");

	const retry = runBuild(fixture);
	assert.equal(retry.error, undefined, retry.error?.message);
	assert.equal(retry.status, 0, `${retry.stdout}\n${retry.stderr}`);
	assert.deepEqual(buildTempRoots(fixture), [], "startup recovery must remove the dead owner's build workspace");
	assert.deepEqual(stagingRoots(fixture), []);
});

test("a same-destination contender waits while the publisher owns its temp workspace", async () => {
	const parent = makeParent();
	const fixture = makeFixture(parent);
	const ready = join(fixture.parent, "build-ready");
	const release = join(fixture.parent, "build-release");
	const contenderStarted = join(fixture.parent, "contender-started");
	const active = startBuild(fixture, {
		PUBLIC_TEST_BUILD_READY: ready,
		PUBLIC_TEST_BUILD_RELEASE: release,
	});
	let contender;
	try {
		await waitForFile(ready, active);
		const [activeRoot] = buildTempRoots(fixture);
		assert.ok(activeRoot, "the active publisher must own a sibling temp workspace");

		contender = startBuild(fixture, { KIRARI_TEST_PROCESS_STARTED: contenderStarted });
		await waitForFile(contenderStarted, contender);
		const contenderExit = await waitForExit(contender, 250);
		assert.equal(contenderExit, undefined, "the same-destination contender must wait for the active lock");
		assert.ok(existsSync(join(fixture.parent, activeRoot)), "a live build's workspace must not be removed during recovery");
	} finally {
		writeFileSync(release, "release");
		if (active.child.exitCode === null && active.child.signalCode === null) {
			const exit = await waitForExit(active);
			if (!exit) active.child.kill("SIGKILL");
		}
		if (contender && contender.child.exitCode === null && contender.child.signalCode === null) {
			const exit = await waitForExit(contender);
			if (!exit) contender.child.kill("SIGKILL");
		}
	}
	assert.deepEqual(active.exit, { code: 0, signal: null }, `${active.stdout}\n${active.stderr}`);
	assert.deepEqual(contender?.exit, { code: 0, signal: null }, `${contender?.stdout}\n${contender?.stderr}`);
	assert.deepEqual(buildTempRoots(fixture), []);
});

test("recovery removes one destination's orphan without touching another's active temp", async () => {
	const parent = makeParent();
	const fixtureA = makeFixture(parent, "repo-a");
	const fixtureB = makeFixture(parent, "repo-b");
	const interrupted = runBuild(fixtureA, { KIRARI_TEST_KILL_AFTER_TEMP_ROOT: "1" });
	assert.equal(interrupted.error, undefined, interrupted.error?.message);
	assert.equal(interrupted.signal, "SIGKILL", `${interrupted.stdout}\n${interrupted.stderr}`);
	const [abandonedRoot] = buildTempRoots(fixtureA);
	assert.ok(abandonedRoot);

	const ready = join(parent, "repo-b-build-ready");
	const release = join(parent, "repo-b-build-release");
	const active = startBuild(fixtureB, {
		PUBLIC_TEST_BUILD_READY: ready,
		PUBLIC_TEST_BUILD_RELEASE: release,
	});
	try {
		await waitForFile(ready, active);
		const [activeRoot] = buildTempRoots(fixtureB);
		assert.ok(activeRoot, "the other destination must have an active sibling temp workspace");

		const retry = runBuild(fixtureA);
		assert.equal(retry.error, undefined, retry.error?.message);
		assert.equal(retry.status, 0, `${retry.stdout}\n${retry.stderr}`);
		assert.deepEqual(buildTempRoots(fixtureA), [], "recovery must remove the dead temp for its destination");
		assert.ok(existsSync(join(parent, activeRoot)), "recovery must preserve the other destination's live temp");
	} finally {
		writeFileSync(release, "release");
		if (active.child.exitCode === null && active.child.signalCode === null) {
			const exit = await waitForExit(active);
			if (!exit) active.child.kill("SIGKILL");
		}
	}
	assert.deepEqual(active.exit, { code: 0, signal: null }, `${active.stdout}\n${active.stderr}`);
	assert.deepEqual(buildTempRoots(fixtureB), []);
});
