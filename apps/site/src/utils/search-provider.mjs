export function resolveSearchProvider(config = {}) {
	const search = config.search || config;
	const provider = search?.provider;
	const docsearch = search?.docsearch || {};
	const google = search?.google || {};

	const docsearchReady =
		!!docsearch.enable &&
		!!docsearch.appId &&
		!!docsearch.apiKey &&
		!!docsearch.indexName;
	const googleReady = !!google.cx;

	if (provider === "docsearch") return docsearchReady ? "docsearch" : "pagefind";
	if (provider === "google") return googleReady ? "google" : "pagefind";
	return docsearchReady ? "docsearch" : "pagefind";
}
