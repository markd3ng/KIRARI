import assert from "node:assert/strict";
import { test } from "node:test";

import {
	DEFAULT_ROUTE_PREFIX,
	createGatewayHandler,
	type CacheEntry,
	type EdgeCache,
	type PersistentCache,
} from "../src/index.ts";

const base = `https://site.example${DEFAULT_ROUTE_PREFIX}`;

function makeRequest(path: string, init?: RequestInit) {
	return new Request(`${base}${path}`, init);
}

function jsonResponse(value: unknown, init: ResponseInit = {}) {
	return new Response(JSON.stringify(value), {
		...init,
		headers: { "content-type": "application/json; charset=utf-8", ...Object.fromEntries(new Headers(init.headers)) },
	});
}

function createMemoryCache(seed?: CacheEntry): EdgeCache & { entries: Map<string, CacheEntry> } {
	const entries = new Map<string, CacheEntry>();
	if (seed) entries.set(
		`kirari-edge:v1:${encodeURIComponent(JSON.stringify({
			kind: "github.repository",
			owner: "octo",
			repo: "demo",
			requestOrigin: new URL(base).origin,
			routePrefix: DEFAULT_ROUTE_PREFIX,
		}))}`,
		seed,
	);
	return {
		consistency: "edge-local",
		entries,
		async get(key) {
			return entries.get(key) ?? null;
		},
		async put(key, entry) {
			entries.set(key, entry);
		},
	};
}

test("health is local and does not fetch upstream", async () => {
	let fetchCalls = 0;
	const handler = createGatewayHandler({ fetch: async () => {
		fetchCalls += 1;
		return new Response("unexpected");
	} });
	const response = await handler(makeRequest("/healthz"));
	assert.equal(response.status, 200);
	assert.equal(await response.text(), "ok");
	assert.equal(response.headers.get("cache-control"), "no-store");
	assert.equal(fetchCalls, 0);
});

test("forwards a normal repository operation to the fixed GitHub API and rewrites its avatar route", async () => {
	let fetchedUrl = "";
	let sentAuthorization: string | null = null;
	let forwardedCookie: string | null = null;
	let forwardedClientHeader: string | null = null;
	const handler = createGatewayHandler({
		fetch: async (input, init) => {
			fetchedUrl = String(input);
			const headers = new Headers(init?.headers);
			sentAuthorization = headers.get("authorization");
			forwardedCookie = headers.get("cookie");
			forwardedClientHeader = headers.get("x-client-secret");
			return jsonResponse({ owner: { login: "octo", avatar_url: "https://avatars.githubusercontent.com/u/1" } });
		},
		getGitHubToken: () => "worker-token",
		githubTokenPublicRepositories: ["octo/demo"],
	});
	const response = await handler(makeRequest("/github/repository/octo/demo", {
		headers: { Authorization: "Bearer browser-token", Cookie: "session=secret", "X-Client-Secret": "client-secret" },
	}));
	const payload = await response.json();
	assert.equal(fetchedUrl, "https://api.github.com/repos/octo/demo");
	assert.equal(sentAuthorization, "Bearer worker-token");
	assert.equal(forwardedCookie, null);
	assert.equal(forwardedClientHeader, null);
	assert.equal(payload.owner.avatar_url, `${base}/github/avatar/octo?size=96`);
	assert.equal(response.headers.get("x-kirari-cache-level"), "CACHE_NONE");
	assert.equal(response.headers.get("cache-control"), "no-store");
	assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});

test("only exact public-repository allowlist entries receive the GitHub token", async () => {
	const authorizations: Array<string | null> = [];
	const handler = createGatewayHandler({
		fetch: async (_input, init) => {
			authorizations.push(new Headers(init?.headers).get("authorization"));
			return jsonResponse({ ok: true });
		},
		getGitHubToken: () => "private-worker-secret",
		githubTokenPublicRepositories: ["Octo/Public"],
	});
	await handler(makeRequest("/github/repository/octo/public"));
	await handler(makeRequest("/github/repository/octo/other"));
	assert.deepEqual(authorizations, ["Bearer private-worker-secret", null]);
});

test("refuses to construct an authenticated handler without an explicit repository allowlist", () => {
	assert.throws(
		() => createGatewayHandler({ getGitHubToken: () => "worker-token" }),
		/public repository allowlist/,
	);
});

