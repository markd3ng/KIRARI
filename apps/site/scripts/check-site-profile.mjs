#!/usr/bin/env node

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateProfileSource } from "./profile-manifest.mjs";

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
if (args[0] === "--") args.shift();
if (args.length !== 2 || args[0] !== "--site" || !args[1]) {
	console.error("Usage: node apps/site/scripts/check-site-profile.mjs --site <directory>");
	process.exit(2);
}

try {
	const result = validateProfileSource(args[1], siteRoot);
	console.log(`External Site contract is valid: ${result.profileDir}`);
} catch (error) {
	console.error(`[site-profile-check] ${error.message}`);
	process.exitCode = 1;
}
