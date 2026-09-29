#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, realpathSync, renameSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const sitePackage = join(repoRoot, "apps/site");

function main(siteArgument) {
	if (!siteArgument) throw new Error("Usage: ./build.sh --site <directory>");
	const sourceSite = realpathSync(resolve(siteArgument));
	if (!lstatSync(sourceSite).isDirectory()) throw new Error(`Site input must be a directory: ${siteArgument}`);
	const dependencies = join(sitePackage, "node_modules");
	if (!existsSync(dependencies) || !lstatSync(realpathSync(dependencies)).isDirectory()) {
		throw new Error("Site dependencies are not installed. Run the repository's pinned pnpm install first.");
	}

	const temporaryRoot = mkdtempSync(join(resolve(repoRoot, ".."), ".kirari-external-build-XXXXXX"));
	let outputStage;
	let preserveOutputStage = false;
	try {
		const temporarySite = join(temporaryRoot, "site");
		cpSync(sitePackage, temporarySite, {
			recursive: true,
			filter: (sourcePath) => {
				const rel = relative(sitePackage, sourcePath);
				if (!rel) return true;
				if (rel.split(sep).some((part) => part === ".env" || part.startsWith(".env.") || part === ".npmrc")) return false;
				const first = rel.split(sep)[0];
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
		const build = spawnSync("pnpm", ["run", "build"], {
			cwd: temporarySite,
			stdio: "inherit",
			env: {
				...buildEnvironment,
				KIRARI_SITE_SOURCE: sourceSite,
				KIRARI_BUILD_ONLY: "true",
			},
		});
		if (build.error) throw build.error;
		if (build.status !== 0) {
			throw new Error(`External Site build failed${build.signal ? ` with signal ${build.signal}` : ` with exit code ${build.status}`}.`);
		}

		const builtDist = join(temporarySite, "dist");
		if (!existsSync(builtDist) || !lstatSync(builtDist).isDirectory()) {
			throw new Error(`External Site build did not create dist/: ${builtDist}`);
		}
		outputStage = mkdtempSync(join(sitePackage, ".kirari-external-dist-XXXXXX"));
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
		rmSync(temporaryRoot, { recursive: true, force: false });
		if (outputStage && !preserveOutputStage && existsSync(outputStage)) rmSync(outputStage, { recursive: true, force: false });
	}
}

function installDist(candidateDist, stageRoot) {
	const destination = join(sitePackage, "dist");
	const destinationStat = lstatMaybe(destination);
	if (destinationStat) {
		const stat = destinationStat;
		if (stat.isSymbolicLink() || !stat.isDirectory()) {
			throw new Error(`Refusing to replace a non-directory or symlink build output: ${destination}`);
		}
	}
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
