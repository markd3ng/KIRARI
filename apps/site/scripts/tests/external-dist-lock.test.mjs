import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const temporaryRoots = [];

after(() => {
	for (const root of temporaryRoots) rmSync(root, { recursive: true, force: true });
});

function makeFixture() {
	const parent = mkdtempSync(join(tmpdir(), "kirari-dist-lock-"));
	temporaryRoots.push(parent);
	const root = join(parent, "repo");
	const sitePackage = join(root, "apps/site");
	const source = join(parent, "external-site");
	const bin = join(parent, "bin");
	const publisher = join(root, "scripts/build-external-site.mjs");
	const preload = join(parent, "hold-stage.cjs");

	mkdirSync(join(root, "scripts"), { recursive: true });
	mkdirSync(join(sitePackage, "node_modules"), { recursive: true });
	mkdirSync(source, { recursive: true });
	mkdirSync(bin, { recursive: true });
	cpSync(join(repoRoot, "scripts/build-external-site.mjs"), publisher);
	cpSync(join(repoRoot, "scripts/composition-provenance.mjs"), join(root, "scripts/composition-provenance.mjs"));
	const parse5 = join(root, "node_modules/parse5");
	mkdirSync(join(root, "node_modules"), { recursive: true });
	symlinkSync(realpathSync(join(repoRoot, "node_modules/parse5")), parse5, "dir");
	writeFileSync(join(bin, "pnpm"), `#!/usr/bin/env node
const fs = require("node:fs");
if (process.env.PUBLIC_TEST_HOLD_BUILD_CHILD === "1") {
  fs.writeFileSync(process.env.PUBLIC_TEST_BUILD_CHILD_READY, String(process.pid));
  const finish = () => {
    fs.writeFileSync(process.env.PUBLIC_TEST_BUILD_CHILD_EXITED, "done");
    process.exit(0);
  };
  const releasePoll = setInterval(() => {
    if (fs.existsSync(process.env.PUBLIC_TEST_BUILD_CHILD_RELEASE)) {
      clearInterval(releasePoll);
      finish();
    }
  }, 10);
  process.on("SIGTERM", () => {
    fs.writeFileSync(process.env.PUBLIC_TEST_BUILD_CHILD_TERMINATING, "yes");
    setTimeout(finish, 350);
  });
} else {
  if (process.env.PUBLIC_TEST_BUILD_STARTED) fs.writeFileSync(process.env.PUBLIC_TEST_BUILD_STARTED, "started");
  fs.mkdirSync("dist", { recursive: true });
  fs.writeFileSync("dist/index.html", process.env.PUBLIC_TEST_BUILD_CONTENT || "new static output");
}
`);
	chmodSync(join(bin, "pnpm"), 0o755);
	writeFileSync(preload, `const fs = require("node:fs");
const { syncBuiltinESMExports } = require("node:module");
const nativeCpSync = fs.cpSync;
fs.cpSync = (source, destination, ...args) => {
  if (process.env.PUBLIC_TEST_HOLD_STAGE === "1" && String(destination).includes(".kirari-external-dist-")) {
    fs.writeFileSync(process.env.PUBLIC_TEST_STAGE_READY, String(destination));
    while (!fs.existsSync(process.env.PUBLIC_TEST_STAGE_RELEASE)) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    }
  }
  return nativeCpSync(source, destination, ...args);
};
syncBuiltinESMExports();
`);

	return { parent, root, sitePackage, source, bin, publisher, preload };
}

