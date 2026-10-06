import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const target = process.argv[2];
if (!target) throw new Error("Usage: node prepare-unignored-audit.mjs <temporary-directory>");
const targetRoot = resolve(target);
const rel = relative(root, targetRoot);
if (!isAbsolute(targetRoot) || rel === "" || (!rel.startsWith("..") && rel !== "..")) {
	throw new Error("The unignored audit workspace must be outside the repository checkout");
}

const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (JSON.stringify(manifest.pnpm?.auditConfig?.ignoreCves) !== JSON.stringify(["CVE-2026-93748"])) {
	throw new Error("The source #122 ignore scope changed; refusing to prepare a different audit workspace");
}
const lockfile = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
const importerLines = lockfile.split(/\r?\n/);
const importerStart = importerLines.findIndex((line) => line === "importers:");
if (importerStart < 0) throw new Error("pnpm lockfile importer section is missing");
const importers = [];
for (let index = importerStart + 1; index < importerLines.length; index += 1) {
	const line = importerLines[index];
	if (/^[^\s#][^:]*:\s*(?:#.*)?$/.test(line)) break;
	const match = /^  ([^\s].*):\s*(?:\{\}|#.*)?$/.exec(line);
	if (match) importers.push(match[1]);
}
const expectedImporters = [".", "apps/site", "workers/kirari-edge", "packages/site-profile"];
if (JSON.stringify([...importers].sort()) !== JSON.stringify([...expectedImporters].sort())) {
	throw new Error(`Unsupported lockfile importer set: ${JSON.stringify(importers)}`);
}
const unignoredManifest = structuredClone(manifest);
delete unignoredManifest.pnpm.auditConfig.ignoreCves;
if (Object.keys(unignoredManifest.pnpm.auditConfig).length === 0) delete unignoredManifest.pnpm.auditConfig;

mkdirSync(targetRoot, { recursive: true });
writeFileSync(join(targetRoot, "package.json"), `${JSON.stringify(unignoredManifest, null, 2)}\n`);
for (const file of ["pnpm-lock.yaml", "pnpm-workspace.yaml", ".npmrc"]) {
	try {
		copyFileSync(join(root, file), join(targetRoot, file));
	} catch (error) {
		if (file !== ".npmrc" || error?.code !== "ENOENT") throw error;
	}
}
for (const importer of expectedImporters.filter((path) => path !== ".")) {
	const source = join(root, importer, "package.json");
	const destination = join(targetRoot, importer, "package.json");
	mkdirSync(dirname(destination), { recursive: true });
	copyFileSync(source, destination);
}
