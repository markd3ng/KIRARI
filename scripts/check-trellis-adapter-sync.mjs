#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const canonicalRoot = join(repoRoot, ".agents/skills");
const adapters = [
	{ name: "opencode", root: ".opencode/skills" },
	{ name: "reasonix", root: ".reasonix/skills" },
	{
		name: "claude",
		root: ".claude/skills",
		optional: true,
		enabled: process.env.CHECK_OPTIONAL_TRELLIS_ADAPTERS === "1",
	},
];

const failures = [];
const canonicalFiles = listFiles(canonicalRoot);

for (const adapter of adapters) {
	if (adapter.optional && !adapter.enabled) continue;
	const adapterRoot = join(repoRoot, adapter.root);
	if (!existsSync(adapterRoot)) {
		if (!adapter.optional) failures.push(`${adapter.root} is missing`);
		continue;
	}

	const adapterFiles = listFiles(adapterRoot);
	const commonFiles = adapterFiles.filter((file) => canonicalFiles.includes(file));
	for (const file of commonFiles) {
		const adapterPath = join(adapterRoot, file);
		const canonicalPath = join(canonicalRoot, file);
		if (readFileSync(canonicalPath).compare(readFileSync(adapterPath)) !== 0) {
			failures.push(`${adapter.root}/${file} differs from .agents/skills/${file}`);
		}
	}
}

if (failures.length > 0) {
	console.error("Trellis adapter skill drift detected:");
	for (const failure of failures) console.error(`- ${failure}`);
	process.exit(1);
}

function listFiles(root) {
	const output = [];
	walk("");
	return output.sort();

	function walk(relative) {
		for (const entry of readdirSync(join(root, relative))) {
			const child = join(relative, entry);
			if (statSync(join(root, child)).isDirectory()) {
				walk(child);
			} else {
				output.push(child);
			}
		}
	}
}
