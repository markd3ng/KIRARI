import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const script = "scripts/check-trellis-adapter-sync.mjs";

function run(root, optional = false) {
	return spawnSync(process.execPath, [join(root, script)], {
		encoding: "utf8",
		env: { ...process.env, CHECK_OPTIONAL_TRELLIS_ADAPTERS: optional ? "1" : "0" },
	});
}

function fixture(context, prefix = "trellis-sync-") {
	const root = mkdtempSync(join(tmpdir(), prefix));
	context.after(() => rmSync(root, { recursive: true, force: true }));
	function write(path, content = "canonical\n") {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), content);
	}
	write(script, "");
	copyFileSync(join(repoRoot, script), join(root, script));
	for (const path of [".agents/skills", ".opencode/skills", ".reasonix/skills"]) {
		write(`${path}/trellis-check/SKILL.md`);
		write(`${path}/trellis-check/references/check.md`);
	}
	return { root, write };
}

test("current repository passes its required adapter inventories", () => {
	const result = run(repoRoot);
	assert.equal(result.status, 0, result.stderr);
});

test("matching copies pass even when the script path contains spaces", (context) => {
	assert.equal(run(fixture(context, "trellis adapter sync ").root).status, 0);
});

test("missing shared skill or nested reference identifies both exact paths", (context) => {
	const { root } = fixture(context);
	rmSync(join(root, ".opencode/skills/trellis-check/SKILL.md"));
	rmSync(join(root, ".reasonix/skills/trellis-check/references/check.md"));
	const result = run(root);
	assert.equal(result.status, 1);
	assert.match(result.stderr, /\.opencode\/skills\/trellis-check\/SKILL\.md is missing.*\.agents\/skills\/trellis-check\/SKILL\.md/);
	assert.match(result.stderr, /\.reasonix\/skills\/trellis-check\/references\/check\.md is missing.*\.agents\/skills\/trellis-check\/references\/check\.md/);
});

test("new canonical skill requires adapter copies", (context) => {
	const { root, write } = fixture(context);
	write(".agents/skills/trellis-new/SKILL.md");
	const result = run(root);
	assert.equal(result.status, 1);
	assert.match(result.stderr, /\.opencode\/skills\/trellis-new\/SKILL\.md is missing/);
	assert.match(result.stderr, /\.reasonix\/skills\/trellis-new\/SKILL\.md is missing/);
});

test("changed bytes and stale adapter files fail with canonical paths", (context) => {
	const { root, write } = fixture(context);
	write(".opencode/skills/trellis-check/SKILL.md", "drift\n");
	write(".reasonix/skills/trellis-stale/SKILL.md");
	const result = run(root);
	assert.equal(result.status, 1);
	assert.match(result.stderr, /\.opencode\/skills\/trellis-check\/SKILL\.md differs from \.agents\/skills\/trellis-check\/SKILL\.md/);
	assert.match(result.stderr, /\.reasonix\/skills\/trellis-stale\/SKILL\.md has no canonical file at \.agents\/skills\/trellis-stale\/SKILL\.md/);
});

test("named platform-owned entries pass without exempting neighboring files", (context) => {
	const { root, write } = fixture(context);
	for (const skill of ["trellis-continue", "trellis-finish-work", "trellis-start"]) {
		write(`.agents/skills/${skill}/SKILL.md`);
		if (skill !== "trellis-start") write(`.reasonix/skills/${skill}/SKILL.md`);
	}
	write(".reasonix/skills/trellis-implement/SKILL.md", "platform subagent\n");
	write(".claude/skills/trellis-check/SKILL.md");
	write(".claude/skills/trellis-check/references/check.md");
	assert.equal(run(root).status, 0);
	assert.equal(run(root, true).status, 0);
	write(".reasonix/skills/trellis-implement/stale.md");
	write(".agents/skills/trellis-start/references/new.md");
	const result = run(root);
	assert.equal(result.status, 1);
	assert.match(result.stderr, /trellis-implement\/stale\.md has no canonical file/);
	assert.match(result.stderr, /trellis-start\/references\/new\.md is missing/);
});

test("missing required roots fail; absent optional root remains optional", (context) => {
	const { root } = fixture(context);
	assert.equal(run(root, true).status, 0);
	rmSync(join(root, ".opencode/skills"), { recursive: true });
	const result = run(root);
	assert.equal(result.status, 1);
	assert.match(result.stderr, /\.opencode\/skills is missing/);
});

test("optional Claude copies are checked only when enabled and present", (context) => {
	const { root, write } = fixture(context);
	write(".claude/skills/trellis-check/SKILL.md", "drift\n");
	assert.equal(run(root).status, 0);
	const result = run(root, true);
	assert.equal(result.status, 1);
	assert.match(result.stderr, /\.claude\/skills\/trellis-check\/SKILL\.md differs/);
	assert.match(result.stderr, /\.claude\/skills\/trellis-check\/references\/check\.md is missing/);
	write(".claude/skills/trellis-check/SKILL.md");
	write(".claude/skills/trellis-check/references/check.md");
	assert.equal(run(root, true).status, 0);
});
