#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { cpSync, existsSync, linkSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { hostname } from "node:os";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const sitePackage = join(repoRoot, "apps/site");
const LOCK_WAIT_MS = 10 * 60 * 1000;
const LOCK_POLL_MS = 25;
const sleepCell = new Int32Array(new SharedArrayBuffer(4));
const BUILD_WATCHDOG_SOURCE = String.raw`
const { spawn, spawnSync } = require("node:child_process");
const { existsSync, renameSync, unlinkSync, writeFileSync } = require("node:fs");
const { randomUUID } = require("node:crypto");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const procInfo = (pid) => {
  try {
    const stat = require("node:fs").readFileSync("/proc/" + pid + "/stat", "utf8");
    const fields = stat.slice(stat.lastIndexOf(")") + 2).trim().split(/\s+/);
    return { state: fields[0], start: fields[19] ? "proc:" + fields[19] : null };
  } catch {
    try {
      const result = spawnSync("ps", ["-o", "lstart=", "-p", String(pid)], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], env: { ...process.env, LC_ALL: "C", TZ: "UTC" } });
      const start = result.status === 0 ? result.stdout.trim() : "";
      return { state: null, start: start ? "ps:" + start : null };
    } catch {
      return { state: null, start: null };
    }
  }
};
const parentAlive = () => {
  const pid = Number(process.env.KIRARI_WATCHDOG_PARENT_PID);
  try { process.kill(pid, 0); } catch (error) { if (error.code === "ESRCH") return false; return true; }
  const current = procInfo(pid);
  if (current.state === "Z" || current.state === "X") return false;
  const expected = process.env.KIRARI_WATCHDOG_PARENT_START || "";
  return !expected || !current.start || current.start === expected;
};
const publishResult = (value) => {
  const target = process.env.KIRARI_WATCHDOG_RESULT;
  const temporary = target + "." + process.pid + "." + randomUUID() + ".tmp";
  writeFileSync(temporary, JSON.stringify(value), { flag: "wx" });
  renameSync(temporary, target);
};
const cleanup = () => {
  for (const path of [process.env.KIRARI_WATCHDOG_START, process.env.KIRARI_WATCHDOG_ABORT, process.env.KIRARI_WATCHDOG_GUARD]) {
    try { unlinkSync(path); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
};
const processGroupAlive = (pid) => {
  if (process.platform === "win32") return true;
  try { process.kill(-pid, 0); return true; } catch (error) { return error.code !== "ESRCH"; }
};
const signalBuildTree = (pid, signal) => {
  if (process.platform === "win32") {
    if (signal === "SIGTERM") spawnSync("taskkill", ["/pid", String(pid), "/t", "/f"], { stdio: "ignore" });
    else { try { process.kill(pid, "SIGKILL"); } catch {} }
    return;
  }
  try { process.kill(-pid, signal); } catch (error) { if (error.code !== "ESRCH" && error.code !== "EPERM") throw error; }
};
const stopBuildTree = async (child, childClosed, didChildClose) => {
  if (!child.pid) return;
  signalBuildTree(child.pid, "SIGTERM");
  const graceDeadline = Date.now() + 400;
  while (Date.now() < graceDeadline && processGroupAlive(child.pid)) await sleep(20);
  if (process.platform !== "win32") {
    while (processGroupAlive(child.pid)) {
      signalBuildTree(child.pid, "SIGKILL");
      await sleep(50);
    }
  } else {
    while (!didChildClose()) {
      signalBuildTree(child.pid, "SIGTERM");
      await sleep(50);
    }
  }
  await childClosed;
};
let activeChild;
let activeChildExit;
let activeChildClosed;
const run = async () => {
  const bootstrapDeadline = Date.now() + 30000;
  while (!existsSync(process.env.KIRARI_WATCHDOG_START)) {
    if (existsSync(process.env.KIRARI_WATCHDOG_ABORT) || !parentAlive() || Date.now() >= bootstrapDeadline) {
      cleanup();
      return;
    }
    await sleep(20);
  }
  if (!parentAlive()) { cleanup(); return; }
  let childClosedResolve;
  activeChildClosed = new Promise((resolve) => { childClosedResolve = resolve; });
  activeChild = spawn("pnpm", ["run", "build"], {
    cwd: process.env.KIRARI_WATCHDOG_CWD,
    stdio: "inherit",
    env: JSON.parse(process.env.KIRARI_WATCHDOG_BUILD_ENV),
    detached: process.platform !== "win32",
  });
  activeChild.once("error", (error) => { activeChildExit = { status: null, signal: null, error: error.message }; });
  activeChild.once("close", (status, signal) => {
    activeChildExit = activeChildExit || { status, signal };
    childClosedResolve(activeChildExit);
  });
  while (!activeChildExit) {
    const exited = await Promise.race([activeChildClosed, sleep(25).then(() => null)]);
    if (exited) break;
    if (!parentAlive()) {
      await stopBuildTree(activeChild, activeChildClosed, () => Boolean(activeChildExit));
      cleanup();
      return;
    }
  }
  if (process.platform !== "win32" && processGroupAlive(activeChild.pid)) {
    await stopBuildTree(activeChild, activeChildClosed, () => Boolean(activeChildExit));
  }
  publishResult(activeChildExit);
  cleanup();
};
run().catch(async (error) => {
  if (activeChild?.pid && !activeChildExit) {
    try { await stopBuildTree(activeChild, activeChildClosed, () => Boolean(activeChildExit)); } catch {}
  }
  try { publishResult({ status: null, signal: null, error: error.message }); } catch {}
  try { cleanup(); } catch {}
  process.exitCode = 1;
});
`;

