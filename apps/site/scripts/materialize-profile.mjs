#!/usr/bin/env node

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { materializeProfile, validateProfileSource } from "./profile-manifest.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const siteDir = resolve(scriptDir, "..");
const defaultProfileDir = resolve(scriptDir, "..", "..", "..", "packages", "site-profile");

function parseArgs(args) {
	let sourceDir = process.env.KIRARI_SITE_SOURCE || defaultProfileDir;
	let checkOnly = false;
	for (let index = 0; index < args.length; index += 1) {
		if (args[index] === "--site") {
			if (!args[index + 1]) throw new Error("--site requires a Site directory path.");
			sourceDir = args[index + 1];
			index += 1;
		} else if (args[index] === "--check") {
			checkOnly = true;
		} else {
			throw new Error(`Unknown option: ${args[index]}`);
		}
	}
	return { sourceDir, checkOnly };
}

try {
	const { sourceDir, checkOnly } = parseArgs(process.argv.slice(2));
	if (checkOnly) {
		const result = validateProfileSource(sourceDir, siteDir);
		console.log(`[profile-check] valid Site input: ${result.profileDir}`);
	} else {
		const manifest = materializeProfile(sourceDir, siteDir);
		for (const target of manifest.materialized) console.log(`[materialize-profile] COPY  ${target}`);
		for (const target of manifest.omittedOptional) console.log(`[materialize-profile] EMPTY  ${target}`);
		console.log(`[materialize-profile] DONE  ${manifest.materialized.length} mappings`);
	}
} catch (error) {
	console.error(`[materialize-profile] ERROR  ${error.message}`);
	process.exitCode = 1;
}