test("contents operation encodes path segments and allows only the ref query", async () => {
	let fetchedUrl = "";
	const handler = createGatewayHandler({
		fetch: async (input) => {
			fetchedUrl = String(input);
			return jsonResponse({ name: "README.md" });
		},
	});
	const response = await handler(makeRequest("/github/contents/octo/demo/docs/README%20file.md?ref=main"));
	assert.equal(response.status, 200);
	assert.equal(
		fetchedUrl,
		"https://api.github.com/repos/octo/demo/contents/docs/README%20file.md?ref=main",
	);
});

test("latest-commit operation forces per_page=1 and rejects unapproved queries", async () => {
	let fetchedUrl = "";
	let fetchCalls = 0;
	const handler = createGatewayHandler({
		fetch: async (input) => {
			fetchCalls += 1;
			fetchedUrl = String(input);
			return jsonResponse([]);
		},
	});
	const response = await handler(makeRequest("/github/latest-commit/octo/demo?path=docs%2FREADME.md&sha=main"));
	assert.equal(response.status, 200);
	assert.equal(
		fetchedUrl,
		"https://api.github.com/repos/octo/demo/commits?path=docs%2FREADME.md&per_page=1&sha=main",
	);
	const invalid = await handler(makeRequest("/github/latest-commit/octo/demo?path=README.md&per_page=50"));
	assert.equal(invalid.status, 400);
	assert.equal(fetchCalls, 1);
});

test("Bangumi operation matches the active user-collections request only", async () => {
	let fetchedUrl = "";
	let authorization: string | null = null;
	const handler = createGatewayHandler({
		fetch: async (input, init) => {
			fetchedUrl = String(input);
			authorization = new Headers(init?.headers).get("authorization");
			return jsonResponse({ data: [] });
		},
		getGitHubToken: () => "worker-token",
		githubTokenPublicRepositories: ["octo/demo"],
	});
	const response = await handler(makeRequest("/bangumi/user-collections/905494"));
	assert.equal(response.status, 200);
	assert.equal(fetchedUrl, "https://api.bgm.tv/v0/users/905494/collections?limit=24");
	assert.equal(authorization, null);
	const unsupported = await handler(makeRequest("/bangumi/subject/123"));
	assert.equal(unsupported.status, 404);
});

test("rejects arbitrary upstream URLs, unknown queries, duplicate queries, and encoded separators before fetch", async () => {
	let fetchCalls = 0;
	const handler = createGatewayHandler({
		fetch: async () => {
			fetchCalls += 1;
			return jsonResponse({ ok: true });
		},
	});
	const attacks = [
		"/github/repository/octo/demo?url=https%3A%2F%2Fevil.example",
		"/github/latest-commit/octo/demo?path=README.md&path=private.txt",
		"/github/contents/octo/demo/%2F%2Fevil.example/private",
		"/github/repository/octo/demo/extra",
		"/github/contents/octo/demo/../private",
	];
	for (const path of attacks) {
		const response = await handler(makeRequest(path));
		assert.ok(response.status === 400 || response.status === 404, `${path} returned ${response.status}`);
	}
	assert.equal(fetchCalls, 0);
});

test("URL dot-segment normalization stays inside the named GitHub contents operation", async () => {
	const request = makeRequest("/github/contents/octo/demo/docs/%2e%2e/private");
	assert.equal(new URL(request.url).pathname, `${DEFAULT_ROUTE_PREFIX}/github/contents/octo/demo/private`);
	let fetchedUrl = "";
	const handler = createGatewayHandler({
		fetch: async (input) => {
			fetchedUrl = String(input);
			return jsonResponse({ path: "private" });
		},
	});
	const response = await handler(request);
	assert.equal(response.status, 200);
	assert.equal(fetchedUrl, "https://api.github.com/repos/octo/demo/contents/private");
});

test("rejects unsupported methods and request bodies before fetch", async () => {
	let fetchCalls = 0;
	const handler = createGatewayHandler({
		fetch: async () => {
			fetchCalls += 1;
			return jsonResponse({ ok: true });
		},
	});
	const post = await handler(makeRequest("/github/repository/octo/demo", { method: "POST" }));
	assert.equal(post.status, 405);
	assert.equal(post.headers.get("allow"), "GET, HEAD, OPTIONS");
	assert.equal(fetchCalls, 0);
});

