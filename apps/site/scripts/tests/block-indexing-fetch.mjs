const originalFetch = globalThis.fetch;
const blockedHosts = ["api.indexnow.org", "oauth2.googleapis.com", "indexing.googleapis.com"];

globalThis.fetch = async (input, init) => {
	const url = input instanceof Request ? input.url : String(input);
	if (blockedHosts.some((host) => new URL(url).hostname === host)) {
		throw new Error(`Test blocked indexing request: ${url}`);
	}
	return originalFetch(input, init);
};
