// Real Analytics.astro markup + browser CSP enforcement; all provider traffic is
// intercepted locally. This checks source policy, not vendor SDK correctness.
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { chromium } from "../p3-browser/node_modules/playwright/index.mjs";
import { buildContentSecurityPolicy } from "../../apps/site/scripts/security-policy.mjs";

const WAIT_TIMEOUT = 30_000;
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const site = resolve(repo, "apps/site");
const fixture = mkdtempSync(resolve(site, ".analytics-fixture-"));
const analytics = { enable: true, googleAnalyticsId: "G-FIXTURE", clarityProjectId: "fixture", fathomSiteId: "fixture", simpleAnalyticsDomain: "scripts.simpleanalyticscdn.com", amplitudeApiKey: "fixture", umami: { id: "fixture", src: "https://umami.example/script.js" }, plausible: { domain: "example.test" }, matomo: { siteId: "1", src: "https://matomo.example/matomo.js" } };
let server, browser;
try {
 mkdirSync(resolve(fixture, "src/pages"), { recursive: true });
 writeFileSync(resolve(fixture, "astro.config.mjs"), `export default { root: ${JSON.stringify(fixture)}, site: 'http://localhost', outDir: './dist' };`);
 const component = resolve(site, "src/components/Analytics.astro");
 writeFileSync(resolve(fixture, "src/pages/index.astro"), `---\nimport Analytics from ${JSON.stringify(component)};\nconst config = ${JSON.stringify(analytics)};\n---\n<!doctype html><html><head><title>CSP fixture</title></head><body><Analytics config={config}/></body></html>`);
 execFileSync(process.execPath, [resolve(site, "node_modules/astro/bin/astro.mjs"), "build", "--root", fixture, "--config", "astro.config.mjs"], { cwd: site, stdio: "pipe" });
 const enabled = readFileSync(resolve(fixture, "dist/index.html"), "utf8");
 server = createServer((req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.setHeader("Content-Security-Policy", buildContentSecurityPolicy({ analytics }));
  res.end(enabled);
 });
 await new Promise((done) => server.listen(0, "127.0.0.1", done));
 browser = await chromium.launch({ headless: true });
 const page = await browser.newPage();
 page.setDefaultTimeout(WAIT_TIMEOUT);
 page.setDefaultNavigationTimeout(WAIT_TIMEOUT);
 const seen = [], violations = [];
 const unexpectedScripts = [];
 await page.exposeFunction("recordViolation", (event) => violations.push(event));
 await page.addInitScript(() => document.addEventListener("securitypolicyviolation", (event) => window.recordViolation({ directive: event.effectiveDirective, uri: event.blockedURI })));
 const collectors = {
  "www.googletagmanager.com": "https://www.google-analytics.com/g/collect",
  "www.clarity.ms": "https://a.clarity.ms/collect",
  "cdn.usefathom.com": "https://cdn.usefathom.com/",
  "scripts.simpleanalyticscdn.com": "https://queue.simpleanalyticscdn.com/events",
  "cdn.amplitude.com": "https://api2.amplitude.com/2/httpapi",
  "umami.example": "https://umami.example/api/send",
  "plausible.io": "https://plausible.io/api/event",
  "matomo.example": "https://matomo.example/matomo.php",
 };
 const expectedScriptHosts = Object.keys(collectors);
 const expectedCollectors = Object.values(collectors);
 await page.route("**/*", async (route) => {
  const request = route.request(), url = new URL(request.url());
  if (url.hostname === "127.0.0.1") return route.continue();
  seen.push({ type: request.resourceType(), url: request.url() });
  if (request.resourceType() === "script") {
   const collector = collectors[url.hostname];
   if (!collector) unexpectedScripts.push(request.url());
   return route.fulfill({ contentType: "application/javascript", body: collector ? `fetch(${JSON.stringify(collector)}, {method:'POST', body:'fixture'}).catch(()=>{});` : "" });
  }
  return route.fulfill({ status: 200, contentType: "text/plain", headers: { "access-control-allow-origin": "*" }, body: "ok" });
 });
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.waitForFunction(({ scriptHosts, collectorUrls }) => {
  const resources = performance.getEntriesByType("resource");
  const scriptHostsSeen = new Set(resources.filter((entry) => entry.initiatorType === "script").map((entry) => new URL(entry.name).hostname));
  const fetchUrlsSeen = resources.filter((entry) => entry.initiatorType === "fetch").map((entry) => new URL(entry.name));
  return scriptHosts.every((host) => scriptHostsSeen.has(host)) && collectorUrls.every((expected) => {
   const target = new URL(expected);
   return fetchUrlsSeen.some((actual) => actual.origin === target.origin && actual.pathname.startsWith(target.pathname));
  });
 }, { scriptHosts: expectedScriptHosts, collectorUrls: expectedCollectors }, { timeout: WAIT_TIMEOUT });
 const actualScriptHosts = new Set(seen.filter((entry) => entry.type === "script").map((entry) => new URL(entry.url).hostname));
 const actualCollectors = new Set(seen.filter((entry) => entry.type === "fetch").map((entry) => {
  const url = new URL(entry.url);
  return `${url.origin}${url.pathname}`;
 }));
 const unexpectedCollectors = seen.filter((entry) => entry.type === "fetch" && !expectedCollectors.some((expected) => {
  const target = new URL(expected);
  const actual = new URL(entry.url);
  return actual.origin === target.origin && actual.pathname.startsWith(target.pathname);
 }));
 assert.deepEqual(unexpectedScripts, []);
 assert.deepEqual(unexpectedCollectors, []);
 assert.deepEqual([...actualScriptHosts].sort(), [...expectedScriptHosts].sort());
 for (const expected of expectedCollectors) {
  const target = new URL(expected);
  assert.ok([...actualCollectors].some((actual) => {
   const observed = new URL(actual);
   return observed.origin === target.origin && observed.pathname.startsWith(target.pathname);
  }), `collector was not observed: ${expected}`);
 }
 assert.deepEqual(violations, []);
 console.log(JSON.stringify({
  result: "PASS",
  scriptRequests: seen.filter((entry) => entry.type === "script").length,
  uniqueScriptHosts: actualScriptHosts.size,
  controlledCollectors: actualCollectors.size,
  cspViolations: violations.length,
  providerRequestsIntercepted: seen.length,
 }));
} finally {
 await browser?.close();
 if (server) await new Promise((done) => server.close(done));
 rmSync(fixture, { recursive: true, force: true });
}
