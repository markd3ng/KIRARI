const BASELINE_ICONIFY_HOSTS = new Set([
	"api.iconify.design",
	"api.simplesvg.com",
	"api.unisvg.com",
]);

export function isExpectedBaselineIconifyBlock(event) {
	if (event?.directive !== "connect-src" || typeof event.uri !== "string") return false;
	try {
		const blocked = new URL(event.uri);
		return blocked.protocol === "https:" && BASELINE_ICONIFY_HOSTS.has(blocked.hostname);
	} catch {
		// CSP blockedURI can be tokens such as "inline" or "eval", not a URL.
		return false;
	}
}

export function findUnexpectedCspViolations(violations) {
	return violations.filter((event) => !isExpectedBaselineIconifyBlock(event));
}
