import { ProductionValidationError, productionCanonicalMatchesRoute } from "../p4-production/production-validation.mjs";

export function assertIndexableHeaders(headers) {
	const value = headers["x-robots-tag"] ?? headers.get?.("x-robots-tag") ?? "";
	if (/(?:^|[\s,;])(?:noindex|none)(?=$|[\s,;])/i.test(value)) throw new ProductionValidationError("PRODUCTION_NOINDEX_RESPONSE_HEADER");
}

export async function assertCanonicalLink(page, route, expectedOrigin) {
	if (!route.title && !route.content_marker) return;
	const value = await page.locator('link[rel~="canonical"]').getAttribute("href");
	if (!value) throw new ProductionValidationError("PRODUCTION_BROWSER_CANONICAL_MISSING");
	let url;
	try { url = new URL(value); } catch { throw new ProductionValidationError("PRODUCTION_BROWSER_CANONICAL_INVALID"); }
	if (!productionCanonicalMatchesRoute(url, route.path, expectedOrigin)) throw new ProductionValidationError("PRODUCTION_BROWSER_CANONICAL_MISMATCH");
}
