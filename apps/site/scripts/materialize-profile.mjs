#!/usr/bin/env node

/**
 * Materialize the default site profile into the site package.
 *
 * Copies whitelisted paths from packages/site-profile into apps/site
 * so the site can build with default config, content, and assets.
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const siteDir = resolve(scriptDir, "..");
const profileDir = resolve(scriptDir, "..", "..", "..", "packages", "site-profile");

const MAPPINGS = [
	{ src: "kirari.config.toml", dest: "kirari.config.toml" },
	{ src: "content/posts", dest: "src/content/posts" },
	{ src: "content/spec", dest: "src/content/spec" },
	{ src: "data/friends.json", dest: "src/_data/friends.json" },
	{ src: "assets/favicon", dest: "public/favicon" },
	{ src: "assets/og", dest: "public/og" },
	{ src: "snippets", dest: "src/snippets" },
];

const manifest = { materialized: [], profileDir, siteDir, timestamp: new Date().toISOString() };

for (const { src, dest } of MAPPINGS) {
	const srcPath = resolve(profileDir, src);
	const destPath = resolve(siteDir, dest);

	if (!srcPath.startsWith(profileDir)) {
		throw new Error(`Path traversal denied: ${src} resolves outside profile directory`);
	}
	if (!destPath.startsWith(siteDir)) {
		throw new Error(`Path traversal denied: ${dest} resolves outside site directory`);
	}

	if (!existsSync(srcPath)) {
		console.warn(`[materialize-profile] SKIP  ${src} — does not exist in profile`);
		continue;
	}

	if (statSync(srcPath).isDirectory()) {
		removeDirectoryContents(destPath);
		copyDirectoryContents(srcPath, destPath);
	} else {
		removeFile(destPath);
		mkdirSync(dirname(destPath), { recursive: true });
		copyFileSync(srcPath, destPath);
	}

	manifest.materialized.push({
		src: relative(profileDir, srcPath),
		dest: relative(siteDir, destPath),
	});
	console.log(`[materialize-profile] COPY  ${src} -> ${dest}`);
}

const manifestPath = join(siteDir, ".kirari-profile-manifest.json");
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`[materialize-profile] DONE  manifest written to .kirari-profile-manifest.json`);

function removeDirectoryContents(dir) {
	if (!existsSync(dir)) return;
	for (const entry of readdirSync(dir)) {
		const fullPath = join(dir, entry);
		if (!fullPath.startsWith(dir)) throw new Error(`Path traversal while cleaning: ${fullPath}`);
		const stat = statSync(fullPath);
		if (stat.isDirectory()) {
			removeDirectoryContents(fullPath);
		}
		try {
			rmSync(fullPath, { recursive: true, force: true });
		} catch {
			// May fail for read-only files; skip silently
		}
	}
}

function removeFile(filePath) {
	if (!existsSync(filePath)) return;
	rmSync(filePath, { force: true });
}

function copyDirectoryContents(srcDir, destDir) {
	mkdirSync(destDir, { recursive: true });
	for (const entry of readdirSync(srcDir)) {
		const srcEntry = join(srcDir, entry);
		const destEntry = join(destDir, entry);
		if (!srcEntry.startsWith(srcDir)) throw new Error(`Path traversal while copying: ${srcEntry}`);
		if (statSync(srcEntry).isDirectory()) {
			copyDirectoryContents(srcEntry, destEntry);
		} else {
			copyFileSync(srcEntry, destEntry);
		}
	}
}