function main(siteArgument) {
	if (!siteArgument) throw new Error("Usage: ./build.sh --site <directory>");
	const sourceSite = realpathSync(resolve(siteArgument));
	if (!lstatSync(sourceSite).isDirectory()) throw new Error(`Site input must be a directory: ${siteArgument}`);
	const dependencies = join(sitePackage, "node_modules");
	if (!existsSync(dependencies) || !lstatSync(realpathSync(dependencies)).isDirectory()) {
		throw new Error("Site dependencies are not installed. Run the repository's pinned pnpm install first.");
	}

	const destination = join(realpathSync(sitePackage), "dist");
	const temporaryParent = dirname(realpathSync(repoRoot));
	const destinationLock = acquireDestinationLock(destination);
	let temporaryRoot;
	let outputStage;
	let preserveOutputStage = false;
	try {
		recoverDistPublication();
		recoverExternalBuildTemps(temporaryParent, destination);
		temporaryRoot = mkdtempSync(join(temporaryParent, `.kirari-external-build-${destinationHash(destination)}-`));
		const temporarySite = join(temporaryRoot, "site");
		cpSync(sitePackage, temporarySite, {
			recursive: true,
			filter: (sourcePath) => {
				const rel = relative(sitePackage, sourcePath);
				if (!rel) return true;
				if (rel.split(sep).some((part) => part === ".env" || part.startsWith(".env.") || part === ".npmrc")) return false;
				const first = rel.split(sep)[0];
				if (first.startsWith(".kirari-external-publish-locks-")) return false;
				return !["node_modules", "dist", ".astro", "functions", "api", ".vercel"].includes(first);
			},
		});
		symlinkSync(realpathSync(dependencies), join(temporarySite, "node_modules"), "dir");

		const inheritedBuildEnv = new Set([
			"PATH", "HOME", "TMPDIR", "TMP", "TEMP", "LANG", "LC_ALL", "LC_CTYPE",
			"CI", "FORCE_COLOR", "NO_COLOR", "NODE_OPTIONS", "NODE_ENV", "VERCEL", "CF_PAGES", "PAGES",
		]);
		const buildEnvironment = Object.fromEntries(
			Object.entries(process.env).filter(([name]) => inheritedBuildEnv.has(name) || name.startsWith("PUBLIC_")),
		);
		const build = runBuildGuarded(destinationLock, temporarySite, {
			...buildEnvironment,
			KIRARI_SITE_SOURCE: sourceSite,
			KIRARI_BUILD_ONLY: "true",
		});
		if (build.error) throw build.error;
		if (build.status !== 0) {
			throw new Error(`External Site build failed${build.signal ? ` with signal ${build.signal}` : ` with exit code ${build.status}`}.`);
		}

		const builtDist = join(temporarySite, "dist");
		if (!existsSync(builtDist) || !lstatSync(builtDist).isDirectory()) {
			throw new Error(`External Site build did not create dist/: ${builtDist}`);
		}
		const entryPoint = join(builtDist, "index.html");
		if (!existsSync(entryPoint) || !lstatSync(entryPoint).isFile()) {
			throw new Error(`External Site build produced an invalid dist/: expected a regular index.html at ${entryPoint}`);
		}
		outputStage = mkdtempSync(join(sitePackage, ".kirari-external-dist-"));
		const candidateDist = join(outputStage, "dist");
		cpSync(builtDist, candidateDist, { recursive: true });
		try {
			installDist(candidateDist, outputStage);
		} catch (error) {
			preserveOutputStage = error.preserveStage === true;
			throw error;
		}
		console.log(`[external-build] Wrote static output to ${join(sitePackage, "dist")}`);
	} finally {
		try {
			if (temporaryRoot) rmSync(temporaryRoot, { recursive: true, force: false });
			if (outputStage && !preserveOutputStage && existsSync(outputStage)) rmSync(outputStage, { recursive: true, force: false });
		} finally {
			releaseDestinationLock(destinationLock);
		}
	}
}