test("integrated mode rejects a foreign Origin and standalone mode requires explicit HTTPS origins", async () => {
	let fetchCalls = 0;
	const integrated = createGatewayHandler({ fetch: async () => {
		fetchCalls += 1;
		return jsonResponse({ ok: true });
	} });
	const blocked = await integrated(makeRequest("/github/repository/octo/demo", { headers: { Origin: "https://evil.example" } }));
	assert.equal(blocked.status, 403);
	assert.equal(blocked.headers.get("access-control-allow-origin"), null);
	assert.equal(fetchCalls, 0);
	assert.throws(() => createGatewayHandler({ mode: "standalone" }), /requires at least one exact allowed origin/);
	assert.throws(() => createGatewayHandler({ mode: "standalone", allowedOrigins: ["*"] }), /exact HTTPS origins/);
	assert.throws(() => createGatewayHandler({ mode: "standalone", allowedOrigins: ["https://site.example/path"] }), /exact HTTPS origins/);
});

test("standalone preflight allows only the declared origin and read-only methods", async () => {
	const handler = createGatewayHandler({ mode: "standalone", allowedOrigins: ["https://site.example"] });
	const allowed = await handler(new Request("https://gateway.example/_kirari/edge/github/repository/octo/demo", {
		method: "OPTIONS",
		headers: { Origin: "https://site.example", "Access-Control-Request-Method": "GET" },
	}));
	assert.equal(allowed.status, 204);
	assert.equal(allowed.headers.get("access-control-allow-origin"), "https://site.example");
	assert.equal(allowed.headers.get("access-control-allow-methods"), "GET, HEAD, OPTIONS");
	assert.equal(allowed.headers.get("access-control-allow-headers"), "Accept");
	const denied = await handler(new Request("https://gateway.example/_kirari/edge/github/repository/octo/demo", {
		method: "OPTIONS",
		headers: { Origin: "https://site.example", "Access-Control-Request-Method": "DELETE" },
	}));
	assert.equal(denied.status, 405);
});

test("avatar redirects only to the fixed GitHub avatar host and never receives credentials", async () => {
	const urls: string[] = [];
	const authorizations: Array<string | null> = [];
	const handler = createGatewayHandler({
		fetch: async (input, init) => {
			urls.push(String(input));
			authorizations.push(new Headers(init?.headers).get("authorization"));
			if (urls.length === 1) {
				return new Response(null, { status: 302, headers: { location: "https://avatars.githubusercontent.com/u/123?v=4" } });
			}
			return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } });
		},
		getGitHubToken: () => "worker-token",
		githubTokenPublicRepositories: ["octo/demo"],
	});
	const response = await handler(makeRequest("/github/avatar/octo?size=96", {
		headers: { Authorization: "Bearer client-token", Cookie: "session=secret" },
	}));
	assert.equal(response.status, 200);
	assert.deepEqual(urls, [
		"https://github.com/octo.png?size=96",
		"https://avatars.githubusercontent.com/u/123?v=4",
	]);
	assert.deepEqual(authorizations, [null, null]);
	assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1, 2, 3]);
});

test("rejects an avatar redirect to any unapproved host", async () => {
	let fetchCalls = 0;
	const handler = createGatewayHandler({
		fetch: async () => {
			fetchCalls += 1;
			return new Response(null, { status: 302, headers: { location: "https://evil.example/image.png" } });
		},
	});
	const response = await handler(makeRequest("/github/avatar/octo"));
	assert.equal(response.status, 502);
	assert.deepEqual(await response.json(), { error: "upstream_redirect_rejected" });
	assert.equal(fetchCalls, 1);
});

test("maps a network failure after the approved avatar redirect to unavailable", async () => {
	let fetchCalls = 0;
	const handler = createGatewayHandler({
		fetch: async () => {
			fetchCalls += 1;
			if (fetchCalls === 1) return new Response(null, { status: 302, headers: { location: "https://avatars.githubusercontent.com/u/123" } });
			throw new Error("network unavailable");
		},
	});
	const response = await handler(makeRequest("/github/avatar/octo"));
	assert.equal(response.status, 502);
	assert.deepEqual(await response.json(), { error: "upstream_unavailable" });
	assert.equal(fetchCalls, 2);
});

