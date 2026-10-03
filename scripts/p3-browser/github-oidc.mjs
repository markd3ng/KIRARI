const requestUrlVariable = "ACTIONS_ID_TOKEN_REQUEST_URL";
const requestTokenVariable = "ACTIONS_ID_TOKEN_REQUEST_TOKEN";

export async function requestGithubOidcToken({ env = process.env, fetchImpl = fetch, mask } = {}) {
	const requestUrlValue = env[requestUrlVariable];
	const requestToken = env[requestTokenVariable];
	delete env[requestUrlVariable];
	delete env[requestTokenVariable];
	if (!requestUrlValue || !requestToken) throw new Error("GitHub Actions OIDC token request is unavailable");

	let requestUrl;
	try {
		requestUrl = new URL(requestUrlValue);
	} catch {
		throw new Error("GitHub Actions OIDC token request URL is invalid");
	}
	if (requestUrl.protocol !== "https:" || !requestUrl.hostname.endsWith(".actions.githubusercontent.com") || requestUrl.username || requestUrl.password) {
		throw new Error("GitHub Actions OIDC token request URL is not a trusted HTTPS endpoint");
	}

	let response;
	try {
		// Use the runner-provided URL unchanged so GitHub applies its default audience.
		response = await fetchImpl(requestUrlValue, {
			headers: { Authorization: `Bearer ${requestToken}`, Accept: "application/json" },
		});
	} catch {
		throw new Error("GitHub Actions OIDC token request failed");
	}
	if (!response.ok) throw new Error(`GitHub Actions OIDC token request failed with HTTP ${response.status}`);

	let payload;
	try {
		payload = await response.json();
	} catch {
		throw new Error("GitHub Actions OIDC token response was invalid");
	}
	if (typeof payload.value !== "string" || !payload.value) throw new Error("GitHub Actions OIDC token response was missing a token");

	if (mask) mask(payload.value);
	else if (env.GITHUB_ACTIONS === "true") process.stdout.write(`::add-mask::${payload.value}\n`);
	return payload.value;
}
