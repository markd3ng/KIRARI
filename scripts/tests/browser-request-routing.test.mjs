import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequestHandler, headersForRequest } from "../p3-browser/request-routing.mjs";
import { createFixtureIconResolver } from "../p3-browser/fixture-icons.mjs";

const deploymentOrigin = "https://kirari-test-preview.vercel.app";
const bypassHeader = "x-vercel-protection-bypass";

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

test("inherited provider bypass headers are removed on every origin", () => {
	const requestHeaders = { Accept: "text/html", [bypassHeader]: "inherited-token" };
	const sameOrigin = headersForRequest(`${deploymentOrigin}/page`, requestHeaders, deploymentOrigin);
	assert.equal(sameOrigin[bypassHeader], undefined);
	const external = headersForRequest("https://api.iconify.design/icon", requestHeaders, deploymentOrigin);
	assert.equal(Object.keys(external).some((name) => name.toLowerCase() === bypassHeader), false);
	assert.equal(headersForRequest("https://kirari-test-preview.vercel.app.evil.example/", {}, deploymentOrigin)[bypassHeader], undefined);
});

test("redirect to an allowed external origin strips browser credentials", async () => {
	const expected = [];
	const unexpected = [];
	const { route, fetches } = makeRoute(`${deploymentOrigin}/icon`, [
		response(302, "https://api.iconify.design/example"),
		response(200),
	], { Accept: "image/*", Authorization: "Bearer browser-auth", Cookie: "deployment=session" });
	await createRequestHandler({
		deploymentOrigin,
		onExpectedExternal: (request) => expected.push(request),
		onUnexpectedExternal: (request) => unexpected.push(request),
	})(route);
	assert.equal(fetches.length, 2);
	assert.equal(fetches[0].headers[bypassHeader], undefined);
	assert.equal(fetches[0].maxRedirects, 0);
	assert.equal(fetches[0].timeout, 10_000);
	assert.equal(fetches[1].url, "https://api.iconify.design/example");
	assert.equal(Object.keys(fetches[1].headers).some((name) => name.toLowerCase() === bypassHeader), false);
	assert.equal("authorization" in fetches[1].headers, false);
	assert.equal("cookie" in fetches[1].headers, false);
	assert.equal(expected.length, 1);
	assert.equal(unexpected.length, 0);
	assert.equal(route.fulfilled.response.status(), 200);
});

test("same-origin redirects are manually followed and remain scoped to the deployment origin", async () => {
	const { route, fetches } = makeRoute(`${deploymentOrigin}/old`, [response(307, "/new"), response(200)]);
	await createRequestHandler({ deploymentOrigin })(route);
	assert.equal(fetches.length, 2);
	assert.equal(fetches[1].url, `${deploymentOrigin}/new`);
	assert.equal(fetches[1].headers[bypassHeader], undefined);
	assert.equal(fetches[1].maxRedirects, 0);
});

test("unexpected external redirects are blocked before the next request", async () => {
	const unexpected = [];
	const { route, fetches } = makeRoute(`${deploymentOrigin}/redirect`, [response(302, "https://attacker.example/collect")]);
	await createRequestHandler({ deploymentOrigin, onUnexpectedExternal: (request) => unexpected.push(request) })(route);
	assert.equal(fetches.length, 1);
	assert.equal(route.aborted, "blockedbyclient");
	assert.equal(unexpected[0].url, "https://attacker.example/collect");
});

test("request failures become sanitized browser failures without exposing credentials", async () => {
	const { route } = makeRoute(`${deploymentOrigin}/page`, []);
	route.fetch = async () => { throw new Error("failed request header: masked-test-credential"); };
	const failures = [];
	await createRequestHandler({ deploymentOrigin, onRequestFailure: (request) => failures.push(request) })(route);
	assert.equal(route.aborted, "failed");
	assert.equal(failures[0].url, `${deploymentOrigin}/page`);
	assert.equal(JSON.stringify(failures).includes("masked-test-credential"), false);
});

test("local fixture icon resolution uses installed data and records package fingerprints", async () => {
	const fixtureIconResolver = createFixtureIconResolver();
	const { route, fetches } = makeRoute("https://api.iconify.design/fa6-brands.json?icons=github,behance-square", []);
	await createRequestHandler({ deploymentOrigin, fixtureIconResolver })(route);
	assert.equal(fetches.length, 0);
	const data = JSON.parse(route.fulfilled.body);
	assert.equal(data.prefix, "fa6-brands");
	assert.ok(data.icons.github.body.startsWith("<path"));
	assert.ok(data.aliases["behance-square"]);
	const provenance = fixtureIconResolver.provenance();
	assert.equal(provenance.requests, 1);
	assert.equal(provenance.resolvedIcons, 2);
	assert.equal(provenance.sets[0].package, "@iconify-json/fa6-brands");
	assert.match(provenance.sets[0].version, /^\d+\.\d+\.\d+$/);
	assert.match(provenance.sets[0].sha256, /^[a-f0-9]{64}$/);
});

test("fixture icon resolution rejects missing icons and unknown host, path, query or method", async () => {
	const valid = "https://api.iconify.design/material-symbols.json?icons=home-rounded";
	const invalid = [
		valid.replace("home-rounded", "missing-fixture-icon"),
		valid.replace("material-symbols", "unknown-set"),
		valid.replace("api.iconify.design", "api.iconify.design.evil.example"),
		valid.replace("material-symbols.json", "icons/material-symbols.json"),
		`${valid}&other=1`,
		`${valid}&icons=home-rounded`,
		valid.replace("home-rounded", "home-rounded,home-rounded"),
	];
	for (const url of invalid) {
		assert.throws(() => createFixtureIconResolver()(url), (error) => error.code === "FIXTURE_ICON_REQUEST_REJECTED");
	}
	assert.throws(() => createFixtureIconResolver()(valid, "POST"), (error) => error.code === "FIXTURE_ICON_REQUEST_REJECTED");
	const failures = [];
	const { route, fetches } = makeRoute(invalid[0], []);
	await createRequestHandler({ deploymentOrigin, fixtureIconResolver: createFixtureIconResolver(), onRequestFailure: (failure) => failures.push(failure) })(route);
	assert.equal(fetches.length, 0);
	assert.equal(route.aborted, "failed");
	assert.equal(failures[0].errorCode, "FIXTURE_ICON_REQUEST_REJECTED");
});

test("ordinary live routing still fetches external data and reports real transport failures", async () => {
	const { route, fetches } = makeRoute("https://api.iconify.design/fa6-brands.json?icons=github", [response(200)]);
	await createRequestHandler({ deploymentOrigin })(route);
	assert.equal(fetches.length, 1);
	const failed = makeRoute("https://api.unisvg.com/fa6-brands.json?icons=github", []);
	failed.route.fetch = async () => { const error = new Error("safe timeout"); error.name = "TimeoutError"; throw error; };
	const failures = [];
	await createRequestHandler({ deploymentOrigin, onRequestFailure: (failure) => failures.push(failure) })(failed.route);
	assert.equal(failed.route.aborted, "failed");
	assert.equal(failures[0].errorCode, "FETCH_TIMEOUT");
});