test("maps a timeout after the approved avatar redirect to timeout", async () => {
	let fetchCalls = 0;
	const handler = createGatewayHandler({
		fetch: async (_input, init) => {
			fetchCalls += 1;
			if (fetchCalls === 1) return new Response(null, { status: 302, headers: { location: "https://avatars.githubusercontent.com/u/123" } });
			const signal = init?.signal;
			assert.ok(signal);
			return new Promise<Response>((_resolve, reject) => {
				signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
			});
		},
	});
	const response = await handler(makeRequest("/github/avatar/octo"));
	assert.equal(response.status, 504);
	assert.deepEqual(await response.json(), { error: "upstream_timeout" });
	assert.equal(fetchCalls, 2);
});

test("does not expose upstream error bodies, credentials, or arbitrary headers", async () => {
	const handler = createGatewayHandler({
		fetch: async (_input, init) => {
			assert.equal(new Headers(init?.headers).get("authorization"), "Bearer secret-value");
			return new Response("Bearer secret-value", {
				status: 403,
				headers: {
					"content-type": "text/plain",
					"x-ratelimit-remaining": "0",
					"set-cookie": "private=secret",
					"x-internal-debug": "sensitive",
				},
			});
		},
		getGitHubToken: () => "secret-value",
		githubTokenPublicRepositories: ["octo/demo"],
	});
	const response = await handler(makeRequest("/github/repository/octo/demo"));
	const body = await response.text();
	assert.equal(response.status, 429);
	assert.match(body, /upstream_rate_limited/);
	assert.doesNotMatch(body, /secret-value|private=secret|sensitive/);
	assert.equal(response.headers.get("x-upstream-ratelimit-remaining"), "0");
	assert.equal(response.headers.get("set-cookie"), null);
	assert.equal(response.headers.get("x-internal-debug"), null);
});

test("maps ordinary upstream network failures to an unavailable response, not a timeout", async () => {
	const handler = createGatewayHandler({ fetch: async () => { throw new Error("Bearer secret-value"); } });
	const response = await handler(makeRequest("/github/repository/octo/demo"));
	assert.equal(response.status, 502);
	assert.deepEqual(await response.json(), { error: "upstream_unavailable" });
});

test("does not label a caller-aborted request as an upstream timeout", async () => {
	const controller = new AbortController();
	controller.abort();
	const handler = createGatewayHandler({
		fetch: async (_input, init) => {
			assert.equal(init?.signal?.aborted, true);
			throw new Error("request aborted");
		},
	});
	const response = await handler(makeRequest("/github/repository/octo/demo", { signal: controller.signal }));
	assert.equal(response.status, 502);
	assert.deepEqual(await response.json(), { error: "upstream_unavailable" });
});

test("keeps the upstream timeout active while reading a stalled response body", async () => {
	let aborted = false;
	const handler = createGatewayHandler({
		fetch: async (_input, init) => new Response(new ReadableStream<Uint8Array>({
			start(controller) {
				init?.signal?.addEventListener("abort", () => {
					aborted = true;
					controller.error(new Error("aborted"));
				}, { once: true });
			},
		}), { headers: { "content-type": "application/json" } }),
	});
	const response = await handler(makeRequest("/github/repository/octo/demo"));
	assert.equal(response.status, 504);
	assert.deepEqual(await response.json(), { error: "upstream_timeout" });
	assert.equal(aborted, true);
});

test("rejects an oversized upstream response before returning or caching it", async () => {
	const handler = createGatewayHandler({
		fetch: async () => new Response("x", { headers: { "content-type": "application/json", "content-length": "1000001" } }),
	});
	const response = await handler(makeRequest("/github/repository/octo/demo"));
	assert.equal(response.status, 502);
	assert.deepEqual(await response.json(), { error: "upstream_invalid_response" });
});

