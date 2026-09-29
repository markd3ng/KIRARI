import assert from "node:assert/strict";
import { chmodSync, cpSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { after, test } from "node:test";
import { materializeProfile, validateProfileSource } from "../profile-manifest.mjs";

const repoRoot = new URL("../../../../", import.meta.url).pathname;
const defaultProfile = join(repoRoot, "packages/site-profile");
const temporaryRoots = [];

after(() => {
	for (const root of temporaryRoots) rmSync(root, { recursive: true, force: true });
});

function makeTempRoot(label) {
	const root = mkdtempSync(join(tmpdir(), `kirari ${label} 中文 `));
	temporaryRoots.push(root);
	return root;
}

function makeProfile(root, name = "external Site") {
	const profile = join(root, name);
	cpSync(defaultProfile, profile, { recursive: true });
	return profile;
}

function hashTree(root) {
	const hash = createHash("sha256");
	visit(root, "");
	return hash.digest("hex");

	function visit(base, rel) {
		for (const name of readdirSync(join(base, rel)).sort()) {
			const child = join(rel, name);
			const path = join(base, child);
			const stat = lstatSync(path);
			assert.equal(stat.isSymbolicLink(), false, `test fixture unexpectedly contains link: ${child}`);
			hash.update(`${relative(root, path)}:${stat.mode}:`);
			if (stat.isDirectory()) visit(base, child);
			else hash.update(readFileSync(path));
		}
	}
}

test("validates and materializes a Site tree from a Unicode path without changing it", () => {
	const root = makeTempRoot("external Site");
	const profile = makeProfile(root);
	const siteRoot = join(root, "Core build target");
	rmSync(join(profile, "data/devices.json"));
	mkdirSync(join(siteRoot, "src/content/posts"), { recursive: true });
	mkdirSync(join(siteRoot, "src/_data"), { recursive: true });
	writeFileSync(join(siteRoot, "src/content/posts/stale.md"), "stale");
	writeFileSync(join(siteRoot, "src/_data/devices.json"), "stale device data");
	const before = hashTree(profile);

	const contract = validateProfileSource(profile, siteRoot);
	assert.equal(contract.profileDir, realpathSync(profile));
	assert.ok(contract.mappings.some((mapping) => mapping.source === "assets/images"));
	materializeProfile(profile, siteRoot);

	assert.equal(readFileSync(join(siteRoot, "kirari.config.toml"), "utf8"), readFileSync(join(profile, "kirari.config.toml"), "utf8"));
	assert.equal(readFileSync(join(siteRoot, "src/content/posts/guide/cover.jpeg")).length > 0, true);
	assert.equal(lstatSync(join(siteRoot, "src/content/posts")).isDirectory(), true);
	assert.equal(lstatSync(join(siteRoot, "src/content/posts/stale.md"), { throwIfNoEntry: false }), undefined);
	assert.equal(lstatSync(join(siteRoot, "src/_data/devices.json"), { throwIfNoEntry: false }), undefined);
	assert.equal(hashTree(profile), before);
});

test("rejects missing mandatory input before changing any destination", () => {
	const root = makeTempRoot("missing input");
	const profile = makeProfile(root);
	const siteRoot = join(root, "site target");
	mkdirSync(join(siteRoot, "src/content/posts"), { recursive: true });
	writeFileSync(join(siteRoot, "kirari.config.toml"), "existing output");
	writeFileSync(join(siteRoot, "src/content/posts/keep.md"), "keep");
	rmSync(join(profile, "data/friends.json"));

	assert.throws(() => materializeProfile(profile, siteRoot), /data\/friends\.json.*required|required.*data\/friends\.json/i);
	assert.equal(readFileSync(join(siteRoot, "kirari.config.toml"), "utf8"), "existing output");
	assert.equal(readFileSync(join(siteRoot, "src/content/posts/keep.md"), "utf8"), "keep");
});

test("rejects wrong file types and malformed required data", async (t) => {
	for (const scenario of ["friends directory", "invalid JSON", "TOML directory", "missing spec entry"]) {
		await t.test(scenario, () => {
			const root = makeTempRoot(scenario);
			const profile = makeProfile(root);
			if (scenario === "friends directory") {
				rmSync(join(profile, "data/friends.json"));
				mkdirSync(join(profile, "data/friends.json"));
			} else if (scenario === "invalid JSON") {
				writeFileSync(join(profile, "data/friends.json"), "{");
			} else if (scenario === "TOML directory") {
				rmSync(join(profile, "kirari.config.toml"));
				mkdirSync(join(profile, "kirari.config.toml"));
			} else {
				rmSync(join(profile, "content/spec/friends.md"));
			}
			assert.throws(() => validateProfileSource(profile, join(root, "target")));
		});
	}
});

test("rejects symlinks inside mapped Site inputs", () => {
	const root = makeTempRoot("symlink input");
	const profile = makeProfile(root);
	const external = join(root, "outside");
	mkdirSync(external);
	writeFileSync(join(external, "escaped.md"), "outside");
	rmSync(join(profile, "content/posts"), { recursive: true });
	symlinkSync(external, join(profile, "content/posts"), "dir");

	assert.throws(() => validateProfileSource(profile, join(root, "target")), /symlink|symbolic link/i);
});

test("rejects source/destination overlap and destination symlink traversal before replacement", () => {
	const root = makeTempRoot("destination boundary");
	const profile = makeProfile(root);
	assert.throws(() => validateProfileSource(profile, profile), /overlap|same|destination/i);

	const siteRoot = join(root, "target");
	const outside = join(root, "outside");
	mkdirSync(join(siteRoot, "src/content/posts"), { recursive: true });
	mkdirSync(outside);
	writeFileSync(join(siteRoot, "src/content/posts/keep.md"), "keep");
	writeFileSync(join(outside, "sentinel"), "untouched");
	symlinkSync(outside, join(siteRoot, "public"), "dir");
	assert.throws(() => materializeProfile(profile, siteRoot), /symlink|symbolic link/i);
	assert.equal(readFileSync(join(siteRoot, "src/content/posts/keep.md"), "utf8"), "keep");
	assert.equal(readFileSync(join(outside, "sentinel"), "utf8"), "untouched");
});

test("demo regression QA refuses an external Site environment", () => {
	const result = spawnSync(process.execPath, [join(repoRoot, "apps/site/scripts/qa-regression-check.mjs")], {
		cwd: repoRoot,
		encoding: "utf8",
		env: { ...process.env, KIRARI_SITE_SOURCE: "/tmp/read-only-external-site" },
	});
	assert.equal(result.status, 2);
	assert.match(result.stderr, /targets packages\/site-profile and refuses an external Site source/);
});

test("copy and replacement failures are loud and restore prior outputs", () => {
	const root = makeTempRoot("failed replacement");
	const profile = makeProfile(root);
	const siteRoot = join(root, "target");
	const snippets = join(profile, "snippets");
	mkdirSync(snippets, { recursive: true });
	const unreadable = join(snippets, "unreadable.js");
	writeFileSync(unreadable, "trusted();");
	chmodSync(unreadable, 0o000);
	mkdirSync(join(siteRoot, "src/content/posts"), { recursive: true });
	writeFileSync(join(siteRoot, "kirari.config.toml"), "previous config");
	writeFileSync(join(siteRoot, "src/content/posts/previous.md"), "previous content");
	assert.throws(() => materializeProfile(profile, siteRoot), /permission|read|copy|EACCES/i);
	assert.equal(readFileSync(join(siteRoot, "kirari.config.toml"), "utf8"), "previous config");
	assert.equal(readFileSync(join(siteRoot, "src/content/posts/previous.md"), "utf8"), "previous content");
	chmodSync(unreadable, 0o600);
	rmSync(unreadable);

	const contentDir = join(siteRoot, "src/content");
	chmodSync(contentDir, 0o555);
	try {
		assert.throws(() => materializeProfile(profile, siteRoot));
	} finally {
		chmodSync(contentDir, 0o755);
	}
	assert.equal(readFileSync(join(siteRoot, "kirari.config.toml"), "utf8"), "previous config");
	assert.equal(readFileSync(join(siteRoot, "src/content/posts/previous.md"), "utf8"), "previous content");
	assert.equal(readdirSync(siteRoot).some((entry) => entry.startsWith(".kirari-profile-stage-")), false);
});

test("replaces a failed or older Site without retaining stale files", () => {
	const root = makeTempRoot("stale replacement");
	const firstProfile = makeProfile(root, "first Site");
	const secondProfile = makeProfile(root, "second Site");
	const siteRoot = join(root, "target");
	materializeProfile(firstProfile, siteRoot);
	writeFileSync(join(firstProfile, "content/posts/old-only.md"), "old");
	materializeProfile(firstProfile, siteRoot);
	assert.equal(lstatSync(join(siteRoot, "src/content/posts/old-only.md")).isFile(), true);
	rmSync(join(secondProfile, "content/posts"), { recursive: true });
	rmSync(join(secondProfile, "data/devices.json"));
	materializeProfile(secondProfile, siteRoot);
	assert.equal(readdirSync(join(siteRoot, "src/content/posts")).length, 0);
	assert.equal(lstatSync(join(siteRoot, "src/_data/devices.json"), { throwIfNoEntry: false }), undefined);
});
