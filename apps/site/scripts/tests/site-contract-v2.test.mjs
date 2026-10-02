import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	cpSync,
	existsSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { parse as parseToml } from "smol-toml";
import { materializeProfile } from "../profile-manifest.mjs";
import { migrateSiteProfileToV2 } from "../site-contract-v2-migration.mjs";
import { materializeSiteContractV2, parseFrontmatter, validateSiteContractV2, validateTaxonomy } from "../site-contract-v2.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), "fixtures/site-contract-v2");
const coreRepository = "example/kirari-core";

test("minimal v2 fixture accepts generic empty pages and materializes the default locale", (t) => {
	const context = createGitSiteFixture("minimal");
	t.after(() => rmSync(context.tempRoot, { recursive: true, force: true }));
	const before = snapshot(context.siteRoot);
	const validation = validateSiteContractV2(context.siteRoot, { selectedCoreSha: context.coreSha });
	assert.equal(validation.schemaVersion, 2);
	assert.equal(validation.core.commit, context.coreSha);
	assert.equal(validation.gitlinkSha, context.coreSha);
	assert.equal(validation.coreCheckoutSha, context.coreSha);
	const materialized = materializeSiteContractV2(context.siteRoot, join(context.tempRoot, "bridge"), { selectedCoreSha: context.coreSha });
	const repeated = materializeSiteContractV2(context.siteRoot, join(context.tempRoot, "bridge-repeat"), { selectedCoreSha: context.coreSha });
	assert.equal(readFileSync(join(materialized.materializedDir, "content/spec/about.md"), "utf8").includes("has not added"), true);
	assert.equal(existsSync(join(materialized.materializedDir, "assets/favicon/favicon-light-32.png")), true);
	assert.deepEqual(snapshot(materialized.materializedDir), snapshot(repeated.materializedDir));
	assert.deepEqual(snapshot(context.siteRoot), before);
});