test("keeps rewritten repository JSON within the response and cache size bound", async () => {
	const prefix = '{"owner":{"login":"octo","avatar_url":"https://avatars.githubusercontent.com/u/1"},"padding":"';
	const suffix = '"}';
	const body = `${prefix}${"x".repeat(999_990 - prefix.length - suffix.length)}${suffix}`;
	assert.equal(new TextEncoder().encode(body).byteLength, 999_990);
	const cache = createMemoryCache();
	const handler = createGatewayHandler({
		cacheLevel: "CACHE_EDGE",
		edgeCache: cache,
		fetch: async () => new Response(body, { headers: { "content-type": "application/json" } }),
	});
	const response = await handler(makeRequest("/github/repository/octo/demo"));
	assert.equal(response.status, 502);
	assert.deepEqual(await response.json(), { error: "upstream_invalid_response" });
	assert.equal(cache.entries.size, 0);
});

test("bounds streamed upstream bodies even when Content-Length is absent", async () => {
	let cancelled = false;
	const cache = createMemoryCache();
	const handler = createGatewayHandler({
		cacheLevel: "CACHE_EDGE",
		edgeCache: cache,
		fetch: async () => new Response(new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new Uint8Array(1_000_001));
			},
			cancel() {
				cancelled = true;
			},
		}), { headers: { "content-type": "application/json" } }),
	});
	const response = await handler(makeRequest("/github/repository/octo/demo"));
	assert.equal(response.status, 502);
	assert.deepEqual(await response.json(), { error: "upstream_invalid_response" });
	assert.equal(cache.entries.size, 0);
	assert.equal(cancelled, true);
});

test("uses edge cache for a fresh hit and reports the active level", async () => {
	let fetchCalls = 0;
	const cache = createMemoryCache();
	const handler = createGatewayHandler({
		cacheLevel: "CACHE_EDGE",
		edgeCache: cache,
		now: () => 1_000,
		fetch: async () => {
			fetchCalls += 1;
			return jsonResponse({ owner: { login: "octo" } }, {
				headers: { etag: "\"v1\"", "last-modified": "Thu, 01 Jan 1970 00:00:00 GMT" },
			});
		},
	});
	const first = await handler(makeRequest("/github/repository/octo/demo"));
	assert.equal(first.headers.get("x-kirari-cache"), "MISS");
	assert.equal(first.headers.get("x-kirari-cache-level"), "CACHE_EDGE");
	assert.equal(first.headers.get("etag"), "\"v1\"");
	assert.equal(first.headers.get("last-modified"), "Thu, 01 Jan 1970 00:00:00 GMT");
	const second = await handler(makeRequest("/github/repository/octo/demo"));
	assert.equal(second.headers.get("x-kirari-cache"), "HIT");
	assert.equal(second.headers.get("x-kirari-cache-level"), "CACHE_EDGE");
	assert.equal(second.headers.get("etag"), "\"v1\"");
	assert.equal(fetchCalls, 1);
	assert.equal(cache.entries.size, 1);
});

test("partitions rewritten repository responses by request origin", async () => {
	const entries = new Map<string, CacheEntry>();
	const cache: EdgeCache = {
		consistency: "provider-defined",
		async get(key) { return entries.get(key) ?? null; },
		async put(key, entry) { entries.set(key, entry); },
	};
	let fetchCalls = 0;
	const handler = createGatewayHandler({
		mode: "standalone",
		allowedOrigins: ["https://one.example", "https://two.example"],
		cacheLevel: "CACHE_EDGE",
		edgeCache: cache,
		fetch: async () => {
			fetchCalls += 1;
			return jsonResponse({ owner: { login: "octo", avatar_url: "https://avatars.githubusercontent.com/u/1" } });
		},
	});
	const first = await handler(new Request("https://one.example/_kirari/edge/github/repository/octo/demo"));
	const second = await handler(new Request("https://two.example/_kirari/edge/github/repository/octo/demo"));
	assert.equal((await first.json()).owner.avatar_url, "https://one.example/_kirari/edge/github/avatar/octo?size=96");
	assert.equal((await second.json()).owner.avatar_url, "https://two.example/_kirari/edge/github/avatar/octo?size=96");
	assert.equal(second.headers.get("x-kirari-cache"), "MISS");
	assert.equal(fetchCalls, 2);
});

