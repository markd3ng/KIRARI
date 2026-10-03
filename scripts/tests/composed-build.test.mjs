import assert from "node:assert/strict";
import { after, test } from "node:test";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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
	assert.equal(aa.artifact.id, `kirari-composition-${fixture.coreShaA}-${fixture.siteShaA}`);
	assert.equal(aaAgain.artifact.id, aa.artifact.id, "same immutable inputs must receive the same local artifact ID");
	assert.match(aa.build.configuration.inherited_environment_digest, /^sha256:[a-f0-9]{64}$/);
	const aaClock = {
		source: "max-input-commit-time",
		source_date_epoch: Math.max(commitTimestamp(fixture.coreA, fixture.coreShaA), commitTimestamp(fixture.siteA, fixture.siteShaA)),
		timezone: "UTC",
	};
	assert.deepEqual(aa.build.configuration.build_clock, aaClock);
	assert.deepEqual(JSON.parse(readFileSync(join(fixture.artifacts, "aa/dist/build-clock.json"), "utf8")), {
		source_date_epoch: String(aaClock.source_date_epoch),
		timezone: "UTC",
		deterministic: "true",
	});
	assert.equal(ab.core.resolved_sha, aa.core.resolved_sha);
	assert.equal(ab.site.resolved_sha, fixture.siteShaB);
	assert.equal(ba.core.resolved_sha, fixture.coreShaB);
	assert.equal(ba.site.resolved_sha, aa.site.resolved_sha);
	assert.match(readFileSync(join(fixture.artifacts, "aa/dist/index.html"), "utf8"), /<h1>core-A:site-A<\/h1>/);
	assert.match(readFileSync(join(fixture.artifacts, "ab/dist/index.html"), "utf8"), /<h1>core-A:site-B<\/h1>/);
	assert.match(readFileSync(join(fixture.artifacts, "ba/dist/index.html"), "utf8"), /<h1>core-B:site-A<\/h1>/);
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
	assert.deepEqual(aaAgain.build.configuration.build_clock, aaClock, "same input pair must resolve to the same build clock");
});

test("automatic config composition rejects a Site without Contract v2", () => {
	const fixture = makeFixture();
	const artifact = join(fixture.artifacts, "missing-site-contract-v2");
	const result = spawnSync("bash", [
		join(fixture.coreA, "build.sh"),
		"--compose",
		"--core-ref", fixture.coreShaA,
		"--site", fixture.siteA,
		"--site-ref", fixture.siteShaA,
		"--artifact-dir", artifact,
		"--require-site-contract-v2",
	], {
		cwd: fixture.coreA,
		encoding: "utf8",
		env: process.env,
	});
	assert.equal(result.status, 1, result.stdout + "\n" + result.stderr);
	assert.match(result.stdout + "\n" + result.stderr, /\[composition:site-contract-validation\] ERROR Site Contract v2 is required/);
	assert.equal(existsSync(artifact), false);
});

test("a content-only Site uses the selected Core commit time for its build clock", () => {
	const fixture = makeFixture();
	const site = join(fixture.root, "standalone-site");
	mkdirSync(site);
	writeFileSync(join(site, "site-marker"), "content-site\n");
	const artifact = join(fixture.artifacts, "content-site");
	const result = runComposition(fixture, fixture.coreA, site, fixture.coreShaA, undefined, artifact);
	assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
	const manifest = JSON.parse(readFileSync(join(artifact, "provenance.json"), "utf8"));
	assert.equal(manifest.site.kind, "content");
	assert.deepEqual(manifest.build.configuration.build_clock, {
		source: "max-input-commit-time",
		source_date_epoch: commitTimestamp(fixture.coreA, fixture.coreShaA),
		timezone: "UTC",
	});
});

test("composition records the explicit upload artifact name in provenance", () => {
	const fixture = makeFixture();
	const artifactId = "kirari-composition-123456789-2";
	const artifact = join(fixture.artifacts, "explicit-artifact-id");
	const result = runComposition(fixture, fixture.coreA, fixture.siteA, fixture.coreShaA, fixture.siteShaA, artifact, {}, artifactId);
	assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
	const manifest = JSON.parse(readFileSync(join(artifact, "provenance.json"), "utf8"));
	assert.equal(manifest.artifact.id, artifactId);
});

