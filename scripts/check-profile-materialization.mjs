#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);

const mappings = [
	["packages/site-profile/kirari.config.toml", "apps/site/kirari.config.toml"],
	["packages/site-profile/content/posts", "apps/site/src/content/posts"],
	["packages/site-profile/content/spec", "apps/site/src/content/spec"],
	["packages/site-profile/data/friends.json", "apps/site/src/_data/friends.json"],
	["packages/site-profile/data/devices.json", "apps/site/src/_data/devices.json"],
	["packages/site-profile/assets/images/devices", "apps/site/public/images/devices"],
	["packages/site-profile/assets/favicon", "apps/site/public/favicon"],
	["packages/site-profile/assets/og", "apps/site/public/og"],
	["packages/site-profile/snippets", "apps/site/src/snippets"],
];

const materializedTargets = mappings.map(([, target]) => target);
const tracked = execFileSync("git", ["ls-files", "--", ...materializedTargets], {
	cwd: repoRoot,
	encoding: "utf8",
}).trim();

if (tracked) {
	console.error("Materialized profile outputs must not be tracked:");
	console.error(tracked);
	process.exit(1);
}

const mismatches = [];
for (const [source, target] of mappings) {
	const sourcePath = join(repoRoot, source);
	const targetPath = join(repoRoot, target);
	if (!existsSync(targetPath)) continue;
	comparePath(sourcePath, targetPath, source, target);
}

if (mismatches.length > 0) {
	console.error("Materialized profile outputs are out of sync:");
	for (const mismatch of mismatches) console.error(`- ${mismatch}`);
	process.exit(1);
}

function comparePath(sourcePath, targetPath, sourceLabel, targetLabel) {
	const sourceStat = statSync(sourcePath);
	const targetStat = statSync(targetPath);
	if (sourceStat.isDirectory() !== targetStat.isDirectory()) {
		mismatches.push(`${targetLabel} has a different file type from ${sourceLabel}`);
		return;
	}

	if (!sourceStat.isDirectory()) {
		if (readFileSync(sourcePath).compare(readFileSync(targetPath)) !== 0) {
			mismatches.push(`${targetLabel} differs from ${sourceLabel}`);
		}
		return;
	}

	const sourceEntries = listRelativeFiles(sourcePath);
	const targetEntries = listRelativeFiles(targetPath);
	const sourceSet = new Set(sourceEntries);
	const targetSet = new Set(targetEntries);

	for (const entry of sourceEntries) {
		if (!targetSet.has(entry)) {
			mismatches.push(`${targetLabel}/${entry} is missing`);
			continue;
		}
		comparePath(
			join(sourcePath, entry),
			join(targetPath, entry),
			`${sourceLabel}/${entry}`,
			`${targetLabel}/${entry}`,
		);
	}
	for (const entry of targetEntries) {
		if (!sourceSet.has(entry)) mismatches.push(`${targetLabel}/${entry} has no profile source`);
	}
}

function listRelativeFiles(root) {
	const output = [];
	walk(root, "");
	return output.sort();

	function walk(base, relative) {
		for (const entry of readdirSync(join(base, relative))) {
			const child = join(relative, entry);
			const childPath = join(base, child);
			if (statSync(childPath).isDirectory()) {
				walk(base, child);
			} else {
				output.push(child);
			}
		}
	}
}
