import assert from "node:assert/strict";
import { after, test } from "node:test";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const temporaryRoots = [];

after(() => {
	for (const root of temporaryRoots) rmSync(root, { recursive: true, force: true });
});

test("composition preserves independent refs and rebuilds a historical pair", () => {
	const fixture = makeFixture();
	const aa = compose(fixture, fixture.coreA, fixture.siteA, fixture.coreShaA, fixture.siteShaA, "aa");
	const ab = compose(fixture, fixture.coreA, fixture.siteB, fixture.coreShaA, fixture.siteShaB, "ab");
	const ba = compose(fixture, fixture.coreB, fixture.siteA, fixture.coreShaB, fixture.siteShaA, "ba");
	const aaAgain = compose(fixture, fixture.coreA, fixture.siteA, fixture.coreShaA, fixture.siteShaA, "aa-again");

	assert.equal(aa.core.resolved_sha, fixture.coreShaA);
	assert.equal(aa.site.resolved_sha, fixture.siteShaA);
	assert.match(aa.build.configuration.inherited_environment_digest, /^sha256:[a-f0-9]{64}$/);
	assert.equal(ab.core.resolved_sha, aa.core.resolved_sha);
	assert.equal(ab.site.resolved_sha, fixture.siteShaB);
	assert.equal(ba.core.resolved_sha, fixture.coreShaB);
	assert.equal(ba.site.resolved_sha, aa.site.resolved_sha);
	assert.equal(readFileSync(join(fixture.artifacts, "aa/dist/index.html"), "utf8"), "core-A:site-A\n");
	assert.equal(readFileSync(join(fixture.artifacts, "ab/dist/index.html"), "utf8"), "core-A:site-B\n");
	assert.equal(readFileSync(join(fixture.artifacts, "ba/dist/index.html"), "utf8"), "core-B:site-A\n");
	assert.equal(aa.artifact.digest, aaAgain.artifact.digest, "same input pair must have the same normalized output digest");
	assert.deepEqual(readdirFixture(join(fixture.artifacts, "aa")), ["dist", "provenance.json"]);

	const existing = join(fixture.artifacts, "preserve-me");
	mkdirSync(existing);
	writeFileSync(join(existing, "sentinel"), "untouched");
	const invalid = runComposition(fixture, fixture.coreA, fixture.siteA, fixture.coreShaB, fixture.siteShaA, existing);
	assert.equal(invalid.status, 1, `${invalid.stdout}\n${invalid.stderr}`);
	assert.match(`${invalid.stdout}\n${invalid.stderr}`, /\[composition:core-resolution\] ERROR/);
	assert.equal(readFileSync(join(existing, "sentinel"), "utf8"), "untouched");

	assert.equal(aaAgain.core.resolved_sha, fixture.coreShaA, "historical Core ref must remain selectable");
	assert.equal(aaAgain.site.resolved_sha, fixture.siteShaA, "historical Site ref must remain selectable");
});

test("composition rejects a mismatched pnpm or installed lock state before building", () => {
	const fixture = makeFixture();
	const wrongPnpmArtifact = join(fixture.artifacts, "wrong-pnpm");
	const wrongPnpm = runComposition(fixture, fixture.coreA, fixture.siteA, fixture.coreShaA, fixture.siteShaA, wrongPnpmArtifact, {
		KIRARI_TEST_PNPM_VERSION: "9.15.0",
	});
	assert.equal(wrongPnpm.status, 1, `${wrongPnpm.stdout}\n${wrongPnpm.stderr}`);
	assert.match(`${wrongPnpm.stdout}\n${wrongPnpm.stderr}`, /Active pnpm 9\.15\.0 does not match/i);
	assert.equal(existsSync(wrongPnpmArtifact), false);

	writeFileSync(join(fixture.coreA, "node_modules/.pnpm/lock.yaml"), "mismatched install\n");
	const wrongInstallArtifact = join(fixture.artifacts, "wrong-install");
	const wrongInstall = runComposition(fixture, fixture.coreA, fixture.siteA, fixture.coreShaA, fixture.siteShaA, wrongInstallArtifact);
	assert.equal(wrongInstall.status, 1, `${wrongInstall.stdout}\n${wrongInstall.stderr}`);
	assert.match(`${wrongInstall.stdout}\n${wrongInstall.stderr}`, /Installed pnpm dependency state does not match/i);
	assert.equal(existsSync(wrongInstallArtifact), false);
});

