#!/usr/bin/env node

import { migrateSiteProfileToV2 } from "./site-contract-v2-migration.mjs";

function parseArgs(args) {
	const result = { apply: false, coreRepository: "markd3ng/KIRARI" };
	for (let index = 0; index < args.length; index += 1) {
		const option = args[index];
		if (option === "--apply") result.apply = true;
		else if (["--source", "--target", "--report", "--core-sha", "--core-repository"].includes(option)) {
			if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`${option} requires a value.`);
			const key = {
				"--source": "sourceRoot",
				"--target": "targetRoot",
				"--report": "reportPath",
				"--core-sha": "coreSha",
				"--core-repository": "coreRepository",
			}[option];
			result[key] = args[++index];
		} else throw new Error(`Unknown option: ${option}`);
	}
	for (const key of ["sourceRoot", "targetRoot", "reportPath", "coreSha"]) {
		if (!result[key]) throw new Error(`--${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} is required.`);
	}
	return result;
}

try {
	const result = migrateSiteProfileToV2(...migrationArguments(parseArgs(process.argv.slice(2))));
	console.log(`[site-profile-migration] inventory report: ${result.report}`);
	console.log(`[site-profile-migration] ${result.plan.entries.length} inputs inventoried; ${result.plan.exclusions.length} exclusions; ${result.plan.blockers.length} blockers.`);
	if (result.plan.blockers.length) {
		for (const blocker of result.plan.blockers) console.error(`[site-profile-migration] BLOCK  ${blocker.path}: ${blocker.reason}`);
		process.exitCode = 1;
	} else if (result.applied) {
		console.log(`[site-profile-migration] migrated Site Contract v2 output: ${result.plan.targetRoot}`);
	} else {
		console.log(`[site-profile-migration] inventory written; pass --apply to create output at ${result.plan.targetRoot}`);
	}
} catch (error) {
	console.error(`[site-profile-migration] ERROR  ${error.message}`);
	process.exitCode = 1;
}

function migrationArguments({ sourceRoot, targetRoot, ...options }) {
	return [sourceRoot, targetRoot, options];
}
