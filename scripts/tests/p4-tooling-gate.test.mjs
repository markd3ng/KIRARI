import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { collectFullToolingAudit } from "../p4-production/tooling-gate.mjs";
import { npmRuntime, spawnNpm } from "../p4-production/npm-runtime.mjs";
import { installProductionTooling } from "../p4-production/tooling-install.mjs";

test("unchanged full plain and JSON audits both execute after raw failure without credentials or suppression", () => {
	const root = mkdtempSync(join(tmpdir(), "kirari-full-audit-test-"));
	const calls = [];
	try {
		const result = collectFullToolingAudit({ outputDirectory: root, env: { PATH: "/test", HOME: "/temporary", VERCEL_TOKEN: "never-forward", GH_TOKEN: "never-forward" }, spawn: (command, args, options) => {
			calls.push({ command, args, options });
			return { status: 1, stdout: args.includes("--json") ? '{"metadata":{"vulnerabilities":{"moderate":1}}}\n' : "1 moderate vulnerability\n", stderr: "" };
		} });
		assert.deepEqual(calls.map(x => [x.command, ...x.args]), [
			[process.execPath, npmRuntime().cli, "audit", "--prefix", "scripts/p4-production/tooling", "--audit-level", "moderate"],
			[process.execPath, npmRuntime().cli, "audit", "--prefix", "scripts/p4-production/tooling", "--audit-level", "moderate", "--json"],
		]);
		for (const { command, args, options } of calls) { assert.equal(command, process.execPath); assert.equal(args[0], npmRuntime().cli); assert.equal(options.env.VERCEL_TOKEN, undefined); assert.equal(options.env.GH_TOKEN, undefined); }
		assert.equal(result.auditExitCode, 1);
		assert.equal(result.execution.json_exit_code, 1);
		assert.equal(result.execution.plain_executed, true);
		assert.equal(result.execution.json_executed, true);
		assert.equal(readFileSync(join(root, "npm-audit.json"), "utf8"), result.auditJson);
		assert.equal(readFileSync(join(root, "npm-audit.txt"), "utf8"), "1 moderate vulnerability\n");
	} finally { rmSync(root, { recursive: true, force: true }); }
});

test("audit execution error still attempts full JSON and is not a qualifying accepted inventory", () => {
	const root = mkdtempSync(join(tmpdir(), "kirari-audit-error-test-")); let calls = 0;
	try {
		const result = collectFullToolingAudit({ outputDirectory: root, spawn: () => { calls++; return { status: null, error: new Error("spawn failed") }; } });
		assert.equal(calls, 2);
		assert.equal(result.auditExitCode, null);
		assert.equal(result.execution.plain_executed, false);
		assert.equal(result.execution.json_executed, false);
	} finally { rmSync(root, { recursive: true, force: true }); }
});

test("locked install receipt records actual npm command and strips credential and cross-step environment channels", () => {
	const root = mkdtempSync(join(tmpdir(), "kirari-install-receipt-test-")); const calls = [];
	try {
		const receipt = installProductionTooling({ outputDirectory: root, env: { PATH: "/test", GH_TOKEN: "not-forwarded", GITHUB_ENV: "/not-forwarded", GITHUB_PATH: "/not-forwarded", NODE_OPTIONS: "--unreviewed" }, spawn: (command, args, options) => {
			calls.push({ command, args, options });
			return { status: 0, stdout: args[1] === "--version" ? "10.9.0\n" : "installed\n" };
		} });
		assert.equal(receipt.completed, true);
		assert.equal(receipt.exit_code, 0);
		assert.equal(receipt.install.mode, "npm ci");
		assert.deepEqual(calls[1].args, [npmRuntime().cli, "ci", "--prefix", "scripts/p4-production/tooling", "--registry=https://registry.npmjs.org"]);
		for (const { options } of calls) {
			for (const key of ["GH_TOKEN", "GITHUB_ENV", "GITHUB_PATH", "NODE_OPTIONS"]) assert.equal(options.env[key], undefined);
			assert.match(options.env.HOME, /kirari-tooling-install-home-/);
		}
		assert.equal(JSON.parse(readFileSync(join(root, "install-receipt.json"), "utf8")).completed, true);
	} finally { rmSync(root, { recursive: true, force: true }); }
});

test("installer rejects mapped Production credentials before executing npm", () => {
	let calls = 0;
	assert.throws(() => installProductionTooling({ outputDirectory: "/unused", env: { VERCEL_TOKEN: "never-log" }, spawn: () => { calls++; } }), /CREDENTIAL_PRESENT/);
	assert.equal(calls, 0);
});


test("a PATH-shadowed npm cannot replace the Node-distribution npm audit executable", () => {
	const root = mkdtempSync(join(tmpdir(), "kirari-npm-shadow-test-"));
	try {
		const marker = join(root, "fake-npm-ran");
		writeFileSync(join(root, "npm"), `#!/bin/sh\necho spoofed\ntouch "${marker}"\n`);
		chmodSync(join(root, "npm"), 0o755);
		const result = spawnNpm(spawnSync, ["--version"], { env: { PATH: root, HOME: root }, encoding: "utf8" });
		assert.equal(result.status, 0);
		assert.equal(result.stdout.trim(), "10.9.0");
		assert.equal(existsSync(marker), false);
	} finally { rmSync(root, { recursive: true, force: true }); }
});
