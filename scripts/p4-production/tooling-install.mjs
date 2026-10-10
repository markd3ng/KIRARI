#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createHash } from "node:crypto";
import { fingerprintInstalledTree, TOOLING_MATERIAL_SOURCE_PATHS } from "./tooling-identity.mjs";
import { npmRuntime, spawnNpm } from "./npm-runtime.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const TOOLING_INSTALL_ARGS = ["ci", "--prefix", "scripts/p4-production/tooling", "--registry=https://registry.npmjs.org"];

export function installProductionTooling({ outputDirectory, env = process.env, spawn = spawnSync }) {
	if (env.VERCEL_TOKEN || env.VERCEL_PRODUCTION_TOKEN) throw new Error("TOOLING_INSTALL_CREDENTIAL_PRESENT");
	mkdirSync(outputDirectory, { recursive: true });
	const sourceHashes = Object.fromEntries(TOOLING_MATERIAL_SOURCE_PATHS.map(path => [path, `sha256:${createHash("sha256").update(readFileSync(join(ROOT, path))).digest("hex")}`]));
	const home = mkdtempSync(join(tmpdir(), "kirari-tooling-install-home-"));
	try {
		// No Actions environment/path files, GitHub token, Vercel token, npm config,
		// or existing user credentials are forwarded to lifecycle scripts.
		const clean = Object.fromEntries(["LANG", "LC_ALL", "CI", "NO_COLOR", "FORCE_COLOR"].flatMap(key => typeof env[key] === "string" ? [[key, env[key]]] : []));
		clean.HOME = home;
		clean.PATH = `${dirname(process.execPath)}:/usr/bin:/bin`;
		const options = { cwd: ROOT, env: clean, encoding: "utf8", timeout: 300_000, maxBuffer: 16 * 1024 * 1024 };
		const npm = spawnNpm(spawn, ["--version"], options);
		const result = spawnNpm(spawn, TOOLING_INSTALL_ARGS, options);
		writeFileSync(join(outputDirectory, "npm-ci.txt"), `${result.stdout ?? ""}${result.stderr ?? ""}`);
		const receipt = { material_source_hashes: sourceHashes, install: { command: `npm ${TOOLING_INSTALL_ARGS.join(" ")}`, mode: "npm ci", lifecycle_scripts: "enabled", credential_absent: true, minimal_environment: true, temporary_home: true }, captured_at: new Date().toISOString(), node_version: process.version, npm_cli_sha256: npmRuntime().sha256, npm_tree_sha256: fingerprintInstalledTree(npmRuntime().packageRoot), npm_version: String(npm.stdout ?? "").trim(), exit_code: result.status, completed: result.status === 0 && !result.error && !result.signal && npm.status === 0 };
		writeFileSync(join(outputDirectory, "install-receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
		if (!receipt.completed) throw new Error("TOOLING_LOCKED_INSTALL_FAILED");
		return receipt;
	} finally { rmSync(home, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	try { installProductionTooling({ outputDirectory: resolve(process.argv[2]) }); process.stdout.write("TOOLING_INSTALL_RESULT=PASS\n"); }
	catch { process.stderr.write("TOOLING_INSTALL_RESULT=FAIL\n"); process.exitCode = 1; }
}
