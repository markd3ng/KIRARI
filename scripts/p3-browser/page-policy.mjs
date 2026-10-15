import { StaticSiteValidationError, canonicalMatchesRoute } from "../static-site-validation.mjs";

export function assertIndexableHeaders(headers) {
	const value = headers["x-robots-tag"] ?? headers.get?.("x-robots-tag") ?? "";
	if (/(?:^|[\s,;])(?:noindex|none)(?=$|[\s,;])/i.test(value)) throw new StaticSiteValidationError("SITE_NOINDEX_RESPONSE_HEADER");
}

export async function assertCanonicalLink(page, route, expectedOrigin) {
	if (!route.title && !route.content_marker) return;
	const value = await page.locator('link[rel~="canonical"]').getAttribute("href");
	if (!value) throw new StaticSiteValidationError("SITE_BROWSER_CANONICAL_MISSING");
	let url;
	try { url = new URL(value); } catch { throw new StaticSiteValidationError("SITE_BROWSER_CANONICAL_INVALID"); }
	if (!canonicalMatchesRoute(url, route.path, expectedOrigin)) throw new StaticSiteValidationError("SITE_BROWSER_CANONICAL_MISMATCH");
}
