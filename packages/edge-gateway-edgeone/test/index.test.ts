import assert from "node:assert/strict";
import { test } from "node:test";

import { createMakersGateway, type MakersGatewayOptions } from "../src/index.ts";

const base = "https://site.example/_kirari/edge";
type GatewayFetch = NonNullable<MakersGatewayOptions["fetch"]>;

function context(path: string, init?: RequestInit) {
	return { request: new Request(`${base}${path}`, init) };
}

function jsonResponse(value: unknown) {
	return new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
}

test("Makers delegates all approved operations to fixed anonymous upstreams", async () => {
	const cases = [
		["/github/repository/octo/demo", "https://api.github.com/repos/octo/demo"],
		["/github/contents/octo/demo/docs/README%20file.md?ref=main", "https://api.github.com/repos/octo/demo/contents/docs/README%20file.md?ref=main"],
		["/github/latest-commit/octo/demo?path=docs%2FREADME.md&sha=main", "https://api.github.com/repos/octo/demo/commits?path=docs%2FREADME.md&per_page=1&sha=main"],
		["/github/avatar/octo?size=96", "https://github.com/octo.png?size=96"],
		["/bangumi/user-collections/905494", "https://api.bgm.tv/v0/users/905494/collections?limit=24"],
	];
	for (const [path, expectedUrl] of cases) {
		let calls = 0;
		const onRequest = createMakersGateway({ fetch: async (input, init) => {
			calls += 1;
			assert.equal(String(input), expectedUrl);
			assert.equal(init?.redirect, "manual");
			assert.equal(new Headers(init?.headers).get("authorization"), null);
			return path.includes("/avatar/")
				? new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } })
				: jsonResponse({ owner: { login: "octo", avatar_url: "https://avatars.githubusercontent.com/u/1" } });
		} });
		const response = await onRequest(context(path));
		assert.equal(response.status, 200, path);
		assert.equal(calls, 1);
		assert.equal(response.headers.get("x-kirari-cache-level"), "CACHE_NONE");
		assert.equal(response.headers.get("cache-control"), "no-store");
		if (path.includes("/repository/")) {
			assert.equal((await response.json()).owner.avatar_url, `${base}/github/avatar/octo?size=96`);
		}
	}
});

test("health GET, HEAD, and OPTIONS are local Web responses", async () => {
	const onRequest = createMakersGateway({ fetch: async () => { throw new Error("must not fetch"); } });
	for (const [method, status, body] of [["GET", 200, "ok"], ["HEAD", 200, ""], ["OPTIONS", 204, ""]] as const) {
		const response = await onRequest(context("/healthz", { method }));
		assert.ok(response instanceof Response);
		assert.equal(response.status, status);
		assert.equal(await response.text(), body);
		assert.equal(response.headers.get("cache-control"), "no-store");
		assert.equal(response.headers.get("x-kirari-cache-level"), "CACHE_NONE");
	}
});

test("invalid methods, queries, paths and URL targets are rejected before fetch", async () => {
	let calls = 0;
	const onRequest = createMakersGateway({ fetch: async () => { calls += 1; return jsonResponse({}); } });
	const rejected: Array<[string, RequestInit | undefined, number]> = [
		["/github/repository/octo/demo", { method: "POST", body: "client-secret" }, 405],
		["/github/repository/octo/demo", { method: "DELETE" }, 405],
		["/github/repository/octo/demo?url=https%3A%2F%2Fevil.example", undefined, 400],
		["/github/contents/octo/demo/README.md?ref=main&ref=secret", undefined, 400],
		["/github/latest-commit/octo/demo?path=README.md&per_page=50", undefined, 400],
		["/github/latest-commit/octo/demo", undefined, 400],
		["/github/avatar/octo?size=257", undefined, 400],
		["/github/contents/octo/demo/%2F%2Fevil.example/private", undefined, 400],
		["/github/contents/octo/demo/%5C%5Cevil.example/private", undefined, 400],
		["/github/repository/octo/demo/extra", undefined, 404],
		["/bangumi/subject/123", undefined, 404],
		["/https://evil.example/private", undefined, 404],
	];
	for (const [path, init, status] of rejected) {
		const response = await onRequest(context(path, init));
		assert.equal(response.status, status, path);
		assert.equal(response.headers.get("cache-control"), "no-store");
	}
	const outsidePrefix = await onRequest({ request: new Request("https://site.example/api/github/repos/octo/demo") });
	assert.equal(outsidePrefix.status, 404);
	assert.equal(calls, 0);
});

