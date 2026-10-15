import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { resolveBuildAnalytics } from "../build-analytics-settings.mjs";
import { buildContentSecurityPolicy, createVercelConfig } from "../security-policy.mjs";

const site = fileURLToPath(new URL("../../", import.meta.url));
const keys = ["PUBLIC_ANALYTICS_ENABLE", "PUBLIC_UMAMI_ID", "PUBLIC_UMAMI_SRC"];
const raw = { enable: false, umami: { id: "toml-id", src: "https://toml.invalid/script.js" } };

function fixture(context) {
	const root = mkdtempSync(join(site, ".analytics-env-test-"));
	const original = keys.map((key) => process.env[key]);
	for (const key of keys) delete process.env[key];
	context.after(() => {
		rmSync(root, { recursive: true, force: true });
		keys.forEach((key, index) => {
			if (original[index] === undefined) delete process.env[key];
			else process.env[key] = original[index];
		});
	});
	mkdirSync(join(root, "src/pages"), { recursive: true });
	writeFileSync(join(root, "astro.config.mjs"), `export default {root:${JSON.stringify(root)}};`);
	writeFileSync(join(root, ".env"), "PUBLIC_UMAMI_SRC=https://base-env.invalid/script.js\n");
	writeFileSync(join(root, ".env.production"), "PUBLIC_ANALYTICS_ENABLE=true\nPUBLIC_UMAMI_ID=dotenv-id\nPUBLIC_UMAMI_SRC=https://dotenv-only.invalid/script.js\n");
	writeFileSync(join(root, "src/pages/index.astro"), `---
import Analytics from ${JSON.stringify(join(site, "src/components/Analytics.astro"))};
import {resolveAnalyticsSettings} from ${JSON.stringify(join(site, "src/utils/analytics-settings.mjs"))};
import {getEnvString,getEnvBoolean} from ${JSON.stringify(join(site, "src/utils/env.ts"))};
const settings=resolveAnalyticsSettings(${JSON.stringify(raw)},getEnvString,getEnvBoolean);
---
<html><head><title>Analytics env fixture</title></head><body>{settings.enable && <Analytics config={settings}/>}</body></html>`);
	return root;
}

function build(root) {
	const result = spawnSync(process.execPath, [join(site, "node_modules/astro/bin/astro.mjs"), "build", "--root", root, "--config", "astro.config.mjs"], { cwd: site, encoding: "utf8", timeout: 60_000 });
	assert.equal(result.status, 0, `${result.error || ""}\n${result.stdout}\n${result.stderr}`);
	return readFileSync(join(root, "dist/index.html"), "utf8");
}

for (const processOverride of [false, true]) {
	test(`Astro-rendered dotenv analytics match both policy outputs${processOverride ? " with process overrides" : ""}`, (context) => {
		const root = fixture(context);
		if (processOverride) {
			process.env.PUBLIC_UMAMI_SRC = "https://process-env.invalid/script.js";
			process.env.PUBLIC_UMAMI_ID = "process-id";
		}
		const expectedOrigin = processOverride ? "https://process-env.invalid" : "https://dotenv-only.invalid";
		const settings = resolveBuildAnalytics(raw, { envDir: root });
		assert.equal(settings.enable, true);
		assert.equal(settings.umami.src, `${expectedOrigin}/script.js`);
		const html = build(root);
		assert.ok(html.includes(`src="${settings.umami.src}"`));
		assert.ok(html.includes(`data-website-id="${settings.umami.id}"`));
		const csp = buildContentSecurityPolicy({ analytics: settings });
		assert.ok(csp.split("; ").find((part) => part.startsWith("script-src ")).includes(expectedOrigin));
		assert.ok(csp.split("; ").find((part) => part.startsWith("connect-src ")).includes(expectedOrigin));
		assert.equal(createVercelConfig({ analytics: settings }).headers.at(-1).headers[0].value, csp);
		assert.ok(!csp.includes("https://base-env.invalid"));
		assert.ok(!csp.includes("https://toml.invalid"));
	});
}

test("dotenv opt-out suppresses rendered scripts and provider origins", (context) => {
	const root = fixture(context);
	process.env.PUBLIC_ANALYTICS_ENABLE = "false";
	const settings = resolveBuildAnalytics(raw, { envDir: root });
	assert.equal(settings.enable, false);
	assert.ok(!build(root).includes("dotenv-only.invalid"));
	assert.ok(!buildContentSecurityPolicy({ analytics: settings }).includes("dotenv-only.invalid"));
});

test("both real policy writers resolve the build environment before creating policy", () => {
	for (const name of ["postbuild.mjs", "generate-vercel-config.mjs"]) {
		const source = readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
		assert.match(source, /config\.analytics = resolveBuildAnalytics\(config\.analytics\)/);
	}
});