function runBuildGuarded(lock, cwd, buildEnvironment) {
	const watcherToken = randomUUID();
	const markerBase = `.watchdog-${lock.owner.token}-${watcherToken}`;
	const startPath = join(lock.lockRoot, `${markerBase}.start`);
	const abortPath = join(lock.lockRoot, `${markerBase}.abort`);
	const resultPath = join(lock.lockRoot, `${markerBase}.result`);
	const guardPath = join(lock.lockRoot, `.guard-${lock.owner.token}-${watcherToken}`);
	const watchdog = spawn(process.execPath, ["-e", BUILD_WATCHDOG_SOURCE], {
		stdio: "inherit",
		env: {
			PATH: process.env.PATH ?? "",
			KIRARI_WATCHDOG_PARENT_PID: String(process.pid),
			KIRARI_WATCHDOG_PARENT_START: processStartIdentity(process.pid) ?? "",
			KIRARI_WATCHDOG_CWD: cwd,
			KIRARI_WATCHDOG_BUILD_ENV: JSON.stringify(buildEnvironment),
			KIRARI_WATCHDOG_START: startPath,
			KIRARI_WATCHDOG_ABORT: abortPath,
			KIRARI_WATCHDOG_RESULT: resultPath,
			KIRARI_WATCHDOG_GUARD: guardPath,
		},
	});
	if (!watchdog.pid) throw new Error("Could not start the external build watchdog.");
	const guard = {
		version: 1,
		destination: lock.owner.destination,
		ownerToken: lock.owner.token,
		pid: watchdog.pid,
		hostname: hostname(),
		processStart: processStartIdentity(watchdog.pid),
		token: watcherToken,
	};
	const pendingGuard = join(lock.lockRoot, `.guard-pending-${watcherToken}`);
	let gateOpened = false;
	try {
		writeFileSync(pendingGuard, JSON.stringify(guard), { flag: "wx" });
		linkSync(pendingGuard, guardPath);
		unlinkSync(pendingGuard);
		writeFileSync(startPath, "start", { flag: "wx" });
		gateOpened = true;

		while (true) {
			if (existsSync(resultPath)) {
				const result = JSON.parse(readFileSync(resultPath, "utf8"));
				for (const path of [resultPath, guardPath]) {
					try { unlinkSync(path); } catch (error) { if (error.code !== "ENOENT") throw error; }
				}
				return {
					status: result.status,
					signal: result.signal,
					error: result.error ? new Error(result.error) : undefined,
				};
			}
			if (!isOwnerAlive(guard)) {
				throw new Error("The external build watchdog exited without reporting a build result.");
			}
			Atomics.wait(sleepCell, 0, 0, LOCK_POLL_MS);
		}
	} catch (error) {
		if (!gateOpened) {
			try { writeFileSync(abortPath, "abort", { flag: "wx" }); } catch {}
			const deadline = Date.now() + 1000;
			while (Date.now() < deadline && isOwnerAlive(guard)) Atomics.wait(sleepCell, 0, 0, LOCK_POLL_MS);
		}
		for (const path of [pendingGuard, guardPath, startPath, abortPath, resultPath]) {
			try { unlinkSync(path); } catch (cleanupError) { if (cleanupError.code !== "ENOENT") throw cleanupError; }
		}
		throw error;
	}
}