test("client credentials and forwarding headers cannot alter upstream requests", async () => {
	const headers = {
		Authorization: "Bearer client-secret", Cookie: "session=client-secret",
		Forwarded: "host=evil.example;proto=http", "X-Forwarded-Host": "evil.example",
		"X-Forwarded-For": "127.0.0.1", "X-Forwarded-Proto": "http",
		"X-Real-IP": "127.0.0.1", "X-Kirari-Cache-Level": "CACHE_PERSISTENT",
		"X-GitHub-Token": "client-secret", "X-Client-Secret": "client-secret",
	};
	const onRequest = createMakersGateway({ fetch: async (input, init) => {
		assert.equal(String(input), "https://api.github.com/repos/octo/demo");
		const sent = new Headers(init?.headers);
		for (const header of Object.keys(headers)) assert.equal(sent.get(header), null, header);
		return jsonResponse({ ok: true });
	} });
	assert.equal((await onRequest(context("/github/repository/octo/demo", { headers }))).status, 200);
});

test("Makers never reads platform bindings or extra secret/cache configuration", async () => {
	let calls = 0;
	const options: MakersGatewayOptions = { fetch: async (_input, init) => {
		calls += 1;
		assert.equal(new Headers(init?.headers).get("authorization"), null);
		return jsonResponse({ calls });
	} };
	const requestContext = context("/github/repository/octo/demo");
	for (const target of [options, requestContext]) {
		for (const property of ["env", "cache", "caches", "KV", "token", "getGitHubToken", "githubTokenPublicRepositories", "cacheLevel", "edgeCache", "persistentCache", "routePrefix", "next", "waitUntil"]) {
			Object.defineProperty(target, property, { get() { throw new Error(`forbidden access: ${property}`); } });
		}
	}
	const onRequest = createMakersGateway(options);
	for (let i = 1; i <= 2; i += 1) {
		const response = await onRequest(requestContext);
		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), { calls: i });
		assert.equal(response.headers.get("x-kirari-cache-level"), "CACHE_NONE");
		assert.equal(response.headers.get("x-kirari-cache"), "BYPASS");
		assert.equal(response.headers.get("cache-control"), "no-store");
	}
	assert.equal(calls, 2);
});

test("integrated and standalone policies preserve exact origin checks", async () => {
	let calls = 0;
	const fetch: GatewayFetch = async () => { calls += 1; return jsonResponse({}); };
	const integrated = createMakersGateway({ fetch });
	assert.equal((await integrated(context("/github/repository/octo/demo", { headers: { Origin: "https://site.example" } }))).status, 200);
	assert.equal((await integrated(context("/github/repository/octo/demo", { headers: { Origin: "https://evil.example" } }))).status, 403);
	assert.throws(() => createMakersGateway({ mode: "standalone" }), /exact allowed origin/);
	for (const origin of ["*", "http://site.example", "https://site.example/path"]) {
		assert.throws(() => createMakersGateway({ mode: "standalone", allowedOrigins: [origin] }), /exact HTTPS origins/);
	}
	const standalone = createMakersGateway({ mode: "standalone", allowedOrigins: ["https://reader.example"], fetch });
	const allowed = await standalone(context("/github/repository/octo/demo", { headers: { Origin: "https://reader.example" } }));
	assert.equal(allowed.status, 200);
	assert.equal(allowed.headers.get("access-control-allow-origin"), "https://reader.example");
	for (const origin of ["https://reader.example.evil.example", "https://reader.example:444", "null", "https://site.example"]) {
		const blocked = await standalone(context("/github/repository/octo/demo", { headers: { Origin: origin } }));
		assert.equal(blocked.status, 403, origin);
		assert.equal(blocked.headers.get("access-control-allow-origin"), null);
	}
	const preflight = await standalone(context("/github/repository/octo/demo", { method: "OPTIONS", headers: { Origin: "https://reader.example", "Access-Control-Request-Method": "HEAD" } }));
	assert.equal(preflight.status, 204);
	assert.equal(preflight.headers.get("access-control-allow-methods"), "GET, HEAD, OPTIONS");
	assert.equal(preflight.headers.get("access-control-allow-headers"), "Accept");
	assert.equal((await standalone(context("/github/repository/octo/demo", { method: "OPTIONS", headers: { Origin: "https://reader.example", "Access-Control-Request-Method": "PUT" } }))).status, 405);
	assert.equal(calls, 2);
});

