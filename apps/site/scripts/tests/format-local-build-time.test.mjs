import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const helperUrl = new URL("../../src/utils/format-local-build-time.mjs", import.meta.url).href;
const source = `import { formatLocalBuildTime } from ${JSON.stringify(helperUrl)}; process.stdout.write(formatLocalBuildTime(new Date("2026-10-23T07:15:30.000Z")));`;

test("formats build timestamps as local time without a timezone label", () => {
	for (const [timezone, expected] of [["UTC", "2026-10-23 07:15:30"], ["Asia/Shanghai", "2026-10-23 15:15:30"]]) {
		const result = spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
			encoding: "utf8",
			env: { ...process.env, TZ: timezone },
		});
		assert.equal(result.status, 0, result.stderr);
		assert.equal(result.stdout, expected);
	}
});
