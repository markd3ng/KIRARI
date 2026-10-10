import { assertCanonicalLink, assertIndexableHeaders } from "./production-browser-helpers.mjs";

function requireNoindex(response, path) {
	const value = response.headers()["x-robots-tag"] ?? "";
	if (!/noindex/i.test(value)) throw new Error(`Preview route ${path} is missing noindex protection (x-robots-tag=${JSON.stringify(value)})`);
	return value;
}

export async function validateBrowserPages({ page, context, origin, contract, mode, productionPolicy, loadedAssets }) {
	const production = mode === "production";
	const rootResponse = await page.goto(new URL("/", origin).href, { waitUntil: "domcontentloaded" });
	if (rootResponse?.status() !== 200) throw new Error(`Root route returned HTTP ${rootResponse?.status() ?? "no response"}`);
	const rootRobots = production ? (assertIndexableHeaders(rootResponse.headers()), "indexable") : requireNoindex(rootResponse, "/");
	await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
	const routeResults = [];
	for (const route of contract.routes) {
		const response = await page.goto(new URL(route.path, origin).href, { waitUntil: "domcontentloaded" });
		if (response?.status() !== 200) throw new Error(`Route ${route.path} returned HTTP ${response?.status() ?? "no response"}`);
		const routeRobots = production ? (assertIndexableHeaders(response.headers()), "indexable") : requireNoindex(response, route.path);
		if (production) await assertCanonicalLink(page, route, productionPolicy.canonicalOrigin);
		const title = await page.title();
		const bodyText = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
		if (route.title && title !== route.title) throw new Error(`Route ${route.path} title mismatch: ${JSON.stringify(title)}`);
		if (route.content_marker && !bodyText.replace(/\s+/g, "").includes(route.content_marker.replace(/\s+/g, ""))) throw new Error(`Route ${route.path} is missing content marker ${JSON.stringify(route.content_marker)}`);
		await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
		if (contract.assets?.images?.length) {
			await page.locator("img").first().scrollIntoViewIfNeeded().catch(() => {});
			await page.waitForTimeout(200);
		}
		routeResults.push({ path: route.path, status: response.status(), noindex: routeRobots, title, contentMarker: route.content_marker });
	}
	if (contract.navigation) {
		await page.goto(new URL(contract.routes[0].path, origin).href, { waitUntil: "domcontentloaded" });
		const targetUrl = new URL(contract.navigation, `${origin}/`);
		const anchorIndex = await page.locator("a[href]").evaluateAll((anchors, target) => anchors.findIndex((anchor) => {
			try { return new URL(anchor.href).href === target; } catch { return false; }
		}), targetUrl.href);
		if (anchorIndex < 0) throw new Error(`Browser contract navigation link is missing: ${targetUrl.pathname}`);
		await page.locator("a[href]").nth(anchorIndex).click();
		await page.waitForURL((url) => url.href === targetUrl.href, { timeout: 10000 });
	}
	const missingUrl = new URL("/__kirari_p3_not_found__", origin);
	const missingPage = await context.newPage();
	const missingResponse = await missingPage.goto(missingUrl.href, { waitUntil: "domcontentloaded" });
	if (missingResponse?.status() !== 404) throw new Error(`Unknown route returned HTTP ${missingResponse?.status() ?? "no response"}, expected 404`);
	await missingPage.close();
	const requiredAssets = [];
	for (const path of contract.assets.stylesheets ?? []) requiredAssets.push(`stylesheet:${path}`);
	for (const path of contract.assets.scripts ?? []) requiredAssets.push(`script:${path}`);
	const absentAssets = requiredAssets.filter((asset) => !loadedAssets.has(asset));
	if ((contract.assets.images ?? []).length && ![...loadedAssets].some((asset) => asset.startsWith("image:"))) absentAssets.push("image:* (no successful image request)");
	if (absentAssets.length) throw new Error(`Expected browser assets did not load: ${absentAssets.join(", ")}`);
	return { rootRobots, routeResults, requiredAssets };
}
