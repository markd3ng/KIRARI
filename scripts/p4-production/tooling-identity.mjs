import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, readlinkSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

export const TOOLING_TREE_FINGERPRINT_ALGORITHM = "kirari-p4-installed-tree-v2";
export const TOOLING_MATERIAL_SOURCE_PATHS = [
	".github/workflows/ci.yml",
	".github/workflows/site-production.yml",
	"package.json",
	"pnpm-lock.yaml",
	"pnpm-workspace.yaml",
	"scripts/p3-browser/package.json",
	"scripts/p3-browser/package-lock.json",
	"scripts/p4-production/run.mjs",
	"scripts/p4-production/runtime-adapter.mjs",
	"scripts/deploy-vercel-production.mjs",
	"scripts/p4-production/tooling-gate.mjs",
	"scripts/p4-production/tooling-install.mjs",
	"scripts/p4-production/npm-runtime.mjs",
	"scripts/p4-production/tooling-identity.mjs",
	"scripts/p4-production/owner-decision.mjs",
	"scripts/p4-production/credential-gate.mjs",
	"scripts/p4-production/credential-contract.mjs",
	".nvmrc",
	"scripts/p4-production/tooling/package.json",
	"scripts/p4-production/tooling/package-lock.json",
];

function sorted(value) {
	if (Array.isArray(value)) return value.map(sorted);
	if (value && typeof value === "object") {
		return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]));
	}
	return value;
}

function canonicalJson(value) {
	return JSON.stringify(sorted(value));
}

function sha256(value) {
	return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

/**
 * Fingerprints every installed entry by sorted relative path, type, permission
 * bits, file contents, and symlink target. Symlinks are recorded, never followed.
 */
export function fingerprintInstalledTree(nodeModulesRoot) {
	const root = resolve(nodeModulesRoot);
	const rootStat = lstatSync(root);
	if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error("TOOLING_TREE_ROOT_NOT_DIRECTORY");
	const entries = [];
	const visit = (directory) => {
		const names = readdirSync(directory).sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
		for (const name of names) {
			const path = join(directory, name);
			const stat = lstatSync(path);
			const relativePath = relative(root, path).split(sep).join("/");
			const entry = { path: relativePath, mode: stat.mode & 0o777 };
			if (stat.isDirectory()) {
				entry.type = "directory";
				entries.push(entry);
				visit(path);
			} else if (stat.isFile()) {
				entry.type = "file";
				entry.content_sha256 = sha256(readFileSync(path));
				entries.push(entry);
			} else if (stat.isSymbolicLink()) {
				entry.type = "symlink";
				entry.target = readlinkSync(path);
				entries.push(entry);
			} else {
				entry.type = "special";
				entry.rdev = stat.rdev;
				entries.push(entry);
			}
		}
	};
	visit(root);
	return sha256(canonicalJson({ algorithm: TOOLING_TREE_FINGERPRINT_ALGORITHM, root_mode: rootStat.mode & 0o777, entries }));
}
