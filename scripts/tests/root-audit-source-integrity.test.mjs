import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const workflow = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
const rootAuditJob = workflow.match(/^  root-audit:\n([\s\S]*?)(?=^  [a-zA-Z0-9_-]+:|$(?![\s\S]))/m)?.[1] ?? "";
const integrityStep = rootAuditJob.match(/^      - name: Verify the checkout stayed at the exact Git tree before evaluation\n([\s\S]*?)(?=^      - |$(?![\s\S]))/m)?.[1] ?? "";
const indentedScript = integrityStep.match(/^        run: \|\n([\s\S]*)$/m)?.[1] ?? "";
const integrityScript = indentedScript.split("\n").map((line) => line.startsWith("          ") ? line.slice(10) : line).join("\n");

function git(repo, ...args) {
	return execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
}

function runIntegrity(repo, runnerTemp, expectedSha) {
	return spawnSync("bash", ["-c", integrityScript], {
		cwd: repo,
		encoding: "utf8",
		env: { ...process.env, EXPECTED_PR_HEAD_SHA: expectedSha, RUNNER_TEMP: runnerTemp },
	});
}

test("source integrity accepts the exact regular tree and rejects hidden edits and symlinks", () => {
	assert.ok(integrityScript.includes("git ls-tree -r -z"), "the tested shell must parse the exact candidate tree");
	const parent = mkdtempSync(join(tmpdir(), "kirari-source-integrity-"));
	const repo = join(parent, "repo");
	const runnerTemp = join(parent, "runner-temp");
	const targetPath = join(repo, "scripts/root-audit/cli.mjs");
	try {
		mkdirSync(join(repo, "scripts/root-audit"), { recursive: true });
		mkdirSync(join(runnerTemp, "kirari-root-audit"), { recursive: true });
		execFileSync("git", ["init", "--quiet", repo]);
		git(repo, "config", "user.name", "Integrity Test");
		git(repo, "config", "user.email", "integrity@example.invalid");
		writeFileSync(targetPath, "process.exit(1);\n");
		git(repo, "add", "scripts/root-audit/cli.mjs");
		git(repo, "commit", "--quiet", "-m", "regular evaluator");
		let sha = git(repo, "rev-parse", "HEAD");
		let result = runIntegrity(repo, runnerTemp, sha);
		assert.equal(result.status, 0, result.stderr || result.stdout);
		assert.equal(readFileSync(join(runnerTemp, "kirari-root-audit/source-tree-integrity"), "utf8").trim(), "PASS");

		writeFileSync(targetPath, "mutated but hidden from git diff\n");
		git(repo, "update-index", "--assume-unchanged", "scripts/root-audit/cli.mjs");
		assert.equal(git(repo, "diff", "--quiet", "HEAD", "--", "scripts/root-audit/cli.mjs") || "clean", "clean");
		result = runIntegrity(repo, runnerTemp, sha);
		assert.notEqual(result.status, 0, "direct blob comparison must catch assume-unchanged byte edits");
		assert.equal(readFileSync(join(runnerTemp, "kirari-root-audit/source-tree-integrity"), "utf8").trim(), "FAIL");
		git(repo, "update-index", "--no-assume-unchanged", "scripts/root-audit/cli.mjs");
		git(repo, "checkout", "--", "scripts/root-audit/cli.mjs");

		chmodSync(targetPath, 0o755);
		git(repo, "update-index", "--assume-unchanged", "scripts/root-audit/cli.mjs");
		result = runIntegrity(repo, runnerTemp, sha);
		assert.notEqual(result.status, 0, "the integrity check must compare executable mode as well as bytes");
		git(repo, "update-index", "--no-assume-unchanged", "scripts/root-audit/cli.mjs");
		chmodSync(targetPath, 0o644);

		writeFileSync(join(repo, "scripts/root-audit/process.exit(0).mjs"), "process.exit(0).mjs");
		rmSync(targetPath);
		symlinkSync("process.exit(0).mjs", targetPath);
		git(repo, "add", "-A");
		git(repo, "commit", "--quiet", "-m", "symlink evaluator");
		sha = git(repo, "rev-parse", "HEAD");
		result = runIntegrity(repo, runnerTemp, sha);
		assert.notEqual(result.status, 0, "a Git symlink must not pass as an evaluator source file");
		assert.match(result.stdout, /Unsupported tracked Git entry type or mode/);
	} finally {
		rmSync(parent, { recursive: true, force: true });
	}
});