function makeFixture() {
	const root = mkdtempSync(join(tmpdir(), "kirari-composed-build-"));
	temporaryRoots.push(root);
	const coreRepository = join(root, "core-repository");
	const siteRepository = join(root, "site-repository");
	const artifacts = join(root, "artifacts");
	const bin = join(root, "bin");
	mkdirSync(artifacts);
	mkdirSync(bin);
	makeCoreRepository(coreRepository);
	makeSiteRepository(siteRepository);
writeFileSync(join(bin, "pnpm"), `#!/bin/sh
set -eu
if [ "\${1:-}" = "--version" ]; then printf '%s\\n' "\${KIRARI_TEST_PNPM_VERSION:-9.14.4}"; exit 0; fi
if [ "\${1:-}" != "run" ] || [ "\${2:-}" != "build" ]; then exit 2; fi
mkdir -p dist
printf '%s:%s\\n' "$(cat core-marker)" "$(cat "$KIRARI_SITE_SOURCE/site-marker")" > dist/index.html
`);
	chmodSync(join(bin, "pnpm"), 0o755);

	const coreShaA = git(coreRepository, "rev-parse", "HEAD");
	writeFileSync(join(coreRepository, "apps/site/core-marker"), "core-B");
	commit(coreRepository, "core B");
	const coreShaB = git(coreRepository, "rev-parse", "HEAD");
	const siteShaA = git(siteRepository, "rev-parse", "HEAD");
	writeFileSync(join(siteRepository, "site-marker"), "site-B");
	commit(siteRepository, "site B");
	const siteShaB = git(siteRepository, "rev-parse", "HEAD");

	const coreA = join(root, "core-a");
	const coreB = join(root, "core-b");
	const siteA = join(root, "site-a");
	const siteB = join(root, "site-b");
	git(coreRepository, "worktree", "add", "--detach", coreA, coreShaA);
	git(coreRepository, "worktree", "add", "--detach", coreB, coreShaB);
	git(siteRepository, "worktree", "add", "--detach", siteA, siteShaA);
	git(siteRepository, "worktree", "add", "--detach", siteB, siteShaB);
	for (const checkout of [coreA, coreB]) addBuildDependency(checkout);

	return { root, artifacts, bin, coreA, coreB, siteA, siteB, coreShaA, coreShaB, siteShaA, siteShaB };
}

function makeCoreRepository(root) {
	mkdirSync(root);
	for (const file of [
		".gitignore",
		"build.sh",
		"package.json",
		"pnpm-lock.yaml",
		"scripts/build-external-site.mjs",
		"scripts/build-composed-site.mjs",
		"scripts/composition-provenance.mjs",
		"apps/site/scripts/profile-manifest.mjs",
	]) {
		const source = join(repoRoot, file);
		const destination = join(root, file);
		mkdirSync(dirname(destination), { recursive: true });
		copyFileSync(source, destination);
	}
	writeFileSync(join(root, "apps/site/core-marker"), "core-A");
	initGit(root);
	commit(root, "core A");
}

function makeSiteRepository(root) {
	mkdirSync(root);
	writeFileSync(join(root, "site-marker"), "site-A");
	initGit(root);
	commit(root, "site A");
}

function addBuildDependency(checkout) {
	const module = join(checkout, "apps/site/node_modules/smol-toml");
	mkdirSync(module, { recursive: true });
	writeFileSync(join(module, "package.json"), JSON.stringify({ name: "smol-toml", type: "module", exports: "./index.js" }));
	writeFileSync(join(module, "index.js"), "export const parse = () => ({});\n");
	const installedLockfile = join(checkout, "node_modules/.pnpm/lock.yaml");
	mkdirSync(dirname(installedLockfile), { recursive: true });
	copyFileSync(join(checkout, "pnpm-lock.yaml"), installedLockfile);
}

function initGit(root) {
	git(root, "init", "-b", "main");
	git(root, "config", "user.name", "Composition Test");
	git(root, "config", "user.email", "composition-test@example.invalid");
}

function commit(root, message) {
	git(root, "add", "--all");
	git(root, "commit", "-m", message);
}

function git(root, ...args) {
	const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
	assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
	return result.stdout.trim();
}

function compose(fixture, core, site, coreRef, siteRef, name) {
	const artifact = join(fixture.artifacts, name);
	const result = runComposition(fixture, core, site, coreRef, siteRef, artifact);
	assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
	return JSON.parse(readFileSync(join(artifact, "provenance.json"), "utf8"));
}

function runComposition(fixture, core, site, coreRef, siteRef, artifact, extraEnvironment = {}) {
	return spawnSync("bash", [join(core, "build.sh"), "--compose", "--core-ref", coreRef, "--site", site, "--site-ref", siteRef, "--artifact-dir", artifact], {
		cwd: core,
		encoding: "utf8",
		env: { ...process.env, PATH: `${fixture.bin}${process.platform === "win32" ? ";" : ":"}${process.env.PATH ?? ""}`, ...extraEnvironment },
	});
}

function readdirFixture(path) {
	return readdirSync(path).sort();
}