test("full v2 fixture preserves taxonomy, aliases, assets, and one-pass public inputs", (t) => {
	const context = createGitSiteFixture("full");
	t.after(() => rmSync(context.tempRoot, { recursive: true, force: true }));
	writeFileSync(join(context.siteRoot, "assets/images/.DS_Store"), "fixture-only Finder metadata");
	const before = snapshot(context.siteRoot);
	const validation = validateSiteContractV2(context.siteRoot, { selectedCoreSha: context.coreSha });
	assert.equal(validation.schemaVersion, 2);
	assert.equal(validation.core.commit, context.coreSha);
	assert.equal(validation.gitlinkSha, context.coreSha);
	assert.equal(validation.coreCheckoutSha, context.coreSha);
	assert.equal(validation.legacyRouteAliases["zh-HK"], "zh-Hant");
	const translatedPost = readFileSync(join(context.siteRoot, "content/posts/zh-Hant/getting-started.md"));
	assert.ok(validation.inventory.some((entry) => entry.source === "content/posts/zh-Hant/getting-started.md"
		&& entry.disposition === "input"
		&& entry.sha256 === createHash("sha256").update(translatedPost).digest("hex")), "input inventory includes deterministic content hashes");
	assert.deepEqual(validation.inventory, validateSiteContractV2(context.siteRoot, { selectedCoreSha: context.coreSha }).inventory);
	assert.ok(validation.routeInventory.some((route) => route.locale === "zh-Hant" && route.slug === "getting-started" && route.translationKey === "guide-intro"));
	assert.equal(validation.routeInventory.some((route) => route.locale === "zh-HK"), false, "route aliases do not duplicate canonical content inventory");
	assert.ok(validation.inventory.some((entry) => entry.source === "assets/images/.DS_Store" && entry.disposition === "excluded-metadata"));
	assert.ok(validation.inventory.some((entry) => entry.source === "package.json" && entry.disposition === "excluded-metadata"));
	const bridge = materializeSiteContractV2(context.siteRoot, join(context.tempRoot, "bridge"), { selectedCoreSha: context.coreSha });
	const repeatedBridge = materializeSiteContractV2(context.siteRoot, join(context.tempRoot, "bridge-repeat"), { selectedCoreSha: context.coreSha });
	assert.deepEqual(snapshot(bridge.materializedDir), snapshot(repeatedBridge.materializedDir));
	assert.equal(existsSync(join(bridge.materializedDir, "content/posts/getting-started.md")), true, "default zh-Hant posts are flattened into Core's default contentDir");
	assert.equal(existsSync(join(bridge.materializedDir, "content/posts/en-US/translation.md")), true);
	assert.equal(existsSync(join(bridge.materializedDir, "assets/images/devices/ipad.svg")), true);
	assert.equal(existsSync(join(bridge.materializedDir, "public/images/devices/ipad.svg")), false, "the device source appears once in the legacy input tree");
	assert.equal(existsSync(join(bridge.materializedDir, "public/branding/site-mark.svg")), true);
	assert.equal(existsSync(join(bridge.materializedDir, "public/ads.txt")), true);
	assert.equal(existsSync(join(bridge.materializedDir, "ads.txt")), false, "v2 public ads.txt does not also enter the v1 root mapping");
	assert.equal(existsSync(join(bridge.materializedDir, "assets/og/test.png")), true);
	assert.equal(existsSync(join(bridge.materializedDir, "assets/images/posts/cover.png")), true, "nested post assets remain available to Core content");
	assert.equal(existsSync(join(bridge.materializedDir, "public/favicon/favicon-light-32.png")), false, "the v1 Profile mapper owns favicon output mapping");

	const coreConfig = parseToml(readFileSync(join(bridge.materializedDir, "kirari.config.toml"), "utf8"));
	assert.equal(coreConfig.site["default-language"], undefined);
	assert.equal(coreConfig.site.lang, "zh-TW");
	assert.equal(coreConfig.i18n["default-language"], "zh-TW");
	assert.equal(coreConfig.i18n.languages["zh-TW"].contentDir, "src/content/posts");
	assert.equal(coreConfig.i18n.languages["zh-HK"].locale, "zh-Hant");
	assert.equal(coreConfig.i18n.languages["zh-HK"].contentDir, "src/content/posts/zh-TW");
	assert.equal(coreConfig.i18n.languages["zh-HK"].disabled, false);
	assert.equal(coreConfig.i18n.languages["zh-TW"].locale, "zh-TW");
	const post = readFileSync(join(bridge.materializedDir, "content/posts/getting-started.md"), "utf8");
	assert.match(post, /lang: "zh-TW"/);
	assert.match(post, /tags: \["javascript"\]/);
	assert.match(post, /category: "tutorials"/);
	assert.match(post, /tagLabels: \{"javascript":"JavaScript"\}/);
	assert.deepEqual(snapshot(context.siteRoot), before);

	const appRoot = join(context.tempRoot, "core-app");
	const appPublic = join(appRoot, "public");
	mkdirSync(appPublic, { recursive: true });
	for (const name of readdirSync(bridge.publicDir)) cpSync(join(bridge.publicDir, name), join(appPublic, name), { recursive: true });
	materializeProfile(bridge.materializedDir, appRoot, { preserveMissingOptionalTargets: ["public/ads.txt"] });
	assert.equal(readFileSync(join(appPublic, "ads.txt"), "utf8"), "example.test, publisher, DIRECT\n");
	assert.equal(existsSync(join(appPublic, "favicon/favicon-light-32.png")), true);
	assert.equal(existsSync(join(appPublic, "og/default.png")), true);
	assert.equal(existsSync(join(appPublic, "images/devices/ipad.svg")), true);
	assert.equal(existsSync(join(appPublic, "branding/site-mark.svg")), true);
	for (const name of [
		"favicon-light-32.png", "favicon-light-128.png", "favicon-light-180.png", "favicon-light-192.png",
		"favicon-dark-32.png", "favicon-dark-128.png", "favicon-dark-180.png", "favicon-dark-192.png",
	]) assert.equal(existsSync(join(appPublic, "favicon", name)), true, `required favicon ${name} is preserved`);
});