test("Vercel package carries the exact composition provenance and route metadata", () => {
	const fixture = makeFixture();
	const source = join(fixture.artifacts, "vercel-source");
	const sourceArtifactName = "kirari-composition-1234567-1";
	const result = runComposition(fixture, fixture.coreA, fixture.siteA, fixture.coreShaA, fixture.siteShaA, source, {}, sourceArtifactName);
	assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
	const packageRoot = join(fixture.artifacts, "vercel-package");
	const packaged = spawnSync(process.execPath, [
		join(repoRoot, "scripts/package-vercel-site.mjs"),
		"--input", source,
		"--output", packageRoot,
		"--site-root", fixture.siteA,
		"--source-artifact-id", "1234567",
		"--source-artifact-digest", `sha256:${"a".repeat(64)}`,
		"--source-artifact-name", sourceArtifactName,
		"--source-run-id", "1234567",
		"--source-run-attempt", "1",
	], { cwd: repoRoot, encoding: "utf8" });
	assert.equal(packaged.status, 0, `${packaged.stdout}\n${packaged.stderr}`);
	const verified = spawnSync(process.execPath, [join(repoRoot, "scripts/verify-site-package.mjs"), packageRoot], {
		cwd: repoRoot,
		encoding: "utf8",
	});
	assert.equal(verified.status, 0, `${verified.stdout}\n${verified.stderr}`);
	const manifest = JSON.parse(readFileSync(join(packageRoot, "site-package-manifest.json"), "utf8"));
	assert.equal(manifest.source_artifact.id, sourceArtifactName);
	assert.equal(manifest.upstream_github_artifact.name, sourceArtifactName);
	assert.equal(manifest.functions_classification, "STATIC_ONLY_NO_FUNCTIONS_REQUIRED");
	assert.equal(manifest.browser_contract.routes.some((route) => route.path === "/posts/demo/"), true);
	const config = JSON.parse(readFileSync(join(packageRoot, ".vercel/output/config.json"), "utf8"));
	assert.equal(config.version, 3);
	assert.equal(config.routes.some((route) => route.src === "^/search$" && route.dest === "/search/index.html" && route.status === undefined), true);
	assert.equal(config.routes.some((route) => route.src === "^/en-US/(.*)$" && route.dest === "/$1" && route.status === 301), true);
	assert.equal(config.routes.some((route) => route.src === "^/(.*)$" && route.continue === true && route.headers?.["Content-Security-Policy"] === "default-src self"), true);
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
mkdir -p dist/posts/demo
printf '<!doctype html><html><head><title>Fixture</title><link rel="stylesheet" href="/styles.css"></head><body><nav><a href="/posts/demo/">Demo</a></nav><h1>%s:%s</h1></body></html>\\n' "$(cat core-marker)" "$(cat "$KIRARI_SITE_SOURCE/site-marker")" > dist/index.html
printf '<!doctype html><html><head><title>Demo post</title></head><body><h1>Demo post marker</h1></body></html>\\n' > dist/posts/demo/index.html
printf 'body { color: black; }\\n' > dist/styles.css
printf '/*\\n  Content-Security-Policy: default-src self\\n\\n/search\\n  Cache-Control: no-store\\n' > dist/_headers
printf '/search /search/index.html 200\\n/en-US/* /:splat 301\\n' > dist/_redirects
printf '{"source_date_epoch":"%s","timezone":"%s","deterministic":"%s"}\\n' "$SOURCE_DATE_EPOCH" "$TZ" "$KIRARI_DETERMINISTIC_BUILD_CLOCK" > dist/build-clock.json
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
		"apps/site/scripts/site-contract-v2.mjs",
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
	writeFileSync(join(module, "index.js"), "export const parse = () => ({}); export const stringify = () => '';\n");
	const parse5 = join(checkout, "node_modules/parse5");
	mkdirSync(dirname(parse5), { recursive: true });
	symlinkSync(realpathSync(join(repoRoot, "node_modules/parse5")), parse5, "dir");
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

function runComposition(fixture, core, site, coreRef, siteRef, artifact, extraEnvironment = {}, artifactId) {
	const args = [join(core, "build.sh"), "--compose", "--core-ref", coreRef, "--site", site];
	if (siteRef) args.push("--site-ref", siteRef);
	args.push("--artifact-dir", artifact);
	if (artifactId !== undefined) args.push("--artifact-id", artifactId);
	return spawnSync("bash", args, {
		cwd: core,
		encoding: "utf8",
		env: { ...process.env, PATH: `${fixture.bin}${process.platform === "win32" ? ";" : ":"}${process.env.PATH ?? ""}`, ...extraEnvironment },
	});
}

function commitTimestamp(repository, sha) {
	return Number(git(repository, "show", "-s", "--format=%ct", sha));
}

function readdirFixture(path) {
	return readdirSync(path).sort();
}
