#!/usr/bin/env node

import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { migrateSiteProfileToV2 } from "../../apps/site/scripts/site-contract-v2-migration.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const fixtureRoot = join(repoRoot, "apps/site/scripts/tests/fixtures/site-contract-v2");
const coreRepository = "example/kirari-core";

function git(cwd, args) {
	const result = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
	assert.equal(result.status, 0, result.stderr || `git ${args.join(" ")} failed`);
	return result.stdout.trim();
}

function makeCore(root) {
	const directory = join(root, "core-source");
	mkdirSync(directory, { recursive: true });
	git(directory, ["init", "--quiet", "-b", "main"]);
	git(directory, ["config", "user.name", "KIRARI P3 Browser Fixture"]);
	git(directory, ["config", "user.email", "p3-browser-fixture@example.invalid"]);
	writeFileSync(join(directory, "README.md"), "fixture Core\n");
	git(directory, ["add", "README.md"]);
	git(directory, ["commit", "--quiet", "-m", "fixture Core"]);
	return { directory, sha: git(directory, ["rev-parse", "HEAD"]) };
}

function prepareContractSite(source, target, core) {
	cpSync(source, target, { recursive: true });
	const metadata = join(target, ".kirari/site.toml");
	writeFileSync(metadata, readFileSync(metadata, "utf8").replace("0".repeat(40), core.sha));
	finishGitlink(target, core);
	return target;
}

function finishGitlink(siteRoot, core) {
	const corePath = join(siteRoot, ".kirari/core");
	mkdirSync(dirname(corePath), { recursive: true });
	cpSync(core.directory, corePath, { recursive: true });
	writeFileSync(join(siteRoot, ".gitmodules"), `[submodule ".kirari/core"]\n\tpath = .kirari/core\n\turl = https://github.com/${coreRepository}.git\n`);
	git(siteRoot, ["init", "--quiet", "-b", "main"]);
	git(siteRoot, ["config", "user.name", "KIRARI P3 Browser Fixture"]);
	git(siteRoot, ["config", "user.email", "p3-browser-fixture@example.invalid"]);
	git(siteRoot, ["add", ".gitmodules"]);
	git(siteRoot, ["update-index", "--add", "--cacheinfo", `160000,${core.sha},.kirari/core`]);
}

function run(command, args, options = {}) {
	const result = spawnSync(command, args, { cwd: repoRoot, encoding: "utf8", maxBuffer: 20 * 1024 * 1024, ...options });
	assert.equal(result.error, undefined, result.error?.message);
	assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
	return result.stdout;
}

function main() {
	const [reportDirectoryArg] = process.argv.slice(2);
	if (!reportDirectoryArg) throw new Error("Usage: node scripts/p3-browser/build-fixtures.mjs <report-directory>");
	const reportDirectory = resolve(reportDirectoryArg);
	mkdirSync(reportDirectory, { recursive: true });
	const temporaryRoot = mkdtempSync(join(tmpdir(), "kirari-p3-browser-fixtures-"));
	try {
		const core = makeCore(temporaryRoot);
		const minimal = prepareContractSite(join(fixtureRoot, "minimal"), join(temporaryRoot, "minimal"), core);
		const full = prepareContractSite(join(fixtureRoot, "full"), join(temporaryRoot, "full"), core);
		const migrated = join(temporaryRoot, "migrated");
		const migration = migrateSiteProfileToV2(join(repoRoot, "packages/site-profile"), migrated, {
			coreSha: core.sha,
			coreRepository,
			reportPath: join(temporaryRoot, "migration-report.json"),
			apply: true,
		});
		assert.equal(migration.applied, true);
		finishGitlink(migrated, core);
		const siteMetadata = join(migrated, ".kirari/site.toml");
		const metadata = readFileSync(siteMetadata, "utf8");
		assert.ok(metadata.includes('setup-state = "core-init-required"'));
		writeFileSync(siteMetadata, metadata.replace('setup-state = "core-init-required"', 'setup-state = "ready"'));

		const results = [];
		for (const [name, site] of [["minimal", minimal], ["full", full], ["migrated", migrated]]) {
			const dist = join(temporaryRoot, name, "dist");
			run(process.execPath, [
				join(repoRoot, "scripts/build-external-site.mjs"),
				site,
				"--dist-output", dist,
				"--source-date-epoch", "1790998333",
			], { env: { ...process.env, KIRARI_SELECTED_CORE_SHA: core.sha } });
			const reportPath = join(reportDirectory, `${name}.json`);
			const browser = run(process.execPath, [join(repoRoot, "scripts/p3-browser/validate.mjs"), "--dist-root", dist, "--report", reportPath]);
			const report = JSON.parse(browser);
			assert.equal(report.result, "PASS", `${name} browser validation failed`);
			results.push({ fixture: name, report: reportPath, routes: report.routes.length, assets: report.assets.loaded });
		}
		writeFileSync(join(reportDirectory, "summary.json"), `${JSON.stringify({ result: "PASS", fixtures: results }, null, 2)}\n`);
		console.log(JSON.stringify({ result: "PASS", fixtures: results }, null, 2));
	} finally {
		if (process.env.P3_BROWSER_KEEP_FIXTURES === "true") console.log(`[p3-browser-fixtures] Kept ${temporaryRoot}`);
		else rmSync(temporaryRoot, { recursive: true, force: true });
	}
}

try { main(); } catch (error) { console.error(`[p3-browser-fixtures] ERROR ${error.message}`); process.exitCode = 1; }