test("only the approved avatar redirect is followed, without client credentials", async () => {
	const urls: string[] = [];
	const onRequest = createMakersGateway({ fetch: async (input, init) => {
		urls.push(String(input));
		assert.equal(init?.redirect, "manual");
		assert.equal(new Headers(init?.headers).get("authorization"), null);
		assert.equal(new Headers(init?.headers).get("cookie"), null);
		return urls.length === 1
			? new Response(null, { status: 302, headers: { location: "https://avatars.githubusercontent.com/u/123?v=4" } })
			: new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } });
	} });
	const response = await onRequest(context("/github/avatar/octo", { headers: { Authorization: "Bearer client-secret", Cookie: "secret" } }));
	assert.deepEqual(urls, ["https://github.com/octo.png?size=96", "https://avatars.githubusercontent.com/u/123?v=4"]);
	assert.equal(response.status, 200);
	assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1, 2, 3]);
	for (const [path, location] of [["/github/avatar/octo", "https://evil.example/private"], ["/github/repository/octo/demo", "https://api.github.com/private"]]) {
		let calls = 0;
		const blocked = createMakersGateway({ fetch: async () => { calls += 1; return new Response(null, { status: 302, headers: { location } }); } });
		const rejected = await blocked(context(path));
		assert.equal(rejected.status, 502);
		assert.deepEqual(await rejected.json(), { error: "upstream_redirect_rejected" });
		assert.equal(calls, 1);
	}
});

test("JSON and image bounds and content validation survive the Makers boundary", async () => {
	const cases: Array<[string, () => Response]> = [
		["/github/repository/octo/demo", () => new Response("{}", { headers: { "content-type": "application/json", "content-length": "1000001" } })],
		["/github/contents/octo/demo/README.md", () => new Response(new Uint8Array(1_000_001), { headers: { "content-type": "application/json" } })],
		["/github/avatar/octo", () => new Response(new Uint8Array(512_001), { headers: { "content-type": "image/png" } })],
		["/bangumi/user-collections/905494", () => new Response("invalid JSON", { headers: { "content-type": "application/json" } })],
		["/github/avatar/octo", () => new Response("<script>secret</script>", { headers: { "content-type": "text/html" } })],
	];
	for (const [path, upstream] of cases) {
		const response = await createMakersGateway({ fetch: async () => upstream() })(context(path));
		assert.equal(response.status, 502, path);
		assert.deepEqual(await response.json(), { error: "upstream_invalid_response" });
	}
});

test("upstream failures expose safe errors and headers without secret bodies", async () => {
	for (const status of [403, 404, 500]) {
		const onRequest = createMakersGateway({ fetch: async () => new Response("Bearer upstream-secret", {
			status, headers: { "set-cookie": "session=upstream-secret", "x-internal-debug": "upstream-secret", "x-ratelimit-remaining": "0" },
		}) });
		const response = await onRequest(context("/github/repository/octo/demo"));
		assert.equal(response.status, status === 403 ? 429 : status === 404 ? 404 : 502);
		assert.doesNotMatch(await response.text(), /upstream-secret/);
		assert.equal(response.headers.get("set-cookie"), null);
		assert.equal(response.headers.get("x-internal-debug"), null);
		assert.equal(response.headers.get("x-upstream-ratelimit-remaining"), "0");
		assert.equal(response.headers.get("cache-control"), "no-store");
	}
	const unavailable = createMakersGateway({ fetch: async () => { throw new Error("Bearer platform-secret"); } });
	const response = await unavailable(context("/github/repository/octo/demo"));
	assert.equal(response.status, 502);
	assert.deepEqual(await response.json(), { error: "upstream_unavailable" });
});

