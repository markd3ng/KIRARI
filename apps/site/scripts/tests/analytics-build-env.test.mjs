import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { ANALYTICS_BUILD_MODE, resolveBuildAds, resolveBuildAnalytics } from "../build-analytics-settings.mjs";
import { buildContentSecurityPolicy, createVercelConfig } from "../security-policy.mjs";
import { parseEnvBoolean, resolveAnalyticsSettings } from "../../src/utils/analytics-settings.mjs";

const site = fileURLToPath(new URL("../../", import.meta.url));
const keys = ["PUBLIC_ANALYTICS_ENABLE", "PUBLIC_UMAMI_ID", "PUBLIC_UMAMI_SRC", "PUBLIC_ADS_ENABLE", "PUBLIC_ADS_PUBLISHER_ID", "PUBLIC_ADS_SLOT_ARTICLE_BOTTOM"];
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
	writeFileSync(join(root, ".env.production"), "PUBLIC_ANALYTICS_ENABLE=true\nPUBLIC_UMAMI_ID=dotenv-id\nPUBLIC_UMAMI_SRC=https://dotenv-only.invalid/script.js\nPUBLIC_ADS_ENABLE=true\nPUBLIC_ADS_PUBLISHER_ID=ca-pub-1234567890123456\nPUBLIC_ADS_SLOT_ARTICLE_BOTTOM=9876543210\n");
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
		assert.ok(html.includes('id="kirari-analytics-config"'));
		assert.ok(html.includes(settings.umami.src));
		assert.ok(html.includes(settings.umami.id));
		assert.ok(!html.includes(`src="${settings.umami.src}"`), "provider scripts must stay gated in the client until the visitor preference is read");
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
		assert.match(source, /config\.analytics = resolveBuildAnalytics\(config\.analytics, \{ mode: ANALYTICS_BUILD_MODE \}\)/);
	}
	const packageJson = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
	assert.match(packageJson.scripts.build, /astro(?:\/bin\/astro\.mjs)? build --mode production/);
	assert.equal(ANALYTICS_BUILD_MODE, "production");
});

test("rendered and build-time analytics share every supported boolean spelling", () => {
	const values = [
		["true", true], ["1", true], ["yes", true], ["on", true],
		["false", false], ["0", false], ["no", false], ["off", false],
	];
	for (const [value, expected] of values) {
		const readString = (key, fallback = "") => key === "PUBLIC_ANALYTICS_ENABLE" ? value : fallback;
		const readBoolean = (key, fallback) => parseEnvBoolean(readString(key), fallback);
		assert.equal(parseEnvBoolean(value, !expected), expected);
		assert.equal(resolveAnalyticsSettings({}, readString, readBoolean).enable, expected);
	}
	assert.equal(parseEnvBoolean("unknown", true), true);
});

test("AdSense config uses the same Vite environment precedence and validation", (context) => {
	const root = fixture(context);
	const settings = resolveBuildAds({ enable: false }, { envDir: root, vercelEnv: "production" });
	assert.deepEqual(settings, { enable: true, publisherId: "ca-pub-1234567890123456", slots: { articleBottom: "9876543210" } });
	process.env.PUBLIC_ADS_PUBLISHER_ID = "invalid";
	assert.equal(resolveBuildAds({ enable: false }, { envDir: root, vercelEnv: "production" }).publisherId, "");
	process.env.PUBLIC_ADS_PUBLISHER_ID = "ca-pub-1234567890123456";
	const preview = resolveBuildAds({ enable: false }, { envDir: root, vercelEnv: "preview" });
	assert.equal(preview.enable, false);
	assert.equal(buildContentSecurityPolicy({ ads: preview }), buildContentSecurityPolicy({ ads: { ...settings, enable: false } }));
	assert.ok(!buildContentSecurityPolicy({ ads: preview }).includes("pagead2.googlesyndication.com"));
	assert.equal(resolveBuildAds({ enable: false }, { envDir: root, vercelEnv: undefined }).enable, false);
});

test("both static policy writers resolve Ads overrides before creating policy", () => {
	for (const name of ["postbuild.mjs", "generate-vercel-config.mjs"]) {
		const source = readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
		assert.match(source, /config\.ads = resolveBuildAds\(config\.ads, \{ mode: ANALYTICS_BUILD_MODE \}\)/);
	}
});
