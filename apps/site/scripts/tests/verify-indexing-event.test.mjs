import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";

const root = mkdtempSync(join(tmpdir(), "kirari-indexing-event-"));
const eventFile = join(root, "event.json");
const outputFile = join(root, "outputs");
const script = fileURLToPath(new URL("../verify-indexing-event.mjs", import.meta.url));
after(() => rmSync(root, { recursive: true, force: true }));

function run(event) {
	writeFileSync(eventFile, JSON.stringify(event));
	writeFileSync(outputFile, "");
	return spawnSync(process.execPath, [script], { encoding: "utf8", env: { ...process.env, GITHUB_EVENT_PATH: eventFile, GITHUB_OUTPUT: outputFile } });
}

test("preflight exports only a validated deployment SHA and ID", () => {
	const sha = "d".repeat(40);
	const good = run({
		action: "vercel.deployment.success",
		repository: { full_name: "markd3ng/KIRARI" },
		sender: { login: "vercel[bot]" },
		client_payload: {
			id: "dpl_1234567890",
			environment: "production",
			project: { id: "prj_QNMVdxTkPOad4ynN4fwFCYEST8Jk", name: "kirari-main" },
			git: { ref: "main", sha, shortSha: sha.slice(0, 7) },
			state: { type: "success" },
			alias: ["kirari-main.vercel.app"],
			url: "https://kirari-main-deployabc-team-projects.vercel.app",
		},
	});
	assert.equal(good.status, 0, good.stderr);
	assert.equal(readFileSync(outputFile, "utf8"), `sha=${sha}\nid=dpl_1234567890\n`);

	const bad = run({ action: "vercel.deployment.success", repository: { full_name: "markd3ng/KIRARI" }, sender: { login: "someone-else" }, client_payload: {} });
	assert.equal(bad.status, 0, bad.stderr);
	assert.equal(readFileSync(outputFile, "utf8"), "");
});