test("v2 semantic validation rejects duplicate default owners and invalid taxonomy identities", (t) => {
	const context = createGitSiteFixture("minimal");
	t.after(() => rmSync(context.tempRoot, { recursive: true, force: true }));
	const configPath = join(context.siteRoot, "kirari.config.toml");
	const original = readFileSync(configPath, "utf8");
	writeFileSync(configPath, original.replace('default-language = "en"', 'default-language = "en"\nlang = "en-US"'));
	assert.throws(() => validateSiteContractV2(context.siteRoot), /\[site\]\.lang duplicates/);
	writeFileSync(configPath, original);
	assert.throws(() => validateTaxonomy({
		version: 1,
		tags: [{ id: "Bad ID", slug: "javascript", labels: { en: "JavaScript" } }],
		categories: [],
	}), /stable lowercase ID/);
	assert.throws(() => validateTaxonomy({
		version: 1,
		tags: [{ id: "tag:javascript", slug: "../javascript", labels: { en: "JavaScript" } }],
		categories: [],
	}), /valid tag URL slug/);
	assert.throws(() => validateTaxonomy({
		version: 1,
		tags: [{ id: "tag:javascript", slug: "javascript", labels: { fr: "JavaScript" } }],
		categories: [],
	}), /unsupported locale fr/);
	mkdirSync(join(context.siteRoot, "content/posts"), { recursive: true });
	writeFileSync(join(context.siteRoot, "content/posts/translation-a.md"), `---\ntitle: A\npublished: "2026-10-01"\nlocale: en\ntranslationKey: duplicate\n---\nA\n`);
	writeFileSync(join(context.siteRoot, "content/posts/translation-b.md"), `---\ntitle: B\npublished: "2026-10-01"\nlocale: en\ntranslationKey: duplicate\n---\nB\n`);
	assert.throws(() => validateSiteContractV2(context.siteRoot), /duplicate translationKey/);
});

test("Site public inputs reject secret-like files before artifact composition", (t) => {
	const context = createGitSiteFixture("full");
	t.after(() => rmSync(context.tempRoot, { recursive: true, force: true }));
	writeFileSync(join(context.siteRoot, "public/.env"), "fixture-only placeholder");
	assert.throws(() => validateSiteContractV2(context.siteRoot), /public\/\.env: secret-like files are not allowed/);
});