function acquireDestinationLock(destination) {
	const lockRoot = join(dirname(destination), `.kirari-external-publish-locks-${destinationHash(destination)}`);
	mkdirSync(lockRoot, { recursive: true });
	const lockRootStat = lstatSync(lockRoot);
	if (lockRootStat.isSymbolicLink() || !lockRootStat.isDirectory()) {
		throw new Error(`Refusing to use an invalid external publisher lock directory: ${lockRoot}`);
	}

	const owner = makeOwner(destination);
	const ticket = createTicket(lockRoot, owner);
	const deadline = Date.now() + LOCK_WAIT_MS;
	while (true) {
		cleanupDeadTickets(lockRoot, destination);
		const firstTicket = readQueueEntries(lockRoot).find((entry) => entry.kind === "ticket");
		if (firstTicket?.path === ticket.path && sameOwner(readOwner(firstTicket.path), owner)) {
			return { lockRoot, ticket, owner };
		}
		if (Date.now() >= deadline) {
			releaseTicket(lockRoot, ticket, owner);
			throw new Error(`Timed out waiting for another external build publishing to ${destination}`);
		}
		Atomics.wait(sleepCell, 0, 0, LOCK_POLL_MS);
	}
}

function createTicket(lockRoot, owner) {
	const pendingPath = join(lockRoot, `.pending-${owner.pid}-${owner.token}`);
	writeFileSync(pendingPath, JSON.stringify(owner), { flag: "wx" });
	try {
		while (true) {
			const sequence = maxQueueSequence(lockRoot) + 1n;
			const ticket = { sequence, path: join(lockRoot, formatSequence(sequence)) };
			try {
				linkSync(pendingPath, ticket.path);
				return ticket;
			} catch (error) {
				if (error.code !== "EEXIST") throw error;
			}
		}
	} finally {
		unlinkSync(pendingPath);
	}
}

function releaseDestinationLock(lock) {
	releaseTicket(lock.lockRoot, lock.ticket, lock.owner);
}

function releaseTicket(lockRoot, ticket, owner) {
	const currentOwner = readOwner(ticket.path);
	if (!sameOwner(currentOwner, owner)) return;
	removeOwnerGuards(lockRoot, owner);
	const maxSequence = maxQueueSequence(lockRoot);
	if (ticket.sequence === maxSequence) {
		// Keep the highest retired ID so stale contenders can never target a reused ticket path.
		const highwater = join(lockRoot, `.highwater-${formatSequence(ticket.sequence)}`);
		try {
			renameSync(ticket.path, highwater);
		} catch (error) {
			if (error.code !== "ENOENT" && error.code !== "EEXIST" && error.code !== "ENOTEMPTY") throw error;
		}
	} else {
		try {
			unlinkSync(ticket.path);
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
		}
	}
	cleanupLowerHighwaters(lockRoot);
}

function cleanupDeadTickets(lockRoot, destination) {
	for (const name of readdirSync(lockRoot).filter((entry) => entry.startsWith(".pending-"))) {
		const pendingPath = join(lockRoot, name);
		const owner = readOwner(pendingPath);
		if (!isOwnerRecord(owner, destination) || isOwnerAlive(owner)) continue;
		try {
			unlinkSync(pendingPath);
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
		}
	}
	for (const entry of readQueueEntries(lockRoot)) {
		if (entry.kind !== "ticket") continue;
		const owner = readOwner(entry.path);
		if (!isOwnerRecord(owner, destination) || isOwnerAlive(owner) || ownerHasLiveGuard(lockRoot, owner)) continue;
		releaseTicket(lockRoot, entry, owner);
	}
	cleanupLowerHighwaters(lockRoot);
}

