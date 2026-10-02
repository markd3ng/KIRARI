#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
	createProvenanceManifest,
	digestBuildEnvironment,
	digestArtifactTree,
	resolveGitInput,
	resolveSiteInput,
	validateProvenanceManifest,
} from "./composition-provenance.mjs";
import { SITE_SCHEMA_VERSION } from "../apps/site/scripts/profile-manifest.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const externalBuilder = join(repoRoot, "scripts/build-external-site.mjs");

function parseArguments(args) {
	const values = new Map();
	let requireSiteContractV2 = false;
	for (let index = 0; index < args.length; index += 1) {
		const name = args[index];
		if (name === "--require-site-contract-v2") {
			if (requireSiteContractV2) throw new Error("Composition option was supplied more than once: --require-site-contract-v2");
			requireSiteContractV2 = true;
			continue;
		}
		if (!["--core-ref", "--site", "--site-ref", "--artifact-dir"].includes(name)) {
			throw new Error(`Unknown composition option: ${name}`);
		}
		if (values.has(name)) throw new Error(`Composition option was supplied more than once: ${name}`);
		const value = args[index + 1];
		if (!value || value.startsWith("--")) throw new Error(`Missing value for ${name}`);
		values.set(name, value);
		index += 1;
	}
	for (const name of ["--core-ref", "--site", "--artifact-dir"]) {
		if (!values.has(name)) throw new Error(`Required composition option is missing: ${name}`);
	}
	return {
		coreRef: values.get("--core-ref"),
		siteDirectory: resolve(values.get("--site")),
		siteRef: values.get("--site-ref"),
		artifactDirectory: resolve(values.get("--artifact-dir")),
		requireSiteContractV2,
	};
}

async function main(args) {
	let stage = "cli";
	let stagingDirectory;
	try {
		const options = parseArguments(args);

		stage = "core-resolution";
		const core = resolveGitInput({ directory: repoRoot, requestedRef: options.coreRef, label: "Core" });

		stage = "site-resolution";
		const siteInputPath = options.siteDirectory;
		const site = resolveSiteInput({ directory: siteInputPath, requestedRef: options.siteRef });
		if (site.kind === "git" && site.checkout_root === core.checkout_root) {
			throw new Error("Git Site input must be a separate checkout or worktree from the Core checkout.");
		}
		const siteDirectory = realpathSync(siteInputPath);
		stage = "site-contract-validation";
		const siteContractPath = join(siteDirectory, ".kirari", "site.toml");
		const hasSiteContractV2 = existsSync(siteContractPath);
		if (options.requireSiteContractV2 && !hasSiteContractV2) {
			throw new Error("Site Contract v2 is required for this composition, but .kirari/site.toml is missing at the selected Site root.");
		}
		let siteContract;
		if (hasSiteContractV2) {
			const { validateSiteContractV2 } = await import("../apps/site/scripts/site-contract-v2.mjs");
			siteContract = validateSiteContractV2(siteDirectory, { selectedCoreSha: core.resolved_sha });
		}

		stage = "artifact-path";
		const artifactPath = resolveArtifactPath(options.artifactDirectory);
		assertDisjointPath(artifactPath, core.checkout_root, "artifact directory", "Core checkout");
		assertDisjointPath(artifactPath, site.checkout_root ?? siteDirectory, "artifact directory", "Site checkout");
		if (lstatMaybe(artifactPath)) throw new Error(`Artifact directory already exists: ${artifactPath}`);

		stage = "toolchain-validation";
		const toolchain = describeToolchain();

		stage = "build-clock";
		const buildClock = resolveBuildClock(core, site);
		stagingDirectory = mkdtempSync(join(dirname(artifactPath), ".kirari-composition-"));

		stage = "site-build";
		const build = spawnSync(process.execPath, [externalBuilder, siteDirectory, "--dist-output", join(stagingDirectory, "dist"), "--source-date-epoch", String(buildClock.source_date_epoch)], {
			cwd: repoRoot,
			stdio: "inherit",
			env: { ...process.env, KIRARI_SELECTED_CORE_SHA: core.resolved_sha },
		});
		if (build.error) throw build.error;
		if (build.status !== 0) throw new Error(`External Site builder exited ${build.signal ? `with signal ${build.signal}` : `with status ${build.status}`}.`);

		stage = "input-recheck";
		const coreAfter = resolveGitInput({ directory: repoRoot, requestedRef: options.coreRef, label: "Core" });
		const siteAfter = resolveSiteInput({ directory: siteInputPath, requestedRef: options.siteRef });
		if (coreAfter.resolved_sha !== core.resolved_sha) throw new Error("Core checkout changed while the composed build was running.");
		if (identityKey(siteAfter) !== identityKey(site)) throw new Error("Site input changed while the composed build was running.");
		if (siteContract) {
			const { validateSiteContractV2 } = await import("../apps/site/scripts/site-contract-v2.mjs");
			const siteContractAfter = validateSiteContractV2(siteDirectory, { selectedCoreSha: core.resolved_sha });
			if (JSON.stringify(siteContractAfter) !== JSON.stringify(siteContract)) {
				throw new Error("Site Contract v2 changed while the composed build was running.");
			}
		}

		stage = "artifact-digest";
		const artifactDigest = digestArtifactTree(join(stagingDirectory, "dist"));

		stage = "provenance";
		const configuration = {
			entrypoint: "./build.sh --compose",
			build_mode: "external-site",
			output: "dist/",
			build_only: true,
			indexing_submissions: false,
			build_clock: buildClock,
			inherited_environment_digest: digestBuildEnvironment(),
		};
		const manifest = createProvenanceManifest({
			core,
			site,
			siteSchemaVersion: siteContract?.schemaVersion ?? SITE_SCHEMA_VERSION,
			toolchain,
			configuration,
			artifactDigest,
		});
		validateProvenanceManifest(manifest, { core, site, artifactDigest });
		writeFileSync(join(stagingDirectory, "provenance.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
		const contents = readdirSync(stagingDirectory).sort();
		if (contents.length !== 2 || contents[0] !== "dist" || contents[1] !== "provenance.json") {
			throw new Error(`Unexpected composition staging contents: ${contents.join(", ")}`);
		}

		stage = "artifact-publish";
		if (lstatMaybe(artifactPath)) throw new Error(`Artifact directory appeared before publication: ${artifactPath}`);
		renameSync(stagingDirectory, artifactPath);
		stagingDirectory = undefined;
		console.log(`[composition] Wrote artifact to ${artifactPath}`);
	} catch (error) {
		console.error(`[composition:${stage}] ERROR ${error.message}`);
		process.exitCode = 1;
	} finally {
		if (stagingDirectory && existsSync(stagingDirectory)) {
			try {
				rmSync(stagingDirectory, { recursive: true, force: false });
			} catch (error) {
				console.error(`[composition:cleanup] ERROR ${error.message}`);
				process.exitCode = 1;
			}
		}
	}
}

function resolveArtifactPath(path) {
	const name = basename(path);
	if (!name || name === ".") throw new Error(`Invalid artifact directory path: ${path}`);
	const parent = realpathSync(dirname(path));
	if (!lstatSync(parent).isDirectory()) throw new Error(`Artifact parent must be a directory: ${parent}`);
	return join(parent, name);
}

function assertDisjointPath(artifactPath, inputRoot, artifactLabel, inputLabel) {
	if (isWithin(artifactPath, inputRoot) || isWithin(inputRoot, artifactPath)) {
		throw new Error(`${artifactLabel} must be separate from the ${inputLabel}: ${artifactPath} <-> ${inputRoot}`);
	}
}

function isWithin(root, candidate) {
	const path = relative(root, candidate);
	return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path));
}

