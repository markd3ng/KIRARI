#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PROFILE_MAPPINGS, validateProfileSource } from "../apps/site/scripts/profile-manifest.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const profileRoot = join(repoRoot, "packages/site-profile");
const siteRoot = join(repoRoot, "apps/site");
validateProfileSource(profileRoot, siteRoot);
const targets = PROFILE_MAPPINGS.map(({ target }) => `apps/site/${target}`);
targets.push("apps/site/.kirari-profile-manifest.json");
const tracked = execFileSync("git", ["ls-files", "--", ...targets], {
	cwd: repoRoot,
	encoding: "utf8",
})
	.trim()
	.split("\n")
	.filter(Boolean);

if (tracked.length > 0) {
	console.error("Generated profile outputs must not be tracked:");
	for (const path of tracked) console.error(`- ${path}`);
	process.exit(1);
}

const mismatches = [];
for (const mapping of PROFILE_MAPPINGS) {
	const sourcePath = join(profileRoot, mapping.source);
	const targetPath = join(siteRoot, mapping.target);
	const sourceExists = existsSync(sourcePath);
	const targetExists = existsSync(targetPath);
	if (!sourceExists) {
		if (mapping.emptyWhenMissing && targetExists) {
			const targetStat = lstatSync(targetPath);
			if (!targetStat.isDirectory() || readdirSync(targetPath).length > 0) {
				mismatches.push(`${mapping.target} should be empty because optional ${mapping.source} is absent`);
			}
		} else if (targetExists) {
			mismatches.push(`${mapping.target} exists without optional source ${mapping.source}`);
		}
		continue;
	}
	if (!targetExists) {
		mismatches.push(`${mapping.target} has not been materialized from ${mapping.source}`);
		continue;
	}
	comparePath(sourcePath, targetPath, mapping.source, mapping.target);
}

if (mismatches.length > 0) {
	console.error("Default profile materialization is out of sync:");
	for (const mismatch of mismatches) console.error(`- ${mismatch}`);
	process.exit(1);
}

console.log("Default profile materialization matches packages/site-profile.");

function comparePath(sourcePath, targetPath, sourceLabel, targetLabel) {
	const sourceStat = lstatSync(sourcePath);
	const targetStat = lstatSync(targetPath);
	if (sourceStat.isSymbolicLink() || targetStat.isSymbolicLink()) {
		mismatches.push(`${targetLabel} or ${sourceLabel} contains a symlink`);
		return;
	}
	if (sourceStat.isDirectory() !== targetStat.isDirectory()) {
		mismatches.push(`${targetLabel} has a different file type from ${sourceLabel}`);
		return;
	}
	if (!sourceStat.isDirectory()) {
		if (!sourceStat.isFile() || !targetStat.isFile() || readFileSync(sourcePath).compare(readFileSync(targetPath)) !== 0) {
			mismatches.push(`${targetLabel} differs from ${sourceLabel}`);
		}
		return;
	}

	const sourceEntries = readdirSync(sourcePath).sort();
	const targetEntries = readdirSync(targetPath).sort();
	const sourceSet = new Set(sourceEntries);
	const targetSet = new Set(targetEntries);
	for (const entry of sourceEntries) {
		if (!targetSet.has(entry)) {
			mismatches.push(`${targetLabel}/${entry} is missing`);
			continue;
		}
		comparePath(join(sourcePath, entry), join(targetPath, entry), `${sourceLabel}/${entry}`, `${targetLabel}/${entry}`);
	}
	for (const entry of targetEntries) {
		if (!sourceSet.has(entry)) mismatches.push(`${targetLabel}/${entry} has no profile source`);
	}
}
