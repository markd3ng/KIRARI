import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "smol-toml";
import { buildContentSecurityPolicy, createVercelConfig } from "../security-policy.mjs";
import { resolveAnalyticsSettings } from "../../src/utils/analytics-settings.mjs";

const sources = (policy, directive) => policy.split("; ").find((part) => part.startsWith(`${directive} `)).split(" ").slice(1);
const policy = (analytics) => buildContentSecurityPolicy({ analytics });
const baseline = policy({ enable: false });
const cases = [
 ["GA4", { googleAnalyticsId: "G-TEST" }, "https://www.googletagmanager.com", "https://www.google-analytics.com"],
 ["Clarity", { clarityProjectId: "test" }, "https://www.clarity.ms", "https://*.clarity.ms"],
 ["Umami default", { umami: { id: "test" } }, "https://analytics.umami.is", "https://gateway.umami.is"],
 ["Umami cloud", { umami: { id: "test", src: "https://cloud.umami.is/script.js" } }, "https://cloud.umami.is", "https://gateway.umami.is"],
 ["Umami self-host", { umami: { id: "test", src: "https://umami.example/script.js" } }, "https://umami.example", "https://umami.example"],
 ["Plausible default", { plausible: { domain: "example.org" } }, "https://plausible.io", "https://plausible.io"],
 ["Plausible custom", { plausible: { domain: "example.org", src: "https://plausible.example/js/script.js" } }, "https://plausible.example", "https://plausible.example"],
 ["Fathom", { fathomSiteId: "test" }, "https://cdn.usefathom.com", "https://cdn.usefathom.com"],
 ["Simple Analytics", { simpleAnalyticsDomain: "scripts.simpleanalyticscdn.com" }, "https://scripts.simpleanalyticscdn.com", "https://queue.simpleanalyticscdn.com"],
 ["Simple Analytics proxy", { simpleAnalyticsDomain: "stats.example" }, "https://stats.example", "https://stats.example"],
 ["Matomo", { matomo: { siteId: "1", src: "https://matomo.example/matomo.js" } }, "https://matomo.example", "https://matomo.example"],
 ["Amplitude", { amplitudeApiKey: "test" }, "https://cdn.amplitude.com", "https://api2.amplitude.com"],
];
for (const [name, settings, script, connect] of cases) {
 test(`${name}: enabled script and collector, disabled unchanged`, () => {
  const generated = policy({ enable: true, ...settings });
  assert.ok(sources(generated, "script-src").includes(script));
  assert.ok(sources(generated, "connect-src").includes(connect));
  assert.equal(policy({ enable: false, ...settings }), baseline);
  assert.equal(createVercelConfig({ analytics: { enable: true, ...settings } }).headers.at(-1).headers[0].value, generated);
 });
}
test("unconfigured providers and orphan script URLs add no origins", () => {
 assert.equal(policy({ enable: true }), baseline);
 assert.equal(policy({ enable: true, umami: { src: "https://orphan.example/script.js" }, plausible: { src: "https://orphan.example/script.js" } }), baseline);
 assert.ok(!policy({ enable: true, matomo: { siteId: "1", src: "javascript:alert(1)" } }).includes("javascript:"));
});
test("Simple Analytics accepts a host or HTTPS origin and omits malformed host input consistently", () => {
 for (const [input, expected] of [["stats.example", "stats.example"], ["https://stats.example", "stats.example"]]) {
  const settings = resolveAnalyticsSettings({ enable: true, simpleAnalyticsDomain: input }, (key, fallback = "") => key === "PUBLIC_SIMPLE_ANALYTICS_DOMAIN" ? input : fallback, (_key, fallback) => fallback);
  assert.equal(settings.simpleAnalyticsDomain, expected);
  assert.ok(sources(policy(settings), "script-src").includes(`https://${expected}`));
 }
 for (const input of ["http://stats.example", "https://stats.example/path", "javascript:alert(1)"]) {
  const settings = resolveAnalyticsSettings({ enable: true, simpleAnalyticsDomain: input }, (key, fallback = "") => key === "PUBLIC_SIMPLE_ANALYTICS_DOMAIN" ? input : fallback, (_key, fallback) => fallback);
  assert.equal(settings.simpleAnalyticsDomain, "");
  assert.equal(policy(settings), baseline);
 }
});
test("documented environment settings resolve identically for app and policy", () => {
 const env = { PUBLIC_ANALYTICS_ENABLE: "true", PUBLIC_UMAMI_ID: "test", PUBLIC_UMAMI_SRC: "https://env.example/script.js", PUBLIC_CLARITY_ID: "alias" };
 const string = (key, fallback = "") => env[key]?.trim() || fallback;
 const boolean = (key, fallback) => key in env ? env[key] === "true" : fallback;
 const resolved = resolveAnalyticsSettings({}, string, boolean);
 assert.equal(resolved.umami.src, env.PUBLIC_UMAMI_SRC);
 assert.equal(resolved.clarityProjectId, "alias");
 const original = { ...process.env };
 try {
  Object.assign(process.env, env);
  assert.deepEqual(resolveAnalyticsSettings({}), resolved);
  assert.equal(buildContentSecurityPolicy({}), buildContentSecurityPolicy({ analytics: resolved }));
  assert.ok(sources(buildContentSecurityPolicy({}), "connect-src").includes("https://env.example"));
 } finally { process.env = original; }
});
test("AdSense sources are added only when Ads is enabled with a configured slot or search ads", () => {
 const config = { ads: { enable: true, publisherId: "ca-pub-1234567890123456", slots: { articleBottom: "9876543210" } } };
	 assert.equal(buildContentSecurityPolicy({ ...config, ads: { ...config.ads, enable: false } }), baseline);
	 const enabled = buildContentSecurityPolicy(config);
	 assert.ok(sources(enabled, "script-src").includes("https://pagead2.googlesyndication.com"));
	 assert.ok(sources(enabled, "connect-src").includes("https://googleads.g.doubleclick.net"));
	 assert.ok(sources(enabled, "frame-src").includes("https://tpc.googlesyndication.com"));
	 assert.equal(buildContentSecurityPolicy({ ads: { enable: true } }), baseline);
	 assert.ok(buildContentSecurityPolicy({ ads: { enable: true }, search: { google: { adsense: true } } }).includes("https://pagead2.googlesyndication.com"));
});
test("both static policy writers share the resolver; disabled checked-in config unchanged", () => {
 const postbuild = readFileSync(new URL("../postbuild.mjs", import.meta.url), "utf8");
 assert.match(postbuild, /const contentSecurityPolicy = buildContentSecurityPolicy\(config\)/);
 const config = JSON.parse(readFileSync(new URL("../../../../vercel.json", import.meta.url), "utf8"));
 const profile = parse(readFileSync(new URL("../../../../packages/site-profile/kirari.config.toml", import.meta.url), "utf8"));
 assert.deepEqual(config, createVercelConfig(profile));
});