function ownerHasLiveGuard(lockRoot, owner) {
	const prefix = `.guard-${owner.token}-`;
	let active = false;
	for (const name of readdirSync(lockRoot).filter((entry) => entry.startsWith(prefix))) {
		const path = join(lockRoot, name);
		const guard = readOwner(path);
		if (!isGuardRecord(guard, owner)) {
			active = true;
			continue;
		}
		if (isOwnerAlive(guard)) {
			active = true;
			continue;
		}
		try { unlinkSync(path); } catch (error) { if (error.code !== "ENOENT") throw error; }
	}
	return active;
}

function isGuardRecord(guard, owner) {
	return Boolean(
		guard && guard.version === 1 && guard.destination === owner.destination && guard.ownerToken === owner.token &&
		Number.isSafeInteger(guard.pid) && guard.pid > 0 &&
		typeof guard.hostname === "string" && guard.hostname.length > 0 &&
		(guard.processStart === null || typeof guard.processStart === "string") &&
		typeof guard.token === "string" && guard.token.length >= 16,
	);
}

function removeOwnerGuards(lockRoot, owner) {
	for (const name of readdirSync(lockRoot).filter((entry) => entry.startsWith(`.guard-${owner.token}-`))) {
		try { unlinkSync(join(lockRoot, name)); } catch (error) { if (error.code !== "ENOENT") throw error; }
	}
}

function readQueueEntries(lockRoot) {
	// ponytail: O(queue length) scans; use a persistent counter if publisher contention makes directory scans costly.
	return readdirSync(lockRoot).flatMap((name) => {
		const ticket = /^(\d+)$/.exec(name);
		if (ticket) return [{ kind: "ticket", sequence: BigInt(ticket[1]), path: join(lockRoot, name) }];
		const highwater = /^\.highwater-(\d+)$/.exec(name);
		if (highwater) return [{ kind: "highwater", sequence: BigInt(highwater[1]), path: join(lockRoot, name) }];
		return [];
	}).sort((left, right) => left.sequence < right.sequence ? -1 : left.sequence > right.sequence ? 1 : left.kind === right.kind ? 0 : left.kind === "ticket" ? -1 : 1);
}

function maxQueueSequence(lockRoot) {
	let max = 0n;
	for (const entry of readQueueEntries(lockRoot)) if (entry.sequence > max) max = entry.sequence;
	return max;
}

function cleanupLowerHighwaters(lockRoot) {
	const max = maxQueueSequence(lockRoot);
	for (const entry of readQueueEntries(lockRoot)) {
		if (entry.kind !== "highwater" || entry.sequence >= max) continue;
		try {
			unlinkSync(entry.path);
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
		}
	}
}

function formatSequence(sequence) {
	return sequence.toString().padStart(20, "0");
}

function makeOwner(destination) {
	return {
		version: 1,
		destination,
		pid: process.pid,
		hostname: hostname(),
		processStart: processStartIdentity(process.pid),
		token: randomUUID(),
	};
}

function readOwner(path) {
	try {
		const stat = lstatSync(path);
		if (stat.isSymbolicLink() || !stat.isFile()) return undefined;
		return JSON.parse(readFileSync(path, "utf8"));
	} catch (error) {
		if (error.code === "ENOENT" || error instanceof SyntaxError) return undefined;
		throw error;
	}
}

function isOwnerRecord(owner, destination) {
	return Boolean(
		owner && owner.version === 1 && owner.destination === destination &&
		Number.isSafeInteger(owner.pid) && owner.pid > 0 &&
		typeof owner.hostname === "string" && owner.hostname.length > 0 &&
		(owner.processStart === null || typeof owner.processStart === "string") &&
		typeof owner.token === "string" && owner.token.length >= 16,
	);
}

function sameOwner(left, right) {
	return Boolean(
		left && right && left.version === right.version && left.destination === right.destination &&
		left.pid === right.pid && left.hostname === right.hostname &&
		left.processStart === right.processStart && left.token === right.token,
	);
}

function isOwnerAlive(owner) {
	if (!owner || owner.hostname !== hostname()) return true;
	try {
		process.kill(owner.pid, 0);
	} catch (error) {
		if (error.code === "ESRCH") return false;
		return true;
	}
	if (isZombie(owner.pid)) return false;
	const processStart = processStartIdentity(owner.pid);
	if (owner.processStart && processStart && owner.processStart !== processStart) return false;
	return true;
}

