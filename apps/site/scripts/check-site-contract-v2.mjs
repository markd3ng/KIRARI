#!/usr/bin/env node

import { validateSiteContractV2 } from "./site-contract-v2.mjs";

function parseArgs(args) {
	const [siteRoot, ...rest] = args;
	if (!siteRoot) throw new Error("Usage: node apps/site/scripts/check-site-contract-v2.mjs <site-directory> [--core-sha <40-character-sha>]");
	let selectedCoreSha;
	for (let index = 0; index < rest.length; index += 1) {
		if (rest[index] === "--core-sha" && rest[index + 1]) {
			selectedCoreSha = rest[++index];
		} else {
			throw new Error(`Unknown or incomplete option: ${rest[index]}`);
		}
	}
	return { siteRoot, selectedCoreSha };
}

try {
	const args = parseArgs(process.argv.slice(2));
	const result = validateSiteContractV2(args.siteRoot, { selectedCoreSha: args.selectedCoreSha });
	console.log(JSON.stringify({
		valid: true,
		schemaVersion: result.schemaVersion,
		core: result.core,
		gitlinkSha: result.gitlinkSha,
		coreCheckoutSha: result.coreCheckoutSha,
		mappings: result.mappings,
		inventory: result.inventory,
	}, null, 2));
} catch (error) {
	console.error(`[site-contract-v2] ERROR  ${error.message}`);
	process.exitCode = 1;
}
