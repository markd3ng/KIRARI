// Real Analytics/Ads components + browser CSP enforcement; all provider traffic
// is intercepted locally. This checks loading and policy, not vendor SDK correctness.
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { chromium } from "../p3-browser/node_modules/playwright/index.mjs";
import { buildContentSecurityPolicy } from "../../apps/site/scripts/security-policy.mjs";

const WAIT_TIMEOUT = 8_000;
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const site = resolve(repo, "apps/site");
const fixture = mkdtempSync(resolve(site, ".analytics-fixture-"));
const analytics = { enable: true, googleAnalyticsId: "G-FIXTURE", clarityProjectId: "fixture", fathomSiteId: "fixture", simpleAnalyticsDomain: "scripts.simpleanalyticscdn.com", amplitudeApiKey: "fixture", umami: { id: "fixture", src: "https://umami.example/script.js" }, plausible: { domain: "example.test" }, matomo: { siteId: "1", src: "https://matomo.example/matomo.js" } };
const ads = { enable: true, publisherId: "ca-pub-1234567890123456", slots: { articleBottom: "9876543210" } };
const originalVercelEnv = process.env.VERCEL_ENV;
let server, browser;
try {
 process.env.VERCEL_ENV = "production";
 mkdirSync(resolve(fixture, "src/pages"), { recursive: true });
 writeFileSync(resolve(fixture, "astro.config.mjs"), `export default { root: ${JSON.stringify(fixture)}, site: 'http://localhost', outDir: './dist' };`);
 const component = resolve(site, "src/components/Analytics.astro");
 const adsComponent = resolve(site, "src/components/Ads.astro");
 const transitionManager = resolve(site, "src/utils/transition-manager.ts");
 writeFileSync(resolve(fixture, "src/pages/index.astro"), `---\nimport Analytics from ${JSON.stringify(component)};\nimport Ads from ${JSON.stringify(adsComponent)};\nconst config = ${JSON.stringify(analytics)};\nconst adsConfig = ${JSON.stringify(ads)};\n---\n<!doctype html><html><head><title>CSP fixture</title></head><body><Analytics config={config}/><Ads config={adsConfig}/><div data-kirari-ad-slot><ins class="adsbygoogle" data-ad-client="${ads.publisherId}" data-ad-slot="${ads.slots.articleBottom}"></ins></div><script>\nimport { transitionManager } from ${JSON.stringify(transitionManager)};\nawait transitionManager.init();\nwindow.__transitionReady = true;\n</script></body></html>`);
 execFileSync(process.execPath, [resolve(site, "node_modules/astro/bin/astro.mjs"), "build", "--root", fixture, "--config", "astro.config.mjs"], { cwd: site, stdio: "pipe" });
 const enabled = readFileSync(resolve(fixture, "dist/index.html"), "utf8");
 server = createServer((req, res) => {
		const requestPath = new URL(req.url || "/", "http://127.0.0.1").pathname;
		const assetPath = resolve(fixture, "dist", `.${requestPath}`);
		if (assetPath.startsWith(`${resolve(fixture, "dist")}/`) && assetPath.endsWith(".js") && existsSync(assetPath)) {
			res.setHeader("Content-Type", "application/javascript");
			res.end(readFileSync(assetPath));
			return;
		}
		res.setHeader("Content-Type", "text/html");
  res.setHeader("Content-Security-Policy", buildContentSecurityPolicy({ analytics, ads }));
  res.end(enabled);
 });
 await new Promise((done) => server.listen(0, "127.0.0.1", done));
 browser = await chromium.launch({ headless: true });
 const page = await browser.newPage();
 page.setDefaultTimeout(WAIT_TIMEOUT);
 page.setDefaultNavigationTimeout(WAIT_TIMEOUT);
 const seen = [], violations = [];
	const pageErrors = [];
	const consoleMessages = [];
	page.on("pageerror", (error) => pageErrors.push(error.message));
	page.on("console", (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
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
 const expectedScriptHosts = [...Object.keys(collectors), "pagead2.googlesyndication.com"];
 const expectedCollectors = Object.values(collectors);
 const interceptProviderRequest = async (route, delayAdsScript = false) => {
  const request = route.request(), url = new URL(request.url());
  if (url.hostname === "127.0.0.1") return route.continue();
  seen.push({ type: request.resourceType(), url: request.url() });
  if (request.resourceType() === "script") {
   if (url.hostname === "pagead2.googlesyndication.com") {
    if (delayAdsScript) await new Promise((resolve) => { releaseAdsScript = resolve; });
    return route.fulfill({ contentType: "application/javascript", body: "window.adsbygoogle=window.adsbygoogle||[];" });
   }
   const collector = collectors[url.hostname];
   if (!collector) unexpectedScripts.push(request.url());
   const instrumentation = url.hostname === "cdn.amplitude.com" ? "window.amplitude={init:function(){},track:function(...args){(window.__amplitudeEvents=window.__amplitudeEvents||[]).push(args)}};" : "";
   return route.fulfill({ contentType: "application/javascript", body: collector ? `${instrumentation}fetch(${JSON.stringify(collector)}, {method:'POST', body:'fixture'}).catch(()=>{});` : "" });
  }
  return route.fulfill({ status: 200, contentType: "text/plain", headers: { "access-control-allow-origin": "*" }, body: "ok" });
 };
 let releaseAdsScript;
 const adsScriptRequest = page.waitForRequest((request) => new URL(request.url()).hostname === "pagead2.googlesyndication.com");
 await page.route("**/*", (route) => interceptProviderRequest(route, true));
 await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "domcontentloaded" });
	await adsScriptRequest;
	await page.evaluate(() => {
		const slot = document.createElement("div");
		slot.dataset.kirariAdSlot = "";
		slot.innerHTML = '<ins class="adsbygoogle" data-ad-client="ca-pub-1234567890123456" data-ad-slot="9876543210"></ins>';
		document.body.append(slot);
		document.dispatchEvent(new Event("astro:after-swap"));
		document.dispatchEvent(new Event("astro:after-swap"));
	});
	releaseAdsScript();
	try {
	await page.waitForFunction(({ scriptHosts, collectorUrls }) => {
  const resources = performance.getEntriesByType("resource");
  const scriptHostsSeen = new Set(resources.filter((entry) => entry.initiatorType === "script").map((entry) => new URL(entry.name).hostname));
  const fetchUrlsSeen = resources.filter((entry) => entry.initiatorType === "fetch").map((entry) => new URL(entry.name));
  return scriptHosts.every((host) => scriptHostsSeen.has(host)) && collectorUrls.every((expected) => {
   const target = new URL(expected);
   return fetchUrlsSeen.some((actual) => actual.origin === target.origin && actual.pathname.startsWith(target.pathname));
  });
	}, { scriptHosts: expectedScriptHosts, collectorUrls: expectedCollectors }, { timeout: WAIT_TIMEOUT });
	} catch (error) {
		const runtime = await page.evaluate(async () => ({
			scripts: [...document.scripts].map((script) => ({ src: script.src, type: script.type })),
			analyticsConfig: document.getElementById("kirari-analytics-config")?.dataset.config,
			adsConfig: document.getElementById("kirari-ads-config")?.dataset.config,
			resources: performance.getEntriesByType("resource").map((entry) => entry.name),
			bundles: await Promise.all([...document.scripts].filter((script) => script.src).map(async (script) => (await (await fetch(script.src)).text()).slice(0, 1200))),
		}));
		console.error(JSON.stringify({ seen, violations, unexpectedScripts, pageErrors, consoleMessages, runtime }));
		throw error;
	}
 await page.waitForFunction(() => document.querySelectorAll(".adsbygoogle[data-kirari-ad-initialized='true']").length === 2, { timeout: WAIT_TIMEOUT });
 await page.waitForFunction(() => window.__transitionReady && window.__amplitudeEvents?.length === 1, { timeout: WAIT_TIMEOUT });
 await page.evaluate(() => {
	 history.pushState({}, "", "/next");
	 document.title = "Next page";
	 const slot = document.createElement("div");
	 slot.dataset.kirariAdSlot = "";
	 slot.innerHTML = '<ins class="adsbygoogle" data-ad-client="ca-pub-1234567890123456" data-ad-slot="9876543210"></ins>';
	 document.body.append(slot);
	 document.dispatchEvent(new Event("astro:after-swap"));
 });
 await page.waitForFunction(() => window.__amplitudeEvents?.length === 2 && document.querySelectorAll(".adsbygoogle[data-kirari-ad-initialized='true']").length === 3, { timeout: WAIT_TIMEOUT });
 await page.evaluate(() => document.dispatchEvent(new Event("astro:after-swap")));
 await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
	 assert.equal(await page.evaluate(() => window.adsbygoogle?.length), 3, "concurrent Astro swaps must initialize each ad slot only once");
 await page.evaluate(() => {
	 history.pushState({}, "", "/second");
	 document.title = "Second page";
	 document.dispatchEvent(new Event("astro:after-swap"));
 });
 await page.waitForFunction(() => window.__amplitudeEvents?.length === 3, { timeout: WAIT_TIMEOUT });
 await page.evaluate(() => {
	 window.addEventListener("popstate", () => document.dispatchEvent(new Event("astro:after-swap")), { once: true });
	 history.back();
 });
 await page.waitForFunction(() => window.location.pathname === "/next" && window.__amplitudeEvents?.length === 4, { timeout: WAIT_TIMEOUT });
 await page.evaluate(() => {
	 window.addEventListener("popstate", () => document.dispatchEvent(new Event("astro:after-swap")), { once: true });
	 history.forward();
 });
 await page.waitForFunction(() => window.location.pathname === "/second" && window.__amplitudeEvents?.length === 5, { timeout: WAIT_TIMEOUT });
 const spaEvents = await page.evaluate(() => ({
	 ga4: window.dataLayer?.filter((event) => event[0] === "event" && event[1] === "page_view").length || 0,
	 matomo: window._paq?.filter((event) => event[0] === "trackPageView").length || 0,
	 amplitude: window.__amplitudeEvents?.length || 0,
 }));
	assert.deepEqual(spaEvents, { ga4: 5, matomo: 5, amplitude: 5 });
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
	const beforeAdsOptOut = seen.length;
	const adsOptedOutPage = await browser.newPage();
	adsOptedOutPage.setDefaultTimeout(WAIT_TIMEOUT);
	await adsOptedOutPage.route("**/*", (route) => interceptProviderRequest(route));
	await adsOptedOutPage.addInitScript(() => localStorage.setItem("kirari:privacy-settings:v1", JSON.stringify({ version: 1, analytics: true, ads: false })));
	await adsOptedOutPage.goto(`http://127.0.0.1:${server.address().port}/`);
	await adsOptedOutPage.waitForFunction(() => {
		const consent = window.clarity?.q?.find(([command]) => command === "consentv2")?.[1];
		return consent?.ad_Storage === "denied" && consent?.analytics_Storage === "granted" && document.querySelector("[data-kirari-ad-slot]")?.hidden === true;
	}, { timeout: WAIT_TIMEOUT });
	await adsOptedOutPage.waitForTimeout(300);
	assert.ok(seen.slice(beforeAdsOptOut).some((entry) => new URL(entry.url).hostname === "www.clarity.ms"), "Analytics remains enabled after the visitor turns Ads off");
	assert.ok(!seen.slice(beforeAdsOptOut).some((entry) => new URL(entry.url).hostname === "pagead2.googlesyndication.com"), "Ads opt-out prevents AdSense requests");
	await adsOptedOutPage.close();
 const beforeOptOut = seen.length;
 const optedOutPage = await browser.newPage();
 optedOutPage.setDefaultTimeout(WAIT_TIMEOUT);
 await optedOutPage.addInitScript(() => localStorage.setItem("kirari:privacy-settings:v1", JSON.stringify({ version: 1, analytics: false, ads: false })));
 await optedOutPage.goto(`http://127.0.0.1:${server.address().port}/`);
 await optedOutPage.waitForFunction(() => document.querySelector("[data-kirari-ad-slot]")?.hidden === true, { timeout: WAIT_TIMEOUT });
 await optedOutPage.waitForTimeout(300);
 assert.deepEqual(seen.slice(beforeOptOut), [], "visitor opt-out must prevent every third-party request");
 console.log(JSON.stringify({
  result: "PASS",
  spaPageViews: spaEvents,
  scriptRequests: seen.filter((entry) => entry.type === "script").length,
  uniqueScriptHosts: actualScriptHosts.size,
  controlledCollectors: actualCollectors.size,
  cspViolations: violations.length,
  providerRequestsIntercepted: beforeOptOut,
  adsOptOutRequests: seen.slice(beforeAdsOptOut, beforeOptOut).length,
  optOutRequests: seen.length - beforeOptOut,
 }));
} finally {
 await browser?.close();
 if (server) await new Promise((done) => server.close(done));
 rmSync(fixture, { recursive: true, force: true });
 if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
 else process.env.VERCEL_ENV = originalVercelEnv;
}
