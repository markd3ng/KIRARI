import assert from "node:assert/strict";
import { test } from "node:test";
import { requestGithubOidcToken } from "../p3-browser/github-oidc.mjs";
import { createTrustedRequestHandler, headersForRequest, trustedOidcHeader } from "../p3-browser/request-routing.mjs";

const deploymentOrigin = "https://kirari-test-preview.vercel.app";
const oidcToken = "masked-test-oidc-token";

function makeRoute(url, responses, headers = {}) {
	const fetches = [];
	const route = {
		request: () => ({
			url: () => url,
			allHeaders: async () => ({ ...headers }),
			resourceType: () => "document",
			method: () => "GET",
			postDataBuffer: () => null,
		}),
		fetch: async (options) => {
			fetches.push(options);
			const response = responses.shift();
			assert.ok(response, "the handler should not fetch after a blocked redirect");
			return response;
		},
		fulfill: async (options) => { route.fulfilled = options; },
		abort: async (reason) => { route.aborted = reason; },
	};
	return { route, fetches };
}

function response(status, location) {
	return {
		status: () => status,
		headers: () => location ? { location } : {},
	};
}

test("OIDC token uses the runner endpoint unchanged and removes runner credentials from the environment", async () => {
	const requestUrl = "https://pipelines.actions.githubusercontent.com/runner/idtoken?api-version=2.0";
	const env = {
		ACTIONS_ID_TOKEN_REQUEST_URL: requestUrl,
		ACTIONS_ID_TOKEN_REQUEST_TOKEN: "runner-request-token",
	};
	let masked;
	const token = await requestGithubOidcToken({
		env,
		mask: (value) => { masked = value; },
		fetchImpl: async (url, options) => {
			assert.equal(url, requestUrl);
			assert.deepEqual(options.headers, { Authorization: "Bearer runner-request-token", Accept: "application/json" });
			assert.equal("ACTIONS_ID_TOKEN_REQUEST_URL" in env, false);
			assert.equal("ACTIONS_ID_TOKEN_REQUEST_TOKEN" in env, false);
			return { ok: true, json: async () => ({ value: oidcToken }) };
		},
	});
	assert.equal(token, oidcToken);
	assert.equal(masked, oidcToken);
	assert.deepEqual(env, {});
});

test("deployment requests receive OIDC only on the exact deployment origin", () => {
	const requestHeaders = { Accept: "text/html", [trustedOidcHeader]: "inherited-token" };
	const sameOrigin = headersForRequest(`${deploymentOrigin}/page`, requestHeaders, deploymentOrigin, oidcToken);
	assert.equal(sameOrigin[trustedOidcHeader], oidcToken);
	const external = headersForRequest("https://api.iconify.design/icon", requestHeaders, deploymentOrigin, oidcToken);
	assert.equal(Object.keys(external).some((name) => name.toLowerCase() === trustedOidcHeader), false);
	assert.equal(headersForRequest("https://kirari-test-preview.vercel.app.evil.example/", {}, deploymentOrigin, oidcToken)[trustedOidcHeader], undefined);
});

test("deployment redirect to an allowed external origin drops OIDC and browser credentials", async () => {
	const expected = [];
	const unexpected = [];
	const { route, fetches } = makeRoute(`${deploymentOrigin}/icon`, [
		response(302, "https://api.iconify.design/example"),
		response(200),
	], { Accept: "image/*", Authorization: "Bearer browser-auth", Cookie: "deployment=session" });
	await createTrustedRequestHandler({
		deploymentOrigin,
		oidcToken,
		onExpectedExternal: (request) => expected.push(request),
		onUnexpectedExternal: (request) => unexpected.push(request),
	})(route);
	assert.equal(fetches.length, 2);
	assert.equal(fetches[0].headers[trustedOidcHeader], oidcToken);
	assert.equal(fetches[0].maxRedirects, 0);
	assert.equal(fetches[0].timeout, 10_000);
	assert.equal(fetches[1].url, "https://api.iconify.design/example");
	assert.equal(Object.keys(fetches[1].headers).some((name) => name.toLowerCase() === trustedOidcHeader), false);
	assert.equal("authorization" in fetches[1].headers, false);
	assert.equal("cookie" in fetches[1].headers, false);
	assert.equal(expected.length, 1);
	assert.equal(unexpected.length, 0);
	assert.equal(route.fulfilled.response.status(), 200);
});

test("same-origin redirects are manually followed and remain scoped to the deployment origin", async () => {
	const { route, fetches } = makeRoute(`${deploymentOrigin}/old`, [response(307, "/new"), response(200)]);
	await createTrustedRequestHandler({ deploymentOrigin, oidcToken })(route);
	assert.equal(fetches.length, 2);
	assert.equal(fetches[1].url, `${deploymentOrigin}/new`);
	assert.equal(fetches[1].headers[trustedOidcHeader], oidcToken);
	assert.equal(fetches[1].maxRedirects, 0);
});

test("unexpected external redirects are blocked before the next request", async () => {
	const unexpected = [];
	const { route, fetches } = makeRoute(`${deploymentOrigin}/redirect`, [response(302, "https://attacker.example/collect")]);
	await createTrustedRequestHandler({ deploymentOrigin, oidcToken, onUnexpectedExternal: (request) => unexpected.push(request) })(route);
	assert.equal(fetches.length, 1);
	assert.equal(route.aborted, "blockedbyclient");
	assert.equal(unexpected[0].url, "https://attacker.example/collect");
});

test("request failures become sanitized browser failures and cannot expose the OIDC token", async () => {
	const { route } = makeRoute(`${deploymentOrigin}/page`, []);
	route.fetch = async () => { throw new Error(`failed request header: ${oidcToken}`); };
	const failures = [];
	await createTrustedRequestHandler({ deploymentOrigin, oidcToken, onRequestFailure: (request) => failures.push(request) })(route);
	assert.equal(route.aborted, "failed");
	assert.equal(failures[0].url, `${deploymentOrigin}/page`);
	assert.equal(JSON.stringify(failures).includes(oidcToken), false);
});