function isZombie(pid) {
	try {
		const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
		const fields = stat.slice(stat.lastIndexOf(")") + 2).trim().split(/\s+/);
		return fields[0] === "Z" || fields[0] === "X";
	} catch {
		return false;
	}
}

function processStartIdentity(pid) {
	try {
		const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
		const fields = stat.slice(stat.lastIndexOf(")") + 2).trim().split(/\s+/);
		if (fields[19]) return `proc:${fields[19]}`;
	} catch {}
	try {
		const result = spawnSync("ps", ["-o", "lstart=", "-p", String(pid)], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
			env: { ...process.env, LC_ALL: "C", TZ: "UTC" },
		});
		const started = result.status === 0 ? result.stdout.trim() : "";
		if (started) return `ps:${started}`;
	} catch {}
	return null;
}

function destinationHash(destination) {
	return createHash("sha256").update(destination).digest("hex");
}

function recoverExternalBuildTemps(parent, destination) {
	const prefix = `.kirari-external-build-${destinationHash(destination)}-`;
	for (const name of readdirSync(parent).filter((entry) => entry.startsWith(prefix)).sort()) {
		const temporaryRoot = join(parent, name);
		const stat = lstatMaybe(temporaryRoot);
		if (!stat || stat.isSymbolicLink() || !stat.isDirectory()) continue;
		rmSync(temporaryRoot, { recursive: true, force: false });
	}
}

function recoverDistPublication() {
	const destination = join(sitePackage, "dist");
	assertReplaceableDist(destination, lstatMaybe(destination));
	const staleStages = readdirSync(sitePackage)
		.filter((name) => name.startsWith(".kirari-external-dist-"))
		.sort();

	for (const name of staleStages) {
		const stageRoot = join(sitePackage, name);
		const stageStat = lstatSync(stageRoot);
		if (stageStat.isSymbolicLink() || !stageStat.isDirectory()) {
			throw new Error(`Refusing to recover an unexpected dist staging path: ${stageRoot}`);
		}

		const backup = join(stageRoot, "previous-dist");
		const backupStat = lstatMaybe(backup);
		if (backupStat) {
			if (backupStat.isSymbolicLink() || !backupStat.isDirectory()) {
				throw new Error(`Refusing to recover an invalid previous build output: ${backup}`);
			}
			if (!lstatMaybe(destination)) renameSync(backup, destination);
		}
		rmSync(stageRoot, { recursive: true, force: false });
	}
}

function installDist(candidateDist, stageRoot) {
	const destination = join(sitePackage, "dist");
	assertReplaceableDist(destination, lstatMaybe(destination));
	const backup = join(stageRoot, "previous-dist");
	let backedUp = false;
	try {
		if (lstatMaybe(destination)) {
			renameSync(destination, backup);
			backedUp = true;
		}
		renameSync(candidateDist, destination);
	} catch (error) {
		if (backedUp && lstatMaybe(backup)) {
			try {
				renameSync(backup, destination);
			} catch (rollbackError) {
				error.preserveStage = true;
				const failure = new AggregateError([error, rollbackError], `External dist install failed; prior output is preserved at ${backup}`);
				failure.preserveStage = true;
				throw failure;
			}
		}
		throw error;
	}
	if (backedUp) {
		try {
			rmSync(backup, { recursive: true, force: false });
		} catch (error) {
			const failure = new Error(`External dist installed, but previous output cleanup failed; backup remains at ${backup}`, { cause: error });
			failure.preserveStage = true;
			throw failure;
		}
	}
}

function assertReplaceableDist(destination, stat) {
	if (stat && (stat.isSymbolicLink() || !stat.isDirectory())) {
		throw new Error(`Refusing to replace a non-directory or symlink build output: ${destination}`);
	}
}

function lstatMaybe(path) {
	try {
		return lstatSync(path);
	} catch (error) {
		if (error.code === "ENOENT") return undefined;
		throw error;
	}
}

try {
	main(process.argv[2]);
} catch (error) {
	console.error(`[external-build] ERROR  ${error.message}`);
	process.exitCode = 1;
}