test("Profile migration writes the inventory first, preflights inputs, and leaves its source unchanged", (t) => {
	const tempRoot = mkdtempSync(join(tmpdir(), "kirari-v1-v2-migration-test-"));
	t.after(() => rmSync(tempRoot, { recursive: true, force: true }));
	const sourceRoot = join(repoRoot, "packages/site-profile");
	const targetRoot = join(tempRoot, "site-v2");
	const reportPath = join(tempRoot, "migration-report.json");
	const sourceBefore = snapshot(sourceRoot);
	const dry = migrateSiteProfileToV2(sourceRoot, targetRoot, {
		reportPath: join(tempRoot, "dry-report.json"),
		coreSha: "9a9c496c191ba541d3882bd00e831e5fbc1d8721",
	});
	assert.equal(dry.applied, false);
	assert.equal(existsSync(targetRoot), false, "inventory-only migration does not create output");
	assert.equal(existsSync(dry.report), true);
	assert.equal(dry.plan.blockers.length, 0);
	assert.ok(dry.plan.exclusions.some((entry) => entry.source === "package.json"));
	const applied = migrateSiteProfileToV2(sourceRoot, targetRoot, {
		reportPath,
		coreSha: "9a9c496c191ba541d3882bd00e831e5fbc1d8721",
		apply: true,
	});
	assert.equal(applied.applied, true);
	assert.equal(existsSync(reportPath), true);
	assert.equal(readFileSync(join(targetRoot, ".kirari/site.toml"), "utf8").includes('setup-state = "core-init-required"'), true);
	const migratedConfig = parseToml(readFileSync(join(targetRoot, "kirari.config.toml"), "utf8"));
	assert.equal(migratedConfig["default-language"], undefined);
	assert.equal(migratedConfig.site["default-language"], "en");
	assert.equal(migratedConfig.site.lang, undefined);
	assert.ok(Object.values(migratedConfig.i18n.languages).every((language) => language.contentDir === undefined));
	assert.ok(migratedConfig.i18n.languages["zh-Hant"]);
	assert.equal(migratedConfig.i18n.languages["zh-HK"], undefined, "legacy zh-HK route is represented as route metadata, not a duplicate locale owner");
	const aliases = JSON.parse(readFileSync(join(targetRoot, "data/route-aliases.json"), "utf8"));
	assert.equal(aliases.legacyRouteAliases["zh-HK"], "zh-Hant");
	const englishTranslation = parseFrontmatter(readFileSync(join(targetRoot, "content/posts/guide/index.md"), "utf8"), "migrated English post").fields;
	const chineseTranslation = parseFrontmatter(readFileSync(join(targetRoot, "content/posts/guide/index-cjk.md"), "utf8"), "migrated Chinese post").fields;
	assert.equal(englishTranslation.get("translationKey")?.value, "guide");
	assert.equal(englishTranslation.get("locale")?.value, "en");
	assert.equal(englishTranslation.has("lang"), false);
	assert.equal(chineseTranslation.get("translationKey")?.value, "guide");
	assert.equal(chineseTranslation.get("locale")?.value, "zh-Hans");
	assert.notEqual(englishTranslation.get("locale")?.value, chineseTranslation.get("locale")?.value);
	const taxonomy = JSON.parse(readFileSync(join(targetRoot, "data/taxonomy.json"), "utf8"));
	assert.equal(taxonomy.tags.find((item) => item.slug === "demo").labels.en, "演示", "explicit tagLabels wins over the raw tag fallback");
	assert.equal(existsSync(join(targetRoot, "assets/images/devices/ipad-air.svg")), true);
	assert.ok(applied.plan.entries.filter((entry) => entry.source.startsWith("assets/images/devices/")).every((entry) => entry.targets.length === 1 && !entry.targets[0].startsWith("public/images/devices/")));
	assert.deepEqual(snapshot(sourceRoot), sourceBefore);
	const repeatedTarget = join(tempRoot, "site-v2-repeat");
	const repeated = migrateSiteProfileToV2(sourceRoot, repeatedTarget, {
		reportPath: join(tempRoot, "repeat-report.json"),
		coreSha: "9a9c496c191ba541d3882bd00e831e5fbc1d8721",
		apply: true,
	});
	assert.equal(repeated.applied, true);
	assert.deepEqual(snapshot(targetRoot), snapshot(repeatedTarget));
});

test("validator and migration CLIs expose the same contract and report-first behavior", (t) => {
	const context = createGitSiteFixture("minimal");
	t.after(() => rmSync(context.tempRoot, { recursive: true, force: true }));
	const validator = spawnSync(process.execPath, [
		join(repoRoot, "apps/site/scripts/check-site-contract-v2.mjs"),
		context.siteRoot,
		"--core-sha",
		context.coreSha,
	], { cwd: repoRoot, encoding: "utf8" });
	assert.equal(validator.status, 0, validator.stderr);
	assert.equal(JSON.parse(validator.stdout).valid, true);

	const migrationRoot = join(context.tempRoot, "cli-migration");
	const migrationTarget = join(migrationRoot, "site-v2");
	const reportPath = join(migrationRoot, "inventory.json");
	const migrator = spawnSync(process.execPath, [
		"apps/site/scripts/migrate-site-profile-v1-to-v2.mjs",
		"--source", join(repoRoot, "packages/site-profile"),
		"--target", migrationTarget,
		"--report", reportPath,
		"--core-sha", "9a9c496c191ba541d3882bd00e831e5fbc1d8721",
	], { cwd: repoRoot, encoding: "utf8" });
	assert.equal(migrator.status, 0, migrator.stderr);
	assert.equal(existsSync(reportPath), true);
	assert.equal(existsSync(migrationTarget), false, "CLI inventory mode writes its report without creating migration output");
});

