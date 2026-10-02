import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { getBuildDate } from "../../src/utils/build-clock.mjs";

test("ordinary builds keep using the current clock", () => {
	const before = Date.now();
	const buildDate = getBuildDate({ SOURCE_DATE_EPOCH: "0" });
	assert.ok(buildDate.getTime() >= before);
	assert.ok(buildDate.getTime() <= Date.now());
});

test("composition builds use SOURCE_DATE_EPOCH and reject invalid values", () => {
	const environment = { KIRARI_DETERMINISTIC_BUILD_CLOCK: "true", SOURCE_DATE_EPOCH: "1790899200" };
	assert.equal(getBuildDate(environment).toISOString(), "2026-10-02T00:00:00.000Z");
	assert.throws(() => getBuildDate({ KIRARI_DETERMINISTIC_BUILD_CLOCK: "true" }), /requires SOURCE_DATE_EPOCH/i);
	for (const value of ["-1", "1.5", "9007199254740991"]) {
		assert.throws(
			() => getBuildDate({ KIRARI_DETERMINISTIC_BUILD_CLOCK: "true", SOURCE_DATE_EPOCH: value }),
			/SOURCE_DATE_EPOCH/i,
		);
	}
});

test("a UTC composition clock renders the same local year across host timezones", () => {
	const helperUrl = new URL("../../src/utils/build-clock.mjs", import.meta.url).href;
	const source = `import { getBuildDate } from ${JSON.stringify(helperUrl)}; process.stdout.write(String(getBuildDate().getFullYear()));`;
	const rendered = spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
		encoding: "utf8",
		env: {
			...process.env,
			KIRARI_DETERMINISTIC_BUILD_CLOCK: "true",
			SOURCE_DATE_EPOCH: "1790899200",
			TZ: "UTC",
		},
	});
	assert.equal(rendered.status, 0, rendered.stderr);
	assert.equal(rendered.stdout, "2026");
});
