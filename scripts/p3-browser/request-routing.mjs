export const expectedExternalOrigins = new Set([
	"https://api.iconify.design",
	"https://api.unisvg.com",
	"https://api.simplesvg.com",
]);

const redirectStatuses = new Set([301, 302, 303, 307, 308]);
const maxRedirects = 20;

function fetchFailureCode(error) {
	const message = String(error?.message ?? "");
	if (error?.code === "FIXTURE_ICON_REQUEST_REJECTED") return error.code;
	return /net::(ERR_[A-Z_]+)/.exec(message)?.[1]
		?? (error?.name === "TimeoutError" ? "FETCH_TIMEOUT" : /closed|disposed/i.test(message) ? "FETCH_CONTEXT_CLOSED" : "FETCH_FAILED");
}

export function headersForRequest(url, requestHeaders, deploymentOrigin) {
	const headers = { ...requestHeaders };
	for (const name of Object.keys(headers)) {
		if (["x-vercel-trusted-oidc-idp-token", "x-vercel-protection-bypass", "host", "content-length", "connection", "transfer-encoding"].includes(name.toLowerCase())) delete headers[name];
	}
	const origin = new URL(url).origin;
	if (origin !== deploymentOrigin) {
		for (const name of Object.keys(headers)) {
			if (["authorization", "cookie", "proxy-authorization"].includes(name.toLowerCase())) delete headers[name];
		}
	}
	return headers;
}

export function createRequestHandler({ deploymentOrigin, fixtureIconResolver, onExpectedExternal, onUnexpectedExternal, onRequestFailure }) {
	const activeRequests = new Set();
	const handleRequest = async (route) => {
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
					await route.abort("blockedbyclient").catch(() => {});
					return;
				}
				if (fixtureIconResolver) {
					const icons = fixtureIconResolver(requestUrl.href, method);
					await route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(icons) });
					return;
				}
			}

			const headers = headersForRequest(requestUrl.href, originalHeaders, deploymentOrigin);
			const fetchOptions = { url: requestUrl.href, headers, maxRedirects: 0, method, timeout: 10_000 };
			if (postData) fetchOptions.postData = postData;
			let response;
			try {
				response = await route.fetch(fetchOptions);
			} catch (error) {
				onRequestFailure?.({ url: requestUrl.href, resourceType, errorCode: fetchFailureCode(error) });
				await route.abort("failed").catch(() => {});
				return;
			}
			const location = response.headers().location;
			if (!redirectStatuses.has(response.status()) || !location) {
				await route.fulfill({ response }).catch(() => {});
				return;
			}

			if (redirects === maxRedirects) {
				onRequestFailure?.({ url: requestUrl.href, resourceType });
				await route.abort("failed").catch(() => {});
				return;
			}
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
	const handler = async (route) => {
		const requestTask = handleRequest(route);
		activeRequests.add(requestTask);
		try {
			await requestTask;
		} catch (error) {
			const request = route.request();
			onRequestFailure?.({ url: request.url(), resourceType: request.resourceType(), errorCode: fetchFailureCode(error) });
			await route.abort("failed").catch(() => {});
		} finally {
			activeRequests.delete(requestTask);
		}
	};
	handler.waitForIdle = async () => {
		while (activeRequests.size) await Promise.allSettled([...activeRequests]);
	};
	return handler;
}