test("migration refuses target and report paths that traverse symlinks", (t) => {
	const tempRoot = mkdtempSync(join(tmpdir(), "kirari-v1-v2-symlink-test-"));
	t.after(() => rmSync(tempRoot, { recursive: true, force: true }));
	const sourceRoot = join(repoRoot, "packages/site-profile");
	const symlinkRoot = join(tempRoot, "linked");
	symlinkSync(tempRoot, symlinkRoot, "dir");
	const options = { coreSha: "9a9c496c191ba541d3882bd00e831e5fbc1d8721" };
	assert.throws(() => migrateSiteProfileToV2(sourceRoot, join(symlinkRoot, "target"), options), /must not traverse a symlink/);
	assert.throws(() => migrateSiteProfileToV2(sourceRoot, join(tempRoot, "target"), {
		...options,
		reportPath: join(symlinkRoot, "report.json"),
	}), /must not traverse a symlink/);
});

function createGitSiteFixture(name) {
	const tempRoot = mkdtempSync(join(tmpdir(), "kirari-site-contract-test-"));
	const siteRoot = join(tempRoot, "site");
	cpSync(join(fixtureRoot, name), siteRoot, { recursive: true });
	const coreRoot = join(siteRoot, ".kirari/core");
	mkdirSync(coreRoot, { recursive: true });
	git(coreRoot, ["init", "--quiet"]);
	git(coreRoot, ["config", "user.name", "Contract Fixture"]);
	git(coreRoot, ["config", "user.email", "contract-fixture@example.test"]);
	writeFileSync(join(coreRoot, "README.md"), "fixture Core\n");
	git(coreRoot, ["add", "README.md"]);
	git(coreRoot, ["commit", "--quiet", "-m", "fixture Core"]);
	const coreSha = git(coreRoot, ["rev-parse", "HEAD"]);
	const metadataPath = join(siteRoot, ".kirari/site.toml");
	writeFileSync(metadataPath, readFileSync(metadataPath, "utf8").replace("0".repeat(40), coreSha));
	writeFileSync(join(siteRoot, ".gitmodules"), `[submodule ".kirari/core"]\n\tpath = .kirari/core\n\turl = https://github.com/${coreRepository}.git\n`);
	git(siteRoot, ["init", "--quiet"]);
	git(siteRoot, ["add", ".gitmodules"]);
	git(siteRoot, ["update-index", "--add", "--cacheinfo", `160000,${coreSha},.kirari/core`]);
	return { tempRoot, siteRoot, coreSha };
}

function git(cwd, args) {
	const result = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
	if (result.status !== 0) throw new Error(result.stderr || `git exited ${result.status}`);
	return result.stdout.trim();
}

function snapshot(root) {
	const entries = [];
	const visit = (directory) => {
		for (const name of readdirSync(directory).sort()) {
			if (name === ".git") continue;
			const path = join(directory, name);
			const stat = lstatSync(path);
			if (stat.isDirectory()) visit(path);
			else if (stat.isFile()) entries.push([relative(root, path).split(sep).join("/"), createHash("sha256").update(readFileSync(path)).digest("hex")]);
			else entries.push([relative(root, path).split(sep).join("/"), `type:${stat.mode}`]);
		}
	};
	visit(root);
	return entries;
}
