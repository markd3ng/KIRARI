import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rootPackage = readJson("package.json");
const sitePackage = readJson("apps/site/package.json");
const changelog = read("CHANGELOG.md");
const expectedVersion = process.env.KIRARI_RELEASE_VERSION || rootPackage.version;
const tagName =
	process.argv.find((argument) => argument.startsWith("v")) ||
	(process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : "");
const failures = [];

if (rootPackage.version !== expectedVersion) {
	failures.push(`root package version is ${rootPackage.version}, expected ${expectedVersion}`);
}
if (sitePackage.version !== expectedVersion) {
	failures.push(`@kirari/site version is ${sitePackage.version}, expected ${expectedVersion}`);
}
if (!changelog.includes(`## [${expectedVersion}]`)) {
	failures.push(`CHANGELOG.md is missing ## [${expectedVersion}]`);
}
if (tagName && tagName !== `v${expectedVersion}`) {
	failures.push(`tag ${tagName} does not match v${expectedVersion}`);
}

if (failures.length > 0) {
	for (const failure of failures) console.error(`FAIL ${failure}`);
	process.exit(1);
}

console.log(`PASS release metadata agrees on ${expectedVersion}`);

function read(path) {
	return readFileSync(resolve(repoRoot, path), "utf8");
}

function readJson(path) {
	return JSON.parse(read(path));
}