test("serves a stale cache entry only when the upstream refresh fails", async () => {
	const staleEntry: CacheEntry = {
		status: 200,
		headers: { "content-type": "application/json; charset=utf-8" },
		body: new TextEncoder().encode("{\"cached\":true}"),
		freshUntil: 1_000,
		staleUntil: 10_000,
	};
	const cache = createMemoryCache(staleEntry);
	const handler = createGatewayHandler({
		cacheLevel: "CACHE_EDGE",
		edgeCache: cache,
		now: () => 2_000,
		fetch: async () => { throw new Error("offline"); },
	});
	const response = await handler(makeRequest("/github/repository/octo/demo"));
	assert.equal(response.headers.get("x-kirari-cache"), "STALE");
	assert.deepEqual(await response.json(), { cached: true });
});

test("downgrades an unavailable or failing cache to CACHE_NONE", async () => {
	const noStoreHandler = createGatewayHandler({
		cacheLevel: "CACHE_PERSISTENT",
		fetch: async () => jsonResponse({ ok: true }),
	});
	const unavailable = await noStoreHandler(makeRequest("/github/repository/octo/demo"));
	assert.equal(unavailable.headers.get("x-kirari-cache-level"), "CACHE_NONE");
	assert.equal(unavailable.headers.get("x-kirari-cache"), "BYPASS");
	assert.equal(unavailable.headers.get("cache-control"), "no-store");

	const brokenCache: EdgeCache = {
		consistency: "provider-defined",
		async get() { throw new Error("cache unavailable"); },
		async put() { throw new Error("cache unavailable"); },
	};
	const brokenHandler = createGatewayHandler({
		cacheLevel: "CACHE_EDGE",
		edgeCache: brokenCache,
		fetch: async () => jsonResponse({ ok: true }),
	});
	const broken = await brokenHandler(makeRequest("/github/repository/octo/demo"));
	assert.equal(broken.headers.get("x-kirari-cache-level"), "CACHE_NONE");
	assert.equal(broken.headers.get("x-kirari-cache"), "BYPASS");
});

test("uses only the injected persistent cache when CACHE_PERSISTENT is selected", async () => {
	const entries = new Map<string, CacheEntry>();
	const persistentCache: PersistentCache = {
		consistency: "eventual",
		async get(key) { return entries.get(key) ?? null; },
		async put(key, entry) { entries.set(key, entry); },
	};
	let fetchCalls = 0;
	const handler = createGatewayHandler({
		cacheLevel: "CACHE_PERSISTENT",
		persistentCache,
		fetch: async () => {
			fetchCalls += 1;
			return jsonResponse({ cached: true });
		},
	});
	const first = await handler(makeRequest("/github/repository/octo/demo"));
	const second = await handler(makeRequest("/github/repository/octo/demo"));
	assert.equal(first.headers.get("x-kirari-cache-level"), "CACHE_PERSISTENT");
	assert.equal(second.headers.get("x-kirari-cache"), "HIT");
	assert.equal(fetchCalls, 1);
});

test("does not cache unsuccessful or malformed repository JSON responses", async () => {
	const handler = createGatewayHandler({ fetch: async () => new Response("not-json", { headers: { "content-type": "application/json" } }) });
	const response = await handler(makeRequest("/github/repository/octo/demo"));
	assert.equal(response.status, 502);
	assert.deepEqual(await response.json(), { error: "upstream_invalid_response" });
});

test("rejects upstream payloads without an explicit expected Content-Type", async () => {
	const fetch = async () => new Response(new Uint8Array([0x7b, 0x7d]));
	const apiResponse = await createGatewayHandler({ fetch })(makeRequest("/github/repository/octo/demo"));
	const avatarResponse = await createGatewayHandler({ fetch })(makeRequest("/github/avatar/octo"));
	assert.equal(apiResponse.status, 502);
	assert.deepEqual(await apiResponse.json(), { error: "upstream_invalid_response" });
	assert.equal(avatarResponse.status, 502);
	assert.deepEqual(await avatarResponse.json(), { error: "upstream_invalid_response" });
});

