export const trustedOidcHeader = "x-vercel-trusted-oidc-idp-token";
export const expectedExternalOrigins = new Set([
	"https://api.iconify.design",
	"https://api.unisvg.com",
	"https://api.simplesvg.com",
]);

const redirectStatuses = new Set([301, 302, 303, 307, 308]);
const maxRedirects = 20;

export function headersForRequest(url, requestHeaders, deploymentOrigin, oidcToken) {
	const headers = { ...requestHeaders };
	for (const name of Object.keys(headers)) {
		if ([trustedOidcHeader, "host", "content-length", "connection", "transfer-encoding"].includes(name.toLowerCase())) delete headers[name];
	}
	const origin = new URL(url).origin;
	if (origin !== deploymentOrigin) {
		for (const name of Object.keys(headers)) {
			if (["authorization", "cookie", "proxy-authorization"].includes(name.toLowerCase())) delete headers[name];
		}
	}
	if (oidcToken && origin === deploymentOrigin) headers[trustedOidcHeader] = oidcToken;
	return headers;
}

export function createTrustedRequestHandler({ deploymentOrigin, oidcToken, onExpectedExternal, onUnexpectedExternal }) {
	return async (route) => {
		const request = route.request();
		const originalHeaders = await request.allHeaders();
		const resourceType = request.resourceType();
		let requestUrl = new URL(request.url());
		let method = request.method();
		let postData = request.postDataBuffer();

		for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
			const isDeploymentOrigin = requestUrl.origin === deploymentOrigin;
			if (!isDeploymentOrigin) {
				const observedRequest = { url: requestUrl.href, resourceType };
				if (expectedExternalOrigins.has(requestUrl.origin)) onExpectedExternal?.(observedRequest);
				else {
					onUnexpectedExternal?.(observedRequest);
					await route.abort("blockedbyclient");
					return;
				}
			}

			const headers = headersForRequest(requestUrl.href, originalHeaders, deploymentOrigin, oidcToken);
			const fetchOptions = { url: requestUrl.href, headers, maxRedirects: 0, method };
			if (postData) fetchOptions.postData = postData;
			let response;
			try {
				response = await route.fetch(fetchOptions);
			} catch {
				throw new Error("Browser request failed while validating the deployment");
			}
			const location = response.headers().location;
			if (!redirectStatuses.has(response.status()) || !location) {
				await route.fulfill({ response });
				return;
			}

			if (redirects === maxRedirects) throw new Error("Browser request exceeded the redirect limit");
			requestUrl = new URL(location, requestUrl);
			if ((response.status() === 303 && method !== "HEAD") || ([301, 302].includes(response.status()) && method === "POST")) {
				method = "GET";
				postData = null;
				for (const name of Object.keys(originalHeaders)) {
					if (["content-type", "content-encoding", "content-language", "content-location"].includes(name.toLowerCase())) delete originalHeaders[name];
				}
			}
		}
	};
}