function startBuild(fixture, { role, holdStage = false, holdBuildChild = false, env = {} } = {}) {
	const buildStarted = join(fixture.parent, `${role}.build-started`);
	const buildChildReady = join(fixture.parent, `${role}.build-child-ready`);
	const buildChildTerminating = join(fixture.parent, `${role}.build-child-terminating`);
	const buildChildRelease = join(fixture.parent, `${role}.build-child-release`);
	const buildChildExited = join(fixture.parent, `${role}.build-child-exited`);
	const stageReady = join(fixture.parent, `${role}.stage-ready`);
	const stageRelease = join(fixture.parent, `${role}.stage-release`);
	const result = { child: undefined, stdout: "", stderr: "", exit: undefined };
	const child = spawn(process.execPath, [fixture.publisher, fixture.source], {
		cwd: fixture.root,
		stdio: ["ignore", "pipe", "pipe"],
		env: {
			...process.env,
			PATH: `${fixture.bin}${process.platform === "win32" ? ";" : ":"}${process.env.PATH ?? ""}`,
			NODE_OPTIONS: [process.env.NODE_OPTIONS, `--require=${fixture.preload}`].filter(Boolean).join(" "),
			PUBLIC_TEST_BUILD_STARTED: buildStarted,
			PUBLIC_TEST_BUILD_CONTENT: `${role} static output`,
			PUBLIC_TEST_HOLD_BUILD_CHILD: holdBuildChild ? "1" : "",
			PUBLIC_TEST_BUILD_CHILD_READY: buildChildReady,
			PUBLIC_TEST_BUILD_CHILD_TERMINATING: buildChildTerminating,
			PUBLIC_TEST_BUILD_CHILD_RELEASE: buildChildRelease,
			PUBLIC_TEST_BUILD_CHILD_EXITED: buildChildExited,
			PUBLIC_TEST_HOLD_STAGE: holdStage ? "1" : "",
			PUBLIC_TEST_STAGE_READY: stageReady,
			PUBLIC_TEST_STAGE_RELEASE: stageRelease,
			...env,
		},
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
	result.exited = new Promise((resolve) => {
		child.once("exit", (code, signal) => resolve({ code, signal }));
	});
	result.buildStarted = buildStarted;
	result.buildChildReady = buildChildReady;
	result.buildChildTerminating = buildChildTerminating;
	result.buildChildRelease = buildChildRelease;
	result.buildChildExited = buildChildExited;
	result.stageReady = stageReady;
	result.stageRelease = stageRelease;
	return result;
}

async function waitForFile(path, build, timeoutMs = 10_000) {
	const deadline = Date.now() + timeoutMs;
	while (!existsSync(path)) {
		if (build.child.exitCode !== null) {
			throw new Error(`Publisher exited before ${path} appeared: ${build.stdout}\n${build.stderr}`);
		}
		if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${path}`);
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
}

async function waitForExit(build, timeoutMs = 10_000) {
	const timedOut = Symbol("timed out");
	let timer;
	try {
		const exit = await Promise.race([
			build.done,
			new Promise((resolve) => { timer = setTimeout(() => resolve(timedOut), timeoutMs); }),
		]);
		return exit === timedOut ? undefined : exit;
	} finally {
		clearTimeout(timer);
	}
}

function seedDist(fixture, content) {
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

function activeTickets(fixture) {
	const [queueRoot] = readdirSync(fixture.sitePackage).filter((name) => name.startsWith(".kirari-external-publish-locks-"));
	if (!queueRoot) return [];
	return readdirSync(join(fixture.sitePackage, queueRoot)).filter((name) => /^\d+$/.test(name));
}

function destination(fixture) {
	return join(realpathSync(fixture.sitePackage), "dist");
}

function lockRoot(fixture) {
	const output = destination(fixture);
	return join(fixture.sitePackage, `.kirari-external-publish-locks-${createHash("sha256").update(output).digest("hex")}`);
}

test("a waiting publisher cannot recover an active stage, and an aborted waiter leaves it alone", async () => {
	const fixture = makeFixture();
	seedDist(fixture, "previous static output");
	const holder = startBuild(fixture, { role: "holder", holdStage: true });
	let abortedWaiter;
	try {
		await waitForFile(holder.stageReady, holder);
		const [activeStage] = stagingRoots(fixture);
		assert.ok(activeStage, "the holder must have a live output stage before the contender starts");
		abortedWaiter = startBuild(fixture, { role: "aborted-waiter" });
		const waiterExit = await waitForExit(abortedWaiter, 250);
		assert.equal(waiterExit, undefined, "the contender must wait for the destination lock");
		assert.ok(existsSync(join(fixture.sitePackage, activeStage)), "the active publisher's stage must remain intact");
		assert.equal(output(fixture), "previous static output");
		abortedWaiter.child.kill("SIGKILL");
		assert.equal((await abortedWaiter.done).signal, "SIGKILL");
		assert.ok(existsSync(join(fixture.sitePackage, activeStage)), "an aborted waiter must not remove the holder's stage");
		assert.equal(output(fixture), "previous static output");

		writeFileSync(holder.stageRelease, "release");
		const holderExit = await holder.done;
		assert.deepEqual(holderExit, { code: 0, signal: null }, `${holder.stdout}\n${holder.stderr}`);
		assert.equal(output(fixture), "holder static output");

		const retry = startBuild(fixture, { role: "after-waiter" });
		const retryExit = await retry.done;
		assert.deepEqual(retryExit, { code: 0, signal: null }, `${retry.stdout}\n${retry.stderr}`);
		assert.equal(output(fixture), "after-waiter static output");
		assert.deepEqual(stagingRoots(fixture), []);
		assert.deepEqual(activeTickets(fixture), []);
	} finally {
		writeFileSync(holder.stageRelease, "release");
		if (abortedWaiter?.child.exitCode === null) abortedWaiter.child.kill("SIGKILL");
		if (holder.child.exitCode === null) await waitForExit(holder);
		if (abortedWaiter && abortedWaiter.child.exitCode === null) await waitForExit(abortedWaiter);
	}
});

test("concurrent recovery contenders serialize after a publisher is killed", async () => {
	const fixture = makeFixture();
	seedDist(fixture, "previous static output");
	const holder = startBuild(fixture, { role: "holder", holdStage: true });
	try {
		await waitForFile(holder.stageReady, holder);
		assert.equal(stagingRoots(fixture).length, 1);
		holder.child.kill("SIGKILL");
		const interrupted = await holder.done;
		assert.equal(interrupted.signal, "SIGKILL");
		assert.equal(output(fixture), "previous static output");

		const retryA = startBuild(fixture, { role: "retry-a" });
		const retryB = startBuild(fixture, { role: "retry-b" });
		const [retryAExit, retryBExit] = await Promise.all([retryA.done, retryB.done]);
		assert.deepEqual(retryAExit, { code: 0, signal: null }, `${retryA.stdout}\n${retryA.stderr}`);
		assert.deepEqual(retryBExit, { code: 0, signal: null }, `${retryB.stdout}\n${retryB.stderr}`);
		assert.ok(["retry-a static output", "retry-b static output"].includes(output(fixture)));
		assert.deepEqual(stagingRoots(fixture), []);
		assert.deepEqual(activeTickets(fixture), []);
	} finally {
		writeFileSync(holder.stageRelease, "release");
		if (holder.child.exitCode === null) holder.child.kill("SIGKILL");
	}
});

test("a killed publisher keeps its temp and destination ticket guarded until its build child stops", async () => {
	const fixture = makeFixture();
	seedDist(fixture, "previous static output");
	const holder = startBuild(fixture, { role: "child-holder", holdBuildChild: true });
	let retry;
	try {
		await waitForFile(holder.buildChildReady, holder);
		const [activeTemp] = readdirSync(fixture.parent).filter((name) => name.startsWith(".kirari-external-build-"));
		assert.ok(activeTemp, "the running child must be inside its publisher's build workspace");

		holder.child.kill("SIGKILL");
		assert.equal((await holder.exited).signal, "SIGKILL");

		retry = startBuild(fixture, { role: "child-retry" });
		const retryExit = await waitForExit(retry, 200);
		assert.equal(retryExit, undefined, "recovery must wait while the orphaned build child is being stopped");
		assert.ok(existsSync(join(fixture.parent, activeTemp)), "recovery must preserve the active child's workspace");
		assert.equal(existsSync(holder.buildChildExited), false, "the old build child must still be alive during the wait");
		assert.equal(output(fixture), "previous static output", "the contender must not publish while the old build child is stopping");
		await waitForFile(holder.buildChildTerminating, retry);
		await waitForFile(holder.buildChildExited, retry);

		const finalExit = await retry.done;
		assert.deepEqual(finalExit, { code: 0, signal: null }, `${retry.stdout}\n${retry.stderr}`);
		assert.equal(output(fixture), "child-retry static output");
		assert.deepEqual(stagingRoots(fixture), []);
		assert.deepEqual(activeTickets(fixture), []);
	} finally {
		writeFileSync(holder.buildChildRelease, "release");
		if (holder.child.exitCode === null && holder.child.signalCode === null) holder.child.kill("SIGKILL");
		if (retry?.child.exitCode === null) retry.child.kill("SIGKILL");
		if (retry?.child.exitCode === null) await waitForExit(retry);
	}
});

test("a reused PID with a different process identity is treated as stale", async () => {
	const fixture = makeFixture();
	seedDist(fixture, "previous static output");
	const queueRoot = lockRoot(fixture);
	mkdirSync(queueRoot, { recursive: true });
	writeFileSync(join(queueRoot, "00000000000000000001"), JSON.stringify({
		version: 1,
		destination: destination(fixture),
		pid: process.pid,
		hostname: hostname(),
		processStart: "different-process-instance",
		token: randomUUID(),
	}));

	const retry = startBuild(fixture, { role: "pid-reuse" });
	const retryExit = await retry.done;
	assert.deepEqual(retryExit, { code: 0, signal: null }, `${retry.stdout}\n${retry.stderr}`);
	assert.equal(output(fixture), "pid-reuse static output");
	assert.deepEqual(activeTickets(fixture), []);
});

test("process identity stays stable across timezone changes without cleaning its active temp", { skip: process.platform !== "darwin" }, async () => {
	const fixture = makeFixture();
	seedDist(fixture, "previous static output");
	const processStart = spawnSync("ps", ["-o", "lstart=", "-p", String(process.pid)], {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "ignore"],
		env: { ...process.env, LC_ALL: "C", TZ: "UTC" },
	});
	assert.equal(processStart.status, 0);
	const start = processStart.stdout.trim();
	assert.ok(start);
	const queueRoot = lockRoot(fixture);
	mkdirSync(queueRoot, { recursive: true });
	writeFileSync(join(queueRoot, "00000000000000000001"), JSON.stringify({
		version: 1,
		destination: destination(fixture),
		pid: process.pid,
		hostname: hostname(),
		processStart: `ps:${start}`,
		token: randomUUID(),
	}));
	const activeTemp = `.kirari-external-build-${createHash("sha256").update(destination(fixture)).digest("hex")}-active`;
	mkdirSync(join(fixture.parent, activeTemp));
	const contender = startBuild(fixture, { role: "timezone-contender", env: { TZ: "Pacific/Honolulu" } });
	try {
		assert.equal(await waitForExit(contender, 250), undefined, "the live ticket must remain locked across timezone changes");
		assert.ok(activeTickets(fixture).includes("00000000000000000001"), "the live owner's ticket must remain queued ahead of the contender");
		assert.ok(existsSync(join(fixture.parent, activeTemp)), "recovery must preserve a temp owned by the live process");
		assert.equal(existsSync(contender.buildStarted), false, "the contender must not start while the live owner holds the lock");
	} finally {
		contender.child.kill("SIGKILL");
		await waitForExit(contender);
	}
});

test("publishers targeting different canonical dist paths do not block each other", async () => {
	const first = makeFixture();
	const second = makeFixture();
	seedDist(first, "first previous output");
	seedDist(second, "second previous output");
	const firstBuild = startBuild(first, { role: "independent-first", holdStage: true });
	const secondBuild = startBuild(second, { role: "independent-second", holdStage: true });
	try {
		await Promise.all([waitForFile(firstBuild.stageReady, firstBuild), waitForFile(secondBuild.stageReady, secondBuild)]);
		assert.equal(stagingRoots(first).length, 1);
		assert.equal(stagingRoots(second).length, 1);
		writeFileSync(firstBuild.stageRelease, "release");
		writeFileSync(secondBuild.stageRelease, "release");
		const [firstExit, secondExit] = await Promise.all([firstBuild.done, secondBuild.done]);
		assert.deepEqual(firstExit, { code: 0, signal: null }, `${firstBuild.stdout}\n${firstBuild.stderr}`);
		assert.deepEqual(secondExit, { code: 0, signal: null }, `${secondBuild.stdout}\n${secondBuild.stderr}`);
		assert.equal(output(first), "independent-first static output");
		assert.equal(output(second), "independent-second static output");
		assert.deepEqual(stagingRoots(first), []);
		assert.deepEqual(stagingRoots(second), []);
	} finally {
		writeFileSync(firstBuild.stageRelease, "release");
		writeFileSync(secondBuild.stageRelease, "release");
		if (firstBuild.child.exitCode === null) firstBuild.child.kill("SIGKILL");
		if (secondBuild.child.exitCode === null) secondBuild.child.kill("SIGKILL");
		if (firstBuild.child.exitCode === null) await waitForExit(firstBuild);
		if (secondBuild.child.exitCode === null) await waitForExit(secondBuild);
	}
});