test("upstream HEAD uses the same bounded operation but returns no body", async () => {
	const onRequest = createMakersGateway({ fetch: async () => jsonResponse({ ok: true }) });
	const response = await onRequest(context("/github/repository/octo/demo", { method: "HEAD" }));
	assert.equal(response.status, 200);
	assert.equal(await response.text(), "");
	assert.equal(response.headers.get("x-kirari-cache-level"), "CACHE_NONE");
});

test("a Makers Request without the undocumented signal property remains usable", async () => {
	const request = new Proxy(context("/github/repository/octo/demo").request, {
		get(target, property) { return property === "signal" ? undefined : Reflect.get(target, property, target); },
	});
	const onRequest = createMakersGateway({ fetch: async (_input, init) => {
		assert.ok(init?.signal instanceof AbortSignal);
		assert.equal(init.signal.aborted, false);
		return jsonResponse({ ok: true });
	} });
	const response = await onRequest({ request });
	assert.equal(response.status, 200);
	assert.deepEqual(await response.json(), { ok: true });
});

test("the upstream deadline completes even when provider fetch ignores abort", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	let started!: () => void;
	const fetchStarted = new Promise<void>((resolve) => { started = resolve; });
	const onRequest = createMakersGateway({ fetch: async () => {
		started();
		return new Promise<Response>(() => {});
	} });
	const pending = onRequest(context("/github/repository/octo/demo"));
	await fetchStarted;
	t.mock.timers.tick(8_000);
	const response = await pending;
	assert.equal(response.status, 504);
	assert.deepEqual(await response.json(), { error: "upstream_timeout" });
});

test("the upstream deadline covers a stalled body that ignores abort", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	let started!: () => void;
	const readingStarted = new Promise<void>((resolve) => { started = resolve; });
	let cancelled = false;
	const onRequest = createMakersGateway({ fetch: async () => new Response(new ReadableStream<Uint8Array>({
		pull() { started(); },
		cancel() { cancelled = true; },
	}), { headers: { "content-type": "application/json" } }) });
	const pending = onRequest(context("/github/repository/octo/demo"));
	await readingStarted;
	t.mock.timers.tick(8_000);
	const response = await pending;
	assert.equal(response.status, 504);
	assert.deepEqual(await response.json(), { error: "upstream_timeout" });
	assert.equal(cancelled, true);
});

test("a rejected upstream status cancels a stalled source without waiting for its body", { timeout: 1_000 }, async () => {
	let cancelled = false;
	const onRequest = createMakersGateway({ fetch: async () => new Response(new ReadableStream<Uint8Array>({
		pull() {},
		cancel() {
			cancelled = true;
			return new Promise<void>(() => {});
		},
	}), { status: 500, headers: { "content-type": "application/json", "x-internal-debug": "provider-secret" } }) });
	const response = await onRequest(context("/github/repository/octo/demo"));
	assert.equal(response.status, 502);
	assert.deepEqual(await response.json(), { error: "upstream_unavailable" });
	assert.equal(response.headers.get("x-internal-debug"), null);
	assert.equal(cancelled, true);
});

test("a response arriving after the upstream deadline has its body cancelled", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	let resolveFetch!: (response: Response) => void;
	let started!: () => void;
	const fetchStarted = new Promise<void>((resolve) => { started = resolve; });
	const onRequest = createMakersGateway({ fetch: async () => {
		started();
		return new Promise<Response>((resolve) => { resolveFetch = resolve; });
	} });
	const pending = onRequest(context("/github/repository/octo/demo"));
	await fetchStarted;
	t.mock.timers.tick(8_000);
	assert.equal((await pending).status, 504);
	let cancelled = false;
	resolveFetch(new Response(new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } }), {
		headers: { "content-type": "application/json" },
	}));
	for (let i = 0; i < 10 && !cancelled; i += 1) await Promise.resolve();
	assert.equal(cancelled, true);
});