function identityKey(identity) {
	return JSON.stringify(Object.fromEntries(Object.entries(identity).filter(([key]) => key !== "checkout_root")));
}

function describeToolchain() {
	const packageManifest = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
	const declaredPnpm = /^pnpm@([^+]+)(?:\+.*)?$/.exec(packageManifest.packageManager ?? "")?.[1];
	if (!declaredPnpm) throw new Error("Core package.json must declare its pnpm toolchain.");
	const pnpm = spawnSync("pnpm", ["--version"], { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
	if (pnpm.error || pnpm.status !== 0) {
		throw new Error(`Could not read the active pnpm version: ${pnpm.stderr?.trim() || pnpm.error?.message || `exit ${pnpm.status}`}.`);
	}
	const pnpmVersion = pnpm.stdout.trim();
	if (pnpmVersion !== declaredPnpm) {
		throw new Error(`Active pnpm ${pnpmVersion} does not match Core package.json's declared pnpm ${declaredPnpm}.`);
	}
	const lockfilePath = join(repoRoot, "pnpm-lock.yaml");
	const lockfileDigest = createHash("sha256").update(readFileSync(lockfilePath)).digest("hex");
	let installedLockfile;
	try {
		installedLockfile = readFileSync(join(repoRoot, "node_modules", ".pnpm", "lock.yaml"));
	} catch (error) {
		throw new Error("A frozen pnpm install is required before composition; run `pnpm install --frozen-lockfile`.", { cause: error });
	}
	const installedLockfileDigest = createHash("sha256").update(installedLockfile).digest("hex");
	if (installedLockfileDigest !== lockfileDigest) {
		throw new Error("Installed pnpm dependency state does not match pnpm-lock.yaml; run `pnpm install --frozen-lockfile`.");
	}
	return {
		node: process.version,
		pnpm: pnpmVersion,
		platform: process.platform,
		architecture: process.arch,
		lockfile: { path: "pnpm-lock.yaml", digest: `sha256:${lockfileDigest}` },
	};
}

function resolveBuildClock(core, site) {
	const timestamps = [commitTimestamp(core, "Core")];
	if (site.kind === "git") timestamps.push(commitTimestamp(site, "Site"));
	return {
		source: "max-input-commit-time",
		source_date_epoch: Math.max(...timestamps),
		timezone: "UTC",
	};
}

function commitTimestamp(identity, label) {
	const result = spawnSync("git", ["-C", identity.checkout_root, "show", "-s", "--format=%ct", identity.resolved_sha], {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});
	if (result.error || result.status !== 0) {
		throw new Error(`${label} commit timestamp: Git could not read ${identity.resolved_sha}: ${result.stderr?.trim() || result.error?.message || `exit ${result.status}`}.`);
	}
	const value = result.stdout.trim();
	if (!/^(0|[1-9]\d*)$/.test(value)) throw new Error(`${label} commit timestamp: Git returned an invalid epoch value.`);
	const timestamp = Number(value);
	if (!Number.isSafeInteger(timestamp) || timestamp > 8_640_000_000_000) {
		throw new Error(`${label} commit timestamp: Git returned an epoch outside the valid Date range.`);
	}
	return timestamp;
}

function lstatMaybe(path) {
	try {
		return lstatSync(path);
	} catch (error) {
		if (error.code === "ENOENT") return undefined;
		throw error;
	}
}

await main(process.argv.slice(2));