test("rejects malformed JSON for non-repository operations before it can be cached", async () => {
	const cache = createMemoryCache();
	const handler = createGatewayHandler({
		cacheLevel: "CACHE_EDGE",
		edgeCache: cache,
		fetch: async () => new Response("{broken", { headers: { "content-type": "application/json" } }),
	});
	const response = await handler(makeRequest("/github/latest-commit/octo/demo?path=README.md"));
	assert.equal(response.status, 502);
	assert.deepEqual(await response.json(), { error: "upstream_invalid_response" });
	assert.equal(cache.entries.size, 0);
});

test("ignores cache entries with executable content types or malformed JSON", async () => {
	const unsafeHtml: CacheEntry = {
		status: 200,
		headers: { "content-type": "text/html" },
		body: new TextEncoder().encode("<script>document.location='https://evil.example'</script>"),
		freshUntil: 10_000,
		staleUntil: 20_000,
	};
	const malformedJson: CacheEntry = {
		...unsafeHtml,
		headers: { "content-type": "application/json" },
		body: new TextEncoder().encode("{broken"),
	};
	for (const seed of [unsafeHtml, malformedJson]) {
		const cache = createMemoryCache(seed);
		let fetchCalls = 0;
		const handler = createGatewayHandler({
			cacheLevel: "CACHE_EDGE",
			edgeCache: cache,
			now: () => 1_000,
			fetch: async () => {
				fetchCalls += 1;
				return jsonResponse({ safe: true });
			},
		});
		const response = await handler(makeRequest("/github/repository/octo/demo"));
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
		assert.equal(response.headers.get("x-content-type-options"), "nosniff");
		assert.deepEqual(await response.json(), { safe: true });
		assert.equal(fetchCalls, 1);
	}
});

test("returns generic cacheable 404 without exposing upstream response details", async () => {
	const handler = createGatewayHandler({
		cacheLevel: "CACHE_EDGE",
		edgeCache: createMemoryCache(),
		fetch: async () => new Response("private upstream detail", { status: 404, headers: { "x-internal-debug": "hidden" } }),
	});
	const response = await handler(makeRequest("/github/repository/octo/missing"));
	assert.equal(response.status, 404);
	assert.deepEqual(await response.json(), { error: "not_found" });
	assert.equal(response.headers.get("x-internal-debug"), null);
	assert.equal(response.headers.get("x-kirari-cache"), "MISS");
});

test("keeps HEAD response bodies empty while preserving the GET-derived headers", async () => {
	const handler = createGatewayHandler({ fetch: async () => jsonResponse({ ok: true }) });
	const response = await handler(makeRequest("/github/repository/octo/demo", { method: "HEAD" }));
	assert.equal(response.status, 200);
	assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
	assert.equal(await response.text(), "");
});

test("does not follow API redirects that could change the fixed upstream", async () => {
	let fetchCalls = 0;
	const handler = createGatewayHandler({
		fetch: async () => {
			fetchCalls += 1;
			return new Response(null, { status: 302, headers: { location: "https://evil.example/private" } });
		},
		getGitHubToken: () => "token",
		githubTokenPublicRepositories: ["octo/demo"],
	});
	const response = await handler(makeRequest("/github/repository/octo/demo"));
	assert.equal(response.status, 502);
	assert.deepEqual(await response.json(), { error: "upstream_redirect_rejected" });
	assert.equal(fetchCalls, 1);
});

test("keeps same-origin CORS limited to the actual request origin", async () => {
	const handler = createGatewayHandler({ fetch: async () => jsonResponse({ ok: true }) });
	const response = await handler(new Request("https://site.example/_kirari/edge/github/repository/octo/demo", {
		headers: { Origin: "https://site.example" },
	}));
	assert.equal(response.headers.get("access-control-allow-origin"), "https://site.example");
	assert.equal(response.headers.get("vary"), "Origin");
});

test("preserves only safe rate-limit headers from an upstream error", async () => {
	const handler = createGatewayHandler({
		fetch: async () => new Response("secret", {
			status: 429,
			headers: { "x-ratelimit-reset": "1770000000", "x-ratelimit-remaining": "0", "x-ratelimit-limit": "60" },
		}),
	});
	const response = await handler(makeRequest("/github/repository/octo/demo"));
	assert.equal(response.status, 429);
	assert.equal(response.headers.get("x-upstream-ratelimit-reset"), "1770000000");
	assert.equal(response.headers.get("x-upstream-ratelimit-limit"), "60");
});
