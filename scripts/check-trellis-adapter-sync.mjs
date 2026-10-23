#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const canonicalRoot = join(repoRoot, ".agents/skills");
const adapters = [
	{
		root: ".opencode/skills",
		missingExceptions: [
			// These entry points are .opencode/commands/trellis/{continue,finish-work}.md.
			"trellis-continue/SKILL.md",
			"trellis-finish-work/SKILL.md",
			// Startup is injected by .opencode/plugins/session-start.js.
			"trellis-start/SKILL.md",
		],
	},
	{
		root: ".reasonix/skills",
		// .trellis/.template-hashes.json owns trellis-start only in the Codex skill set.
		missingExceptions: ["trellis-start/SKILL.md"],
		// Reasonix exposes its implementation agent as a runAs: subagent skill.
		extraExceptions: ["trellis-implement/SKILL.md"],
	},
	{
		root: ".claude/skills",
		missingExceptions: [
			// .trellis/.template-hashes.json tracks these as Claude commands.
			"trellis-continue/SKILL.md",
			"trellis-finish-work/SKILL.md",
			// Claude uses .claude/hooks/session-start.py rather than the Codex skill.
			"trellis-start/SKILL.md",
		],
		optional: true,
		enabled: process.env.CHECK_OPTIONAL_TRELLIS_ADAPTERS === "1",
	},
];

const failures = [];
const canonicalFiles = new Set(listFiles(canonicalRoot));

for (const adapter of adapters) {
	if (adapter.optional && !adapter.enabled) continue;
	const adapterRoot = join(repoRoot, adapter.root);
	if (!existsSync(adapterRoot)) {
		if (!adapter.optional) failures.push(`${adapter.root} is missing`);
		continue;
	}

	const adapterFiles = new Set(listFiles(adapterRoot));
	for (const file of canonicalFiles) {
		if (!adapterFiles.has(file)) {
			if (!adapter.missingExceptions?.includes(file)) {
				failures.push(`${adapter.root}/${file} is missing (canonical: .agents/skills/${file})`);
			}
			continue;
		}
		const adapterPath = join(adapterRoot, file);
		const canonicalPath = join(canonicalRoot, file);
		if (readFileSync(canonicalPath).compare(readFileSync(adapterPath)) !== 0) {
			failures.push(`${adapter.root}/${file} differs from .agents/skills/${file}`);
		}
	}
	for (const file of adapterFiles) {
		if (!canonicalFiles.has(file) && !adapter.extraExceptions?.includes(file)) {
			failures.push(`${adapter.root}/${file} has no canonical file at .agents/skills/${file}`);
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
